import { escapeHTML, compareSizes } from './utils.js';
import { extractOrderDataToJson } from './export.js';

export function renderTables(orderData, containerElement) {
    if (!orderData || !Array.isArray(orderData.orderItem)) {
        containerElement.innerHTML += `<div class="error">No order items found for UID: ${escapeHTML(orderData?.__metadata?.uid || 'Unknown')}.</div>`;
        return;
    }

    const groups = {};
    const allUniqueSizes = new Set();

    orderData.orderItem.forEach((item) => {
        const bi = item.baseItem || {};
        const ref = bi.reference || {};
        const id = bi.itemIdentifier || {};

        const lineAgg = ref.LineAggregator ?? 'Unknown';
        if (!groups[lineAgg]) groups[lineAgg] = [];
        groups[lineAgg].push(item);

        const size = id.IdBuyerSize;
        if (size && size !== '-') {
            allUniqueSizes.add(escapeHTML(size));
        }
    });

    const sortedGlobalSizes = Array.from(allUniqueSizes).sort(compareSizes);
    const lineAggKeys = Object.keys(groups);

    // ── Global Settings Panel ────────────────────────────────────────
    const globalSettings = document.createElement('div');
    globalSettings.className = 'global-settings';

    const headerTitle = document.createElement('h3');
    headerTitle.innerText = "Default Settings Per Size";
    globalSettings.appendChild(headerTitle);

    const sizesContainer = document.createElement('div');
    sizesContainer.className = 'global-sizes-container';

    sortedGlobalSizes.forEach(size => {
        const sizeBlock = document.createElement('div');
        sizeBlock.className = 'global-size-block';
        sizeBlock.innerHTML = `
            <strong>${size}</strong>
            <div class="input-group input-group-margin">
                Max Qty: <br>
                <input type="number" class="global-max-qty" data-size="${size}" value="50" min="1">
            </div>
            <div class="input-group">
                Weight: <br>
                <input type="number" class="global-weight" data-size="${size}" step="0.1" min="0" placeholder="0.0">
            </div>
        `;
        sizesContainer.appendChild(sizeBlock);
    });

    const applyBtnBlock = document.createElement('div');
    applyBtnBlock.className = 'global-apply-block';
    applyBtnBlock.innerHTML = `<button id="apply-globals-btn" class="pack-btn">Apply Defaults to All Tables</button>`;

    globalSettings.appendChild(sizesContainer);
    globalSettings.appendChild(applyBtnBlock);
    containerElement.appendChild(globalSettings);

    // ── Order heading ─────────────────────────────────────────────────
    const orderHeading = document.createElement('h2');
    orderHeading.className = 'order-heading';
    orderHeading.innerHTML = `Order Details (UID: <span class="uid-text">${escapeHTML(orderData.__metadata?.uid || 'Unknown')}</span>)`;
    containerElement.appendChild(orderHeading);

    // One button per LineAggregator — clicking it shows that page
    const navBlock = document.createElement('div');
    navBlock.className = 'line-agg-nav';

    const navLabel = document.createElement('span');
    navLabel.className = 'line-agg-nav-label';
    navLabel.innerText = 'Line Aggregator:';
    navBlock.appendChild(navLabel);

    const navBtnsContainer = document.createElement('div');
    navBtnsContainer.className = 'line-agg-nav-btns';
    navBlock.appendChild(navBtnsContainer);

    containerElement.appendChild(navBlock);

  
    // Holds all LineAggregator pages; only one visible at a time
    const pagesContainer = document.createElement('div');
    pagesContainer.className = 'line-agg-pages';
    containerElement.appendChild(pagesContainer);

    // ── Helper: show a specific page 
    function showPage(targetLineAgg) {
        // Hide all pages
        pagesContainer.querySelectorAll('.line-agg-page').forEach(page => {
            page.style.display = 'none';
        });

        // Show the target page
        const targetPage = pagesContainer.querySelector(`[data-line-agg="${CSS.escape(targetLineAgg)}"]`);
        if (targetPage) targetPage.style.display = 'block';

        // Update active button
        navBtnsContainer.querySelectorAll('.line-agg-nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-line-agg') === targetLineAgg);
        });
    }

    const getGlobalMaps = () => {
        const maxMap = {};
        const wMap = {};
        document.querySelectorAll('.global-max-qty').forEach(input => {
            maxMap[input.getAttribute('data-size')] = parseInt(input.value, 10) || 50;
        });
        document.querySelectorAll('.global-weight').forEach(input => {
            wMap[input.getAttribute('data-size')] = input.value;
        });
        return { maxMap, wMap };
    };

    const renderTriggers = [];

    // ── Build each LineAggregator page
    lineAggKeys.forEach((lineAgg, index) => {
        const items = groups[lineAgg];
        let totalQty = 0;

        // Nav button
        const navBtn = document.createElement('button');
        navBtn.className = 'line-agg-nav-btn pack-btn';
        navBtn.setAttribute('data-line-agg', lineAgg);
        navBtn.innerText = lineAgg;
        navBtn.addEventListener('click', () => showPage(lineAgg));
        navBtnsContainer.appendChild(navBtn);

        // Page div — each LineAggregator lives in its own page
        const page = document.createElement('div');
        page.className = 'line-agg-page';
        page.setAttribute('data-line-agg', lineAgg);
        page.style.display = 'none'; // hidden until nav button clicked

        const lineAggSection = document.createElement('div');
        lineAggSection.className = 'line-agg-section';
        lineAggSection.innerHTML = `<h3>Line Aggregator: ${escapeHTML(lineAgg)}</h3>`;

        const tablesContainer = document.createElement('div');
        tablesContainer.className = 'tables-container';

        const originalTableWrapper = document.createElement('div');
        originalTableWrapper.className = 'original-table-wrapper';

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Size</th>
                    <th>Item Sequence Number</th>
                    <th>Ship Mode</th>
                    <th>Item Status</th>
                    <th>Quantity</th>
                    <th>Upper Variance</th>
                    <th>Lower Variance</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        items.forEach((item) => {
            const bi = item.baseItem || {};
            const ref = bi.reference || {};
            const id = bi.itemIdentifier || {};
            const itemVar = bi.itemVariance || {};
            const qty = parseFloat(bi.quantity || 0);
            totalQty += qty;

            tbody.innerHTML += `
                <tr>
                    <td><span class="size">${escapeHTML(id.IdBuyerSize)}</span></td>
                    <td><span class="description">${escapeHTML(id.ItemSequenceNumber)}</span></td>
                    <td><span class="brand">${escapeHTML(ref.AdidasShipMode)}</span></td>
                    <td><span class="status">${escapeHTML(ref.ItemStatus)}</span></td>
                    <td><span class="qty">${escapeHTML(bi.quantity)}</span></td>
                    <td><span class="qty">${escapeHTML(itemVar.upperVariance || 0)}</span></td>
                    <td><span class="qty">${escapeHTML(itemVar.lowerVariance || 0)}</span></td>
                </tr>
            `;
        });

        tbody.innerHTML += `
            <tr class="total-row">
                <td colspan="4"><strong class="bold-text">TOTAL QUANTITY</strong></td>
                <td><strong class="bold-text">${totalQty}</strong></td>
            </tr>
        `;
        originalTableWrapper.appendChild(table);

        const packingContainer = document.createElement('div');
        packingContainer.className = 'packing-container';
        packingContainer.id = `packing-${lineAgg.replace(/\W/g, '_')}`;

        tablesContainer.appendChild(originalTableWrapper);
        tablesContainer.appendChild(packingContainer);
        lineAggSection.appendChild(tablesContainer);
        page.appendChild(lineAggSection);
        pagesContainer.appendChild(page);

        const initialMaps = getGlobalMaps();
        createPackingUI(items, packingContainer, initialMaps.maxMap, initialMaps.wMap);

        renderTriggers.push(() => {
            const maps = getGlobalMaps();
            createPackingUI(items, packingContainer, maps.maxMap, maps.wMap);
        });
    });

    // Show the first LineAggregator page by default
    if (lineAggKeys.length > 0) {
        showPage(lineAggKeys[0]);
    }

    // Apply Defaults button
    const applyBtn = document.getElementById('apply-globals-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            renderTriggers.forEach(trigger => trigger());
        });
    }

    // Export button
    const globalExportBtn = document.createElement('button');
    globalExportBtn.className = 'pack-btn global-export-btn';
    globalExportBtn.innerText = 'Export All to JSON';
    globalExportBtn.onclick = () => extractOrderDataToJson(orderData);
    
    containerElement.appendChild(globalExportBtn);

    // ── Summary button
    const summaryBtn = document.createElement('button');
    summaryBtn.className = 'pack-btn summary-btn';
    summaryBtn.style.backgroundColor = '#1E3A5F'; 
    summaryBtn.style.marginRight = '10px';
    summaryBtn.innerText = 'View Changes Summary';
    
    summaryBtn.onclick = () => showSummaryModal(containerElement);
    containerElement.appendChild(summaryBtn);

}

