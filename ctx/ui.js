import { escapeHTML, compareSizes } from './utils.js';
import { extractOrderDataToJson } from './export.js';
import { checkCatalogForItem } from './api.js';

// Centralized state to power views, pagination, and tracking
const state = {
    orderData: null,
    groups: {},
    lineAggKeys: [],
    tableConfigs: {}, // Persists specific table configurations (maxQty & weight)
    currentView: 'paginated',
    currentPage: 1,
    itemsPerPage: 5, // Default, but gets overwritten by DOM
    containerElement: null,
    globalMaxMap: {},
    globalWeightMap: {}
};

export async function renderValidationTable(orderItems, containerElement) {
    // 1. Get unique BuyerNumbers in this grouping
    const uniqueBuyerNumbers = [...new Set(orderItems.map(i => i.baseItem?.itemIdentifier?.BuyerNumber).filter(Boolean))];

    // 2. Setup a loading container next to the main table
    const validationWrapper = document.createElement('div');
    validationWrapper.className = 'validation-section';
    validationWrapper.innerHTML = `<h4>Catalog Verification</h4><div class="loading">Checking catalog...</div>`;
    containerElement.appendChild(validationWrapper);

    let html = `<table class="validation-table">
        <thead>
            <tr>
                <th>Buyer No.</th>
                <th>Required Size</th>
                <th>Catalog Status</th>
            </tr>
        </thead>
        <tbody>`;

    // 3. Fetch from catalog and compare sizes
    for (const bNum of uniqueBuyerNumbers) {
        // Get all sizes required for this buyer number in the order
        const requiredSizes = [...new Set(orderItems
            .filter(i => i.baseItem.itemIdentifier.BuyerNumber === bNum)
            .map(i => i.baseItem.reference.ManufacturingSize || i.baseItem.itemIdentifier.IdBuyerSize)
        )];

        // Query the proxy
        const catalogData = await checkCatalogForItem(bNum);
        const catalogItems = catalogData?.result || [];

        // Determine if buyer number exists at all
        if (catalogItems.length === 0) {
            html += `<tr>
                <td class="error-text">${escapeHTML(bNum)}</td>
                <td colspan="2" class="error-text">❌ Buyer Number not found in catalog</td>
            </tr>`;
            continue;
        }

        // Extract available sizes from catalog response
        const availableCatalogSizes = catalogItems.map(c =>
            c.itemAttribute?.ManufacturingSize || c.itemAttribute?.IdBuyerSize
        ).filter(Boolean);

        // Compare each required order size against catalog sizes
        requiredSizes.forEach(size => {
            const isMatch = availableCatalogSizes.includes(size);
            html += `<tr>
                <td class="bold-text">${escapeHTML(bNum)}</td>
                <td>${escapeHTML(size)}</td>
                <td class="${isMatch ? 'success-text' : 'error-text'}">
                    ${isMatch ? '✅ Verified' : '❌ Size Missing'}
                </td>
            </tr>`;
        });
    }

    html += `</tbody></table>`;
    validationWrapper.innerHTML = `<h4>Catalog Verification</h4>` + html;
}


export function renderTables(orderData, containerElement) {
    if (!orderData || !Array.isArray(orderData.orderItem)) {
        containerElement.innerHTML += `<div class="error">No order items found.</div>`;
        return;
    }

    // Initialize state
    state.orderData = orderData;
    state.containerElement = containerElement;
    state.groups = {};
    state.tableConfigs = {}; // Reset table configs on new data load
    const allUniqueSizes = new Set();

    orderData.orderItem.forEach((item) => {
        const bi = item.baseItem || {};
        const ref = bi.reference || {};
        const id = bi.itemIdentifier || {};

        const lineAgg = ref.LineAggregator ?? 'Unknown';
        if (!state.groups[lineAgg]) {
            state.groups[lineAgg] = [];
        }
        state.groups[lineAgg].push(item);

        const size = id.IdBuyerSize;
        if (size && size !== '-') allUniqueSizes.add(escapeHTML(size));
    });

    state.lineAggKeys = Object.keys(state.groups);
    state.sortedGlobalSizes = Array.from(allUniqueSizes).sort(compareSizes);

    setupNavigation();
    renderCurrentView();
}

