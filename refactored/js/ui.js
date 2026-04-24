import { Utils } from './utils.js';
import { ApiClient } from './api.js';
import { OrderExporter } from './export.js';

export class OrderItem {
    constructor(item) {
        this.bi = item.baseItem || {};
        this.ref = this.bi.reference || {};
        this.id = this.bi.itemIdentifier || {};
        this.vr = this.bi.itemVariance || {};

        this.size = this.id.IdBuyerSize;
        this.lineAgg = this.ref.LineAggregator ?? 'Unknown';
        this.qty = parseFloat(this.bi.quantity || 0);
        this.buyerNumber = this.id.BuyerNumber;
        this.mfgSize = this.ref.ManufacturingSize;
    }
}

export class AppState {
    constructor() {
        this.orderData = null;
        this.groups = {};
        this.lineAggKeys = [];
        this.tableConfigs = {};

        this.packingData = {};
        this.validationWeights = {};

        this.currentView = 'paginated';
        this.currentPage = 1;
        this.itemsPerPage = 5;
        this.container = null;
        this.globalMaxMap = {};
        this.sortedSizes = [];

        this.moqValue = 8;
        this.globalSizeTotals = {};
    }

    load(orderData, container) {
        this.orderData = orderData;
        this.container = container;
        this.tableConfigs = {};
        this.packingData = {};

        const allParsedItems = orderData.orderItem.map(raw => new OrderItem(raw));

        // 1. Calculate the "True" Global Totals for every size across all aggregators
        this.globalSizeTotals = {};
        allParsedItems.forEach(item => {
            const s = item.size || 'Unknown';
            this.globalSizeTotals[s] = (this.globalSizeTotals[s] || 0) + item.qty;
        });

        // 2. Filter items based on the current MOQ
        const filteredItems = allParsedItems.filter(item =>
            this.globalSizeTotals[item.size] >= this.moqValue
        );

        // Group the remaining filtered items
        this.groups = Utils.groupBy(filteredItems, 'lineAgg');
        this.lineAggKeys = Object.keys(this.groups);

        const sizes = new Set(filteredItems
            .map(item => item.size)
            .filter(size => size && size !== '-')
            .map(Utils.escapeHTML)
        );
        this.sortedSizes = Array.from(sizes).sort(Utils.compareSizes);
    }

    get paginatedKeys() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        return this.lineAggKeys.slice(start, start + this.itemsPerPage);
    }

    get totalPages() {
        return Math.ceil(this.lineAggKeys.length / this.itemsPerPage);
    }

    ensureConfig(lineAgg, items) {

        const validSizes = new Set(
            items
                .filter(item => item.qty > 0 && item.size && item.size !== '-')
                .map(item => Utils.escapeHTML(item.size))
        );

        const existing = this.tableConfigs[lineAgg];

        if (existing) {
            Object.keys(existing.maxQtyMap).forEach(size => {
                if (!validSizes.has(size)) delete existing.maxQtyMap[size];
            });
            return;
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
        this.tableConfigs[lineAgg] = { maxQtyMap };
    }
}

export class UIController {
    constructor(state) {
        this.state = state;
    }

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

        const uid = Utils.escapeHTML(this.state.orderData.__metadata?.uid || 'Unknown');
        const wrapper = Utils.el('div', {
            className: 'order-section',
            html: `<h2>Order Details (UID: <span class="uid-text">${uid}</span>)</h2>`
        });
        this.state.container.appendChild(wrapper);