export function createPackingUI(items, packingContainer, globalMaxQtyMap = {}, globalWeightMap = {}) {
    packingContainer.innerHTML = '';
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

    renderPackingTable(items, maxQtyMap, weightMap, packingContainer);
}

function renderPackingTable(items, maxQtyMap, weightMap, container) {
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

            if (!placed) {
                batches.push([{ size, qty, seqNo }]);
            }
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
                <tr>
                    ${sizes.map(s => `<th>${s}</th>`).join('')}
                </tr>
                <tr class="input-row">
                    <td colspan="1" class="input-label">Input max quantity per box:</td>
                    ${sizes.map(s => `
                        <td>
                            <input type="number" class="max-qty-header-input" data-size="${s}" value="${maxQtyMap[s] || ''}" placeholder="Qty" min="1">
                        </td>
                    `).join('')}
                    <td colspan="2"></td>
                </tr>
                <tr class="input-row">
                    <td colspan="1" class="input-label">Input weight</td>
                    ${sizes.map(s => `
                        <td>
                            <input type="number" class="weight-header-input" data-size="${s}" min="0" step="0.1" placeholder="0.0" value="${weightMap[s] || ''}">
                        </td>
                    `).join('')}
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

                    let rowHtml = `<tr><td class="bold-text">${ctnString}</td>`;
                    sizes.forEach(s => {
                        rowHtml += `<td>${s === currentSize ? `<input type="text" value="${maxQty}" class="transparent-input" data-seq="${item.seqNo}" readonly>` : ''}</td>`;
                    });
                    rowHtml += `<td class="highlight-cell">${fullCartons}</td><td class="highlight-cell">${fullCartons * maxQty}</td></tr>`;
                    html += rowHtml;
                    cartonNo = endCtn + 1;
                }

                if (remainder > 0) {
                    let rowHtml = `<tr><td class="bold-text">${cartonNo}</td>`;
                    sizes.forEach(s => {
                        rowHtml += `<td>${s === currentSize ? `<input type="text" value="${remainder}" class="transparent-input" data-seq="${item.seqNo}" readonly>` : ''}</td>`;
                    });
                    rowHtml += `<td class="highlight-cell">1</td><td class="highlight-cell">${remainder}</td></tr>`;
                    html += rowHtml;
                    cartonNo++;
                }
            }
        });
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    const headerInputs = container.querySelectorAll('.max-qty-header-input');
    headerInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            const updatedSize = e.target.getAttribute('data-size');
            const newValue = parseInt(e.target.value, 10);

            if (newValue && newValue > 0) {
                maxQtyMap[updatedSize] = newValue;
                renderPackingTable(items, maxQtyMap, weightMap, container);
            } else {
                alert('Please enter a valid number greater than 0');
                e.target.value = maxQtyMap[updatedSize] || '';
            }
        });
    });

    const weightInputs = container.querySelectorAll('.weight-header-input');
    weightInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const updatedSize = e.target.getAttribute('data-size');
            weightMap[updatedSize] = e.target.value;
        });
    });
}