function setupNavigation() {
    // Show controls 
    const viewControls = document.getElementById('viewControls');
    if (viewControls) viewControls.style.display = 'inline-flex';

    const btns = {
        'summary': document.getElementById('viewSummaryBtn'),
        'paginated': document.getElementById('viewPaginatedBtn'),
        'all': document.getElementById('viewAllBtn')
    };

    const updateActiveBtn = (viewName) => {
        Object.values(btns).forEach(btn => btn.classList.remove('active-view'));
        btns[viewName].classList.add('active-view');
    };

    btns['summary'].onclick = () => { state.currentView = 'summary'; updateActiveBtn('summary'); renderCurrentView(); };
    btns['paginated'].onclick = () => { state.currentView = 'paginated'; state.currentPage = 1; updateActiveBtn('paginated'); renderCurrentView(); };
    btns['all'].onclick = () => { state.currentView = 'all'; updateActiveBtn('all'); renderCurrentView(); };

    // Ensure Pagination input stays perfectly synced
    const itemsInput = document.getElementById('itemsPerPage');
    if (itemsInput) {
        // 1. Sync on load
        const initialVal = parseInt(itemsInput.value, 10);
        if (!isNaN(initialVal) && initialVal > 0) {
            state.itemsPerPage = initialVal;
        }

        // 2. Update immediately as user clicks arrows (oninput instead of onchange)
        itemsInput.oninput = (e) => {
            const val = parseInt(e.target.value, 10);
            if (val > 0) {
                state.itemsPerPage = val;
                state.currentPage = 1;
                if (state.currentView === 'paginated') renderCurrentView();
            }
        };

        // 3. Prevent user from leaving the input completely blank or 0
        itemsInput.onchange = (e) => {
            const val = parseInt(e.target.value, 10);
            if (isNaN(val) || val <= 0) {
                e.target.value = state.itemsPerPage;
            }
        };
    }
}

function renderCurrentView() {
    state.containerElement.innerHTML = '';

    if (state.currentView !== 'summary') {
        renderGlobalSettings();
    }

    const orderWrapper = document.createElement('div');
    orderWrapper.className = 'order-section';
    orderWrapper.innerHTML = `<h2>Order Details (UID: <span class="uid-text">${escapeHTML(state.orderData.__metadata?.uid || 'Unknown')}</span>)</h2>`;
    state.containerElement.appendChild(orderWrapper);

    if (state.currentView === 'summary') {
        renderSummaryView(orderWrapper);
    } else if (state.currentView === 'all') {
        renderAggregators(state.lineAggKeys, orderWrapper);
    } else if (state.currentView === 'paginated') {
        const start = (state.currentPage - 1) * state.itemsPerPage;
        const end = start + state.itemsPerPage;
        const paginatedKeys = state.lineAggKeys.slice(start, end);

        renderAggregators(paginatedKeys, orderWrapper);
        renderPaginationControls(orderWrapper);
    }

    // Determine if the Export Button should be shown
    let shouldShowExport = false;

    if (state.currentView === 'all') {
        shouldShowExport = true;
    } else if (state.currentView === 'paginated') {
        const totalPages = Math.ceil(state.lineAggKeys.length / state.itemsPerPage);
        // Show if we are on the last page, or if there is no data
        if (state.currentPage === totalPages || totalPages === 0) {
            shouldShowExport = true;
        }
    }

    // Render the button if conditions are met
    if (shouldShowExport) {
        const globalExportBtn = document.createElement('button');
        globalExportBtn.className = 'pack-btn global-export-btn';
        globalExportBtn.innerText = 'Export All to JSON';
        globalExportBtn.onclick = () => extractOrderDataToJson(state.orderData);
        state.containerElement.appendChild(globalExportBtn);
    }
}