        this._renderActiveView(wrapper);
        this._renderExportButton();
    }

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

        // MOQ Settings Bar
        const moqBar = Utils.el('div', {
            className: 'moq-settings-bar',
            style: { background: '#f4f4f4', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }
        });

        moqBar.innerHTML = `
            <strong>Global MOQ Filter:</strong>
            <input type="number" id="moq-input" value="${this.state.moqValue}" min="0" style="width: 80px; margin: 0 10px;">
            <button id="apply-moq-btn" class="pack-btn">Update MOQ</button>
            <small style="margin-left: 10px; color: #666;">(Sizes with total qty below this threshold will be hidden)</small>
        `;

        moqBar.querySelector('#apply-moq-btn').onclick = () => {
            const val = parseInt(document.getElementById('moq-input').value, 10);
            this.state.moqValue = isNaN(val) ? 0 : val;
            this.state.tableConfigs = {};
            this.state.load(this.state.orderData, this.state.container);
            this.render();
        };

        topControlsWrap.appendChild(moqBar);

        const settingsFlex = Utils.el('div', { style: { display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' } });

        this._renderSettings(settingsFlex);

        const valWrap = Utils.el('div', { className: 'global-validation-container', style: { flex: '1 1 40%', overflowX: 'auto' } });
        settingsFlex.appendChild(valWrap);

        const allItems = Object.values(this.state.groups).flat();
        new ValidationUI(this.state).render(allItems, valWrap);

        topControlsWrap.appendChild(settingsFlex);
        this.state.container.appendChild(topControlsWrap);
    }

    _renderActiveView(wrapper) {
        const views = {
            summary: () => this._renderSummary(wrapper),
            all: () => this._renderAggregators(this.state.lineAggKeys, wrapper),
            paginated: () => {
                this._renderAggregators(this.state.paginatedKeys, wrapper);
                this._renderPagination(wrapper);
            }
        };
        views[this.state.currentView]();
    }


        tablesContainer.appendChild(originalTableWrapper);
        tablesContainer.appendChild(packingContainer);
        lineAggSection.appendChild(tablesContainer);
        page.appendChild(lineAggSection);
        pagesContainer.appendChild(page);

            btn.onclick = () => {
                OrderExporter.extractToJson(this.state);
            };

            this.state.container.appendChild(btn);
        }
    }


    _renderSettings(parentContainer) {
        const wrap = Utils.el('div', { className: 'global-settings', style: { flex: '1 1 50%' } });
        wrap.appendChild(Utils.el('h3', { html: 'Default Settings Per Size' }));

        const grid = Utils.el('div', { className: 'global-sizes-container' });
        this.state.sortedSizes.forEach(size => {
            grid.appendChild(Utils.el('div', {
                className: 'global-size-block',
                html: `
                    <strong>${size}</strong>
                    <div class="input-group input-group-margin">
                        Max Qty:<br>
                        <input type="number" class="global-max-qty" data-size="${size}" value="${this.state.globalMaxMap[size] || 50}" min="1">
                    </div>
                `
            }));
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

        let statsHtml = '<h4 style="margin-top:0;">Global Size Totals (All Aggregators)</h4><div style="display: flex; gap: 10px; flex-wrap: wrap;">';
        Object.entries(this.state.globalSizeTotals).sort((a, b) => Utils.compareSizes(a[0], b[0])).forEach(([size, total]) => {
            const isExcluded = total < this.state.moqValue;
            statsHtml += `
                <div class="size-stat-badge" style="padding: 5px 10px; border: 1px solid #ccc; border-radius: 4px; background: ${isExcluded ? '#ffebee' : '#e8f5e9'}">
                    <strong style="color: ${isExcluded ? '#c62828' : '#2e7d32'}">${Utils.escapeHTML(size)}:</strong> ${total}
                    ${isExcluded ? ' <small>(Hidden)</small>' : ''}
                </div>`;
        });
        statsHtml += '</div>';
        statsHeader.innerHTML = statsHtml;
        wrapper.appendChild(statsHeader);

        // Individual Aggregator Sections
        const container = Utils.el('div', { className: 'summary-view-container' });
        this.state.lineAggKeys.forEach((agg, index) => {
            const items = this.state.groups[agg];
            const section = Utils.el('div', { className: 'line-agg-section' });

            const btn = Utils.el('button', { className: 'nav-btn', html: 'Go to Editor' });
            btn.onclick = () => {
                this.state.currentView = 'paginated';
                this.state.currentPage = Math.ceil((index + 1) / this.state.itemsPerPage);
                this.render();
            };

            const header = Utils.el('div', { className: 'summary-header', html: `<h3>Line Aggregator: ${Utils.escapeHTML(agg)}</h3>` });
            header.appendChild(btn);

            const packWrap = Utils.el('div', { className: 'packing-container', style: { overflowX: 'auto' } });
            new PackingUI(this.state, items, packWrap, agg).build();

            section.append(header, packWrap);
            container.appendChild(section);
        });
        wrapper.appendChild(container);
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

            const packWrap = Utils.el('div', { className: 'packing-container', id: `packing-${agg.replace(/\W/g, '_')}` });
            new PackingUI(this.state, items, packWrap, agg).build();
            tables.appendChild(packWrap);

            section.appendChild(tables);
            wrapper.appendChild(section);
        });
    }

    _buildDataTable(items) {
        const wrapper = Utils.el('div', { className: 'original-table-wrapper' });
        const headers = ['Size', 'Seq #', 'Ship Mode', 'Status', 'Qty', 'Mfg Size', 'Up Var', 'Low Var'];

        const rows = items.map(i => `
            <tr>
                <td>${Utils.escapeHTML(i.size)}</td>
                <td>${Utils.escapeHTML(i.id.ItemSequenceNumber)}</td>
                <td>${Utils.escapeHTML(i.ref.AdidasShipMode)}</td>
                <td>${Utils.escapeHTML(i.ref.ItemStatus)}</td>
                <td>${Utils.escapeHTML(i.qty)}</td>
                <td>${Utils.escapeHTML(i.mfgSize)}</td>
                <td>${Utils.escapeHTML(i.vr.upperVariance)}</td>
                <td>${Utils.escapeHTML(i.vr.lowerVariance)}</td>
            </tr>
        `);

        const totalQty = items.reduce((s, i) => s + i.qty, 0);
        const footer = `<td colspan="4"><strong>TOTAL</strong></td><td><strong>${totalQty}</strong></td><td colspan="3"></td>`;

        wrapper.appendChild(Utils.buildTable(headers, rows, footer));
        return wrapper;
    }

    _renderPagination(wrapper) {
        if (this.state.totalPages <= 1) return;
        const controls = Utils.el('div', { className: 'pagination-controls' });
        for (let i = 1; i <= this.state.totalPages; i++) {
            const btn = Utils.el('button', { className: `page-btn ${i === this.state.currentPage ? 'active-page' : ''}`, html: String(i) });
            btn.onclick = () => { this.state.currentPage = i; this.render(); };
            controls.appendChild(btn);
        }
        wrapper.appendChild(controls);
    }
}