// Generates and displays a modal with all changes made to packing settings.

function showSummaryModal(container) {
    const data = [];
    const defaultQty = 50; // Defined in global settings 
    const defaultWeight = "0.0";

    // Select all unique sizes from the UI
    const sizes = Array.from(new Set([...container.querySelectorAll('[data-size]')].map(el => el.getAttribute('data-size'))));

    sizes.forEach(size => {
        // Find the specific inputs for this size in the packing tables 
        const qtyInput = container.querySelector(`.max-qty-header-input[data-size="${size}"]`);
        const weightInput = container.querySelector(`.weight-header-input[data-size="${size}"]`);

        const currentQty = qtyInput ? parseInt(qtyInput.value, 10) : defaultQty;
        const currentWeight = weightInput ? weightInput.value : defaultWeight;

        // Only track if values differ from the standard defaults
        if (currentQty !== defaultQty || (currentWeight !== defaultWeight && currentWeight !== "")) {
            data.push({
                size,
                qty: currentQty,
                isQtyChanged: currentQty !== defaultQty,
                weight: currentWeight || "0.0",
                isWeightChanged: currentWeight !== defaultWeight && currentWeight !== ""
            });
        }
    });

    renderSummaryModal(data);
}

// Creates the Modal UI for the summary
 
function renderSummaryModal(changes) {
    // Remove existing modal if it exists
    const existing = document.getElementById('summary-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'summary-modal-overlay';
    overlay.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); display: flex; align-items: center;
        justify-content: center; z-index: 10000; font-family: sans-serif;
    `;

    const modal = document.createElement('div');
    modal.style = `
        background: #fff; padding: 25px; border-radius: 8px;
        max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    `;

    let tableContent = changes.length > 0 
        ? changes.map(c => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${c.size}</strong></td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; color: ${c.isQtyChanged ? '#d32f2f' : '#333'}">
                    ${c.qty} ${c.isQtyChanged ? '<b>(Edited)</b>' : ''}
                </td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; color: ${c.isWeightChanged ? '#d32f2f' : '#333'}">
                    ${c.weight} ${c.isWeightChanged ? '<b>(Edited)</b>' : ''}
                </td>
            </tr>
        `).join('')
        : '<tr><td colspan="3" style="text-align:center; padding: 20px;">No changes made to defaults.</td></tr>';

    modal.innerHTML = `
        <h2 style="margin-top: 0;">Packing Changes Summary</h2>
        <p style="color: #666; font-size: 0.9em;">Comparing current values against initial defaults (Qty: 50, Wght: 0.0).</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; text-align: left;">
            <thead>
                <tr style="background: #f5f5f5;">
                    <th style="padding: 10px;">Size</th>
                    <th style="padding: 10px;">Max Qty</th>
                    <th style="padding: 10px;">Weight</th>
                </tr>
            </thead>
            <tbody>${tableContent}</tbody>
        </table>
        <div style="margin-top: 25px; text-align: right;">
            <button id="close-summary" class="pack-btn" style="background: #333;">Close</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('close-summary').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
}