function renderSummaryView(wrapper) {
    const container = document.createElement('div');
    container.className = 'summary-view-container';

    state.lineAggKeys.forEach((lineAgg, index) => {
        const items = state.groups[lineAgg];
        const totalQty = items.reduce((sum, item) => sum + parseFloat(item.baseItem?.quantity || 0), 0);

        const lineAggSection = document.createElement('div');
        lineAggSection.className = 'line-agg-section';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'summary-header';

        headerDiv.innerHTML = `
            <h3>Line Aggregator: ${escapeHTML(lineAgg)} (Total Qty: ${totalQty})</h3>
        `;

        const gotoBtn = document.createElement('button');
        gotoBtn.className = 'nav-btn';
        gotoBtn.innerText = 'Go to Editor Page';
        gotoBtn.onclick = () => {
            // Calculate the target page based on items per page
            state.currentView = 'paginated';
            state.currentPage = Math.ceil((index + 1) / state.itemsPerPage);

            // Programmatically update the active button styles
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active-view'));
            const paginatedBtn = document.getElementById('viewPaginatedBtn');
            if (paginatedBtn) paginatedBtn.classList.add('active-view');

            // Render the target view
            renderCurrentView();

            // Smoothly scroll down to the specific table header
            setTimeout(() => {
                const headers = document.querySelectorAll('.line-agg-section h3');
                for (let h of headers) {
                    if (h.innerText.includes(lineAgg)) {
                        h.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        break;
                    }
                }
            }, 50);
        };

        headerDiv.appendChild(gotoBtn);
        lineAggSection.appendChild(headerDiv);

        const packingContainer = document.createElement('div');
        packingContainer.className = 'packing-container';
        packingContainer.style.overflowX = 'auto';

        // Render the fully interactive packing lists here
        createPackingUI(items, packingContainer, state.globalMaxMap, state.globalWeightMap, lineAgg);

        lineAggSection.appendChild(packingContainer);
        container.appendChild(lineAggSection);
    });

    wrapper.appendChild(container);
}