export class PackingUI {
    constructor(state, items, container, lineAgg) {
        this.state = state;
        this.items = items;
        this.container = container;
        this.lineAgg = lineAgg;
    }

    build() {
        this.state.ensureConfig(this.lineAgg, this.items);
        this.render();
    }

    render() {
        const { maxQtyMap } = this.state.tableConfigs[this.lineAgg];
        const { sizes, batches } = this._getBatches();

        if (!batches.length) {
            this.container.innerHTML = '<div class="empty-pack-msg">No valid items found.</div>';
            return;
        }

        this.container.innerHTML = this._getHTML(sizes, batches, maxQtyMap);
        this._attachListeners();
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
                if (rem > 0) {
                    rows += makeRow(String(cartonNo++), rem, 1);
                }
            });
        });

        // Save generated lines to state
        this.state.packingData[this.lineAgg] = currentPackingLines;

        return `
            <table class="packing-table">
                <thead>
                    <tr><th rowspan="2">CTN NO</th><th colspan="${sizes.length}">SIZE</th><th rowspan="2">TOTAL CTNS</th>
                    <th rowspan="2">Seq #</th>
                    <th rowspan="2">SHIPMENT QNTY</th></tr>
                    <tr>${sizes.map(s => `<th>${s}</th>`).join('')}</tr>
                    <tr><td>Max qty/box:</td>${sizes.map(s => `<td><input type="number" class="max-qty-header-input" data-size="${s}" value="${maxQtyMap[s] || ''}" min="1"></td>`).join('')}<td colspan="2"></td></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    _attachListeners() {
        this.container.querySelectorAll('.max-qty-header-input').forEach(i => i.addEventListener('change', e => {
            const val = parseInt(e.target.value, 10);
            if (val > 0) {
                this.state.tableConfigs[this.lineAgg].maxQtyMap[e.target.dataset.size] = val;
                this.render(); // This recalculates and overwrites `state.packingData` automatically!
            }
        }));
    }
}

export class ValidationUI {
    constructor(state) {
        this.state = state;
    }

    async render(items, container) {
        container.innerHTML = '<h4>Catalog Verification</h4><div class="loading">Fetching...</div>';
        const catalog = await ApiClient.fetchBulkCatalog();
        const buyers = [...new Set(items.map(i => i.buyerNumber).filter(Boolean))];

        const mainBuyerNumber = buyers.length > 0 ? buyers[0] : 'Unknown';
        const catalogItems = catalog?.item || catalog?.result || catalog || [];

        const allDisplaySizes = [...new Set(
            items.map(i => i.size).filter(s => s && s !== '-')
        )].sort(Utils.compareSizes);

        const rows = this._buildValidationRows(buyers, catalogItems, items, allDisplaySizes);
        const headers = ['Listed Size', 'Net Weight'];

        container.innerHTML = `<h4>Catalog Verification (Buyer No: ${Utils.escapeHTML(mainBuyerNumber)})</h4>`;
        container.appendChild(Utils.buildTable(headers, rows, '', 'validation-table'));

        // Attach listeners to grab the user's manual weight changes!
        container.querySelectorAll('.val-weight-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const size = e.target.dataset.size;
                this.state.validationWeights[size] = e.target.value;
            });
        });
    }

    _buildValidationRows(buyers, catalogItems, items, allDisplaySizes) {
        let rows = [];

        buyers.forEach(bNum => {
            const found = catalogItems.filter(c => String(c.itemAttribute?.buyerItemNumber) === String(bNum));
            const reqSizes = found.length
                ? [...new Set(items.filter(i => i.buyerNumber === bNum).map(i => i.mfgSize))]
                : allDisplaySizes;

            reqSizes.forEach(size => {
                const catalogItem = found.length
                    ? found.find(c => String(c.itemAttribute?.ManufacturingSize) === String(size))
                    : null;
                const ok = !!catalogItem;
                const netWeight = catalogItem?.itemAttribute?.['measurements/netWeight'] || '';

                if (!this.state.validationWeights[size]) {
                    this.state.validationWeights[size] = netWeight;
                }

                rows.push(`
                    <tr class="${ok ? 'success-text' : 'error-text'}">
                        <td>${Utils.escapeHTML(size)}</td>
                        <td><input type="number" step="0.01" class="val-weight-input" data-size="${Utils.escapeHTML(size)}" value="${Utils.escapeHTML(this.state.validationWeights[size])}" placeholder="Weight"></td>
                    </tr>
                `);
            });
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