function renderPaginationControls(wrapper) {
    const totalPages = Math.ceil(state.lineAggKeys.length / state.itemsPerPage);
    if (totalPages <= 1) return;

    const controls = document.createElement('div');
    controls.className = 'pagination-controls';

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === state.currentPage ? 'active-page' : ''}`;
        btn.innerText = i;
        btn.onclick = () => {
            state.currentPage = i;
            renderCurrentView();
            window.scrollTo({ top: document.querySelector('.global-settings').offsetTop, behavior: 'smooth' });
        };
        controls.appendChild(btn);
    }
    wrapper.appendChild(controls);
}

function renderGlobalSettings() {
    const globalSettings = document.createElement('div');
    globalSettings.className = 'global-settings';
    globalSettings.innerHTML = `<h3>Default Settings Per Size</h3>`;

    const sizesContainer = document.createElement('div');
    sizesContainer.className = 'global-sizes-container';

    state.sortedGlobalSizes.forEach(size => {
        const sizeBlock = document.createElement('div');
        sizeBlock.className = 'global-size-block';
        sizeBlock.innerHTML = `
            <strong>${size}</strong>
            <div class="input-group input-group-margin">
                Max Qty: <br>
                <input type="number" class="global-max-qty" data-size="${size}" value="${state.globalMaxMap[size] || 50}" min="1">
            </div>
            <div class="input-group">
                Weight: <br>
                <input type="number" class="global-weight" data-size="${size}" step="0.1" min="0" placeholder="0.0" value="${state.globalWeightMap[size] || ''}">
            </div>
        `;
        sizesContainer.appendChild(sizeBlock);
    });

    const applyBtnBlock = document.createElement('div');
    applyBtnBlock.className = 'global-apply-block';
    const applyBtn = document.createElement('button');
    applyBtn.className = 'pack-btn';
    applyBtn.innerText = 'Apply Defaults to Displayed Tables';
    applyBtn.onclick = () => {
        document.querySelectorAll('.global-max-qty').forEach(input => state.globalMaxMap[input.getAttribute('data-size')] = parseInt(input.value, 10));
        document.querySelectorAll('.global-weight').forEach(input => state.globalWeightMap[input.getAttribute('data-size')] = input.value);

        // Remove individual configurations ONLY for the displayed tables so they inherit the new global settings
        let keysToUpdate = [];
        if (state.currentView === 'paginated') {
            const start = (state.currentPage - 1) * state.itemsPerPage;
            keysToUpdate = state.lineAggKeys.slice(start, start + state.itemsPerPage);
        } else if (state.currentView === 'all') {
            keysToUpdate = state.lineAggKeys;
        }

        keysToUpdate.forEach(key => delete state.tableConfigs[key]);
        renderCurrentView();
    };

    applyBtnBlock.appendChild(applyBtn);
    globalSettings.appendChild(sizesContainer);
    globalSettings.appendChild(applyBtnBlock);
    state.containerElement.appendChild(globalSettings);
}

function renderAggregators(aggKeys, wrapper) {
    aggKeys.forEach(lineAgg => {
        const items = state.groups[lineAgg];
        let totalQty = 0;

        const lineAggSection = document.createElement('div');
        lineAggSection.className = 'line-agg-section';

        lineAggSection.innerHTML = `
            <h3>Line Aggregator: ${escapeHTML(lineAgg)}</h3>
        `;

        const tablesContainer = document.createElement('div');
        tablesContainer.className = 'tables-container';

        // 1. Setup the Original Data Table Wrapper (Top)
        const originalTableWrapper = document.createElement('div');
        originalTableWrapper.className = 'original-table-wrapper';

        const table = document.createElement('table');
        let tbodyHtml = `
            <thead>
                <tr><th>Size</th>
                <th>Seq #</th>
                <th>Ship Mode</th>
                <th>Status</th>
                <th>Quantity</th>
                <th>Manufacturing Size</th>
                <th>Upper Var</th>
                <th>Lower Var</th></tr>
            </thead>
            <tbody>
        `;

        items.forEach((item) => {
            const bi = item.baseItem || {};
            const ref = bi.reference || {};
            const id = bi.itemIdentifier || {};
            const itemVar = bi.itemVariance || {};
            const qty = parseFloat(bi.quantity || 0);
            totalQty += qty;

            tbodyHtml += `
                <tr>
                    <td><span class="size">${escapeHTML(id.IdBuyerSize)}</span></td>
                    <td><span class="description">${escapeHTML(id.ItemSequenceNumber)}</span></td>
                    <td><span class="brand">${escapeHTML(ref.AdidasShipMode)}</span></td>
                    <td><span class="status">${escapeHTML(ref.ItemStatus)}</span></td>
                    <td><span class="qty">${escapeHTML(bi.quantity)}</span></td>
                    <td><span class="qty">${escapeHTML(ref.ManufacturingSize)}</span></td>
                    <td><span class="qty">${escapeHTML(itemVar.upperVariance)}</span></td>
                    <td><span class="qty">${escapeHTML(itemVar.lowerVariance)}</span></td>
                </tr>
            `;
        });

        tbodyHtml += `
            <tr class="total-row">
                <td colspan="4"><strong class="bold-text">TOTAL QUANTITY</strong></td>
                <td><strong class="bold-text">${totalQty}</strong></td>
            </tr></tbody>
        `;
        table.innerHTML = tbodyHtml;
        originalTableWrapper.appendChild(table);
        tablesContainer.appendChild(originalTableWrapper);

        // 2. Create the Flexbox Wrapper (Bottom, holds Packing + Validation)
        const flexWrapper = document.createElement('div');
        flexWrapper.className = 'tables-flex-wrapper';
        flexWrapper.style.display = 'flex';
        flexWrapper.style.gap = '20px';
        flexWrapper.style.alignItems = 'flex-start';
        flexWrapper.style.marginTop = '20px'; // Give it a little breathing room from the top table

        // 3. Create the Packing Container (Left side of flex)
        const packingContainer = document.createElement('div');
        packingContainer.className = 'packing-container';
        packingContainer.style.flex = '1'; // Allows the table to take up available space

        // Attach layout elements
        flexWrapper.appendChild(packingContainer);
        tablesContainer.appendChild(flexWrapper);
        lineAggSection.appendChild(tablesContainer);
        wrapper.appendChild(lineAggSection);

        // 4. Trigger the UI builders to fill the containers
        const groupItems = state.groups[lineAgg];

        // Builds the packing table INSIDE packingContainer
        createPackingUI(items, packingContainer, state.globalMaxMap, state.globalWeightMap, lineAgg);

        // Builds the validation table INSIDE flexWrapper (next to packingContainer)
        renderValidationTable(groupItems, flexWrapper);
    });
}


export function createPackingUI(items, packingContainer, globalMaxQtyMap = {}, globalWeightMap = {}, lineAgg = '') {
    packingContainer.innerHTML = '';

    // Check if this table has existing persisted state. If not, build it from global.
    if (!state.tableConfigs[lineAgg]) {
        const maxQtyMap = {};
        const weightMap = {};

        items.forEach(item => {
            const bi = item.baseItem || {};
            const id = bi.itemIdentifier || {};
            const size = escapeHTML(id.IdBuyerSize);
            const qty = parseInt(bi.quantity, 10);
            if (!isNaN(qty) && qty > 0 && size !== '-') {
                maxQtyMap[size] = globalMaxQtyMap[size] > 0 ? globalMaxQtyMap[size] : 50;
                weightMap[size] = globalWeightMap[size] !== undefined ? globalWeightMap[size] : '';
            }
        });

        state.tableConfigs[lineAgg] = { maxQtyMap, weightMap };
    }

    // Pull from persisted state
    const { maxQtyMap, weightMap } = state.tableConfigs[lineAgg];

    renderPackingTable(items, maxQtyMap, weightMap, packingContainer, lineAgg);
}

function renderPackingTable(items, maxQtyMap, weightMap, container, lineAgg) {
    const uniqueSizes = new Set();
    const batches = [];

    items.forEach(item => {
        const bi = item.baseItem || {};
        const id = bi.itemIdentifier || {};
        const size = escapeHTML(id.IdBuyerSize);
        const qty = parseInt(bi.quantity, 10);
        const seqNo = escapeHTML(id.ItemSequenceNumber || '');

        if (!isNaN(qty) && qty > 0 && size !== '-') {
            uniqueSizes.add(size);
            let placed = false;
            for (let i = 0; i < batches.length; i++) {
                if (!batches[i].some(bItem => bItem.size === size)) {
                    batches[i].push({ size, qty, seqNo });
                    placed = true;
                    break;
                }
            }
            if (!placed) batches.push([{ size, qty, seqNo }]);
        }
    });

    if (batches.length === 0) {
        container.innerHTML = '<div class="empty-pack-msg">No valid items found to pack.</div>';
        return;
    }

    const sizes = Array.from(uniqueSizes).sort(compareSizes);

    let html = `
        <table class="packing-table">
            <thead>
                <tr>
                    <th rowspan="2">CTN NO</th>
                    <th colspan="${sizes.length}">SIZE</th>
                    <th rowspan="2">TOTAL CTNS</th>
                    <th rowspan="2">SHIPMENT QNTY</th>
                </tr>
                <tr>${sizes.map(s => `<th>${s}</th>`).join('')}</tr>
                <tr class="input-row">
                    <td class="input-label">Max qty/box:</td>
                    ${sizes.map(s => `<td><input type="number" class="max-qty-header-input" data-size="${s}" value="${maxQtyMap[s] || ''}" min="1"></td>`).join('')}
                    <td colspan="2"></td>
                </tr>
                <tr class="input-row">
                    <td class="input-label">Weight:</td>
                    ${sizes.map(s => `<td><input type="number" class="weight-header-input" data-size="${s}" step="0.1" value="${weightMap[s] || ''}"></td>`).join('')}
                    <td colspan="2"></td>
                </tr>
            </thead>
            <tbody>
    `;

    let cartonNo = 1;

    batches.forEach(batch => {
        batch.sort((a, b) => compareSizes(a.size, b.size));

        batch.forEach(item => {
            const currentSize = item.size;
            let remainingQty = item.qty;
            const maxQty = maxQtyMap[currentSize];

            if (maxQty && maxQty > 0) {
                const fullCartons = Math.floor(remainingQty / maxQty);
                const remainder = remainingQty % maxQty;

                if (fullCartons > 0) {
                    const startCtn = cartonNo;
                    const endCtn = cartonNo + fullCartons - 1;
                    const ctnString = startCtn === endCtn ? `${startCtn}` : `${startCtn}-${endCtn}`;

                    html += `<tr><td class="bold-text">${ctnString}</td>`;
                    sizes.forEach(s => html += `<td>${s === currentSize ? `<input type="text" value="${maxQty}" class="transparent-input" data-seq="${item.seqNo}" readonly>` : ''}</td>`);
                    html += `<td class="highlight-cell">${fullCartons}</td><td class="highlight-cell">${fullCartons * maxQty}</td></tr>`;
                    cartonNo = endCtn + 1;
                }

                if (remainder > 0) {
                    html += `<tr><td class="bold-text">${cartonNo}</td>`;
                    sizes.forEach(s => html += `<td>${s === currentSize ? `<input type="text" value="${remainder}" class="transparent-input" data-seq="${item.seqNo}" readonly>` : ''}</td>`);
                    html += `<td class="highlight-cell">1</td><td class="highlight-cell">${remainder}</td></tr>`;
                    cartonNo++;
                }
            }
        });
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    container.querySelectorAll('.max-qty-header-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const updatedSize = e.target.getAttribute('data-size');
            const newValue = parseInt(e.target.value, 10);
            if (newValue && newValue > 0) {
                state.tableConfigs[lineAgg].maxQtyMap[updatedSize] = newValue; // Save state
                renderPackingTable(items, state.tableConfigs[lineAgg].maxQtyMap, state.tableConfigs[lineAgg].weightMap, container, lineAgg);
            }
        });
    });

    container.querySelectorAll('.weight-header-input').forEach(input => {
        input.addEventListener('input', (e) => {
            state.tableConfigs[lineAgg].weightMap[e.target.getAttribute('data-size')] = e.target.value; // Save state
        });
    });
}