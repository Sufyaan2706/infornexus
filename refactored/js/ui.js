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

        // MOQ properties
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

        // If a config already exists, prune any sizes that are no longer valid, then return.
        if (existing) {
            Object.keys(existing.maxQtyMap).forEach(size => {
                if (!validSizes.has(size)) delete existing.maxQtyMap[size];
            });
            return;
        }

        // No config yet — create one from scratch using globalMaxMap defaults.
        const maxQtyMap = {};
        validSizes.forEach(size => {
            maxQtyMap[size] = this.globalMaxMap[size] > 0 ? this.globalMaxMap[size] : 50;
        });
        this.tableConfigs[lineAgg] = { maxQtyMap };
    }
}

export class UIController {
    constructor(state) {
        this.state = state;
    }

    render() {
        this.state.container.innerHTML = '';

        if (this.state.currentView !== 'summary') {
            this._renderTopControls();
        }

        const uid = Utils.escapeHTML(this.state.orderData.__metadata?.uid || 'Unknown');
        const wrapper = Utils.el('div', {
            className: 'order-section',
            html: `<h2>Order Details (UID: <span class="uid-text">${uid}</span>)</h2>`
        });
        this.state.container.appendChild(wrapper);

        this._renderActiveView(wrapper);
        this._renderExportButton();
    }

    _renderTopControls() {
        const topControlsWrap = Utils.el('div', {
            className: 'top-controls-wrapper',
            style: { display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }
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
            // Clear all cached configs so ensureConfig rebuilds them
            // against the newly filtered item sets.
            this.state.tableConfigs = {};
            this.state.load(this.state.orderData, this.state.container);
            this.render();
        };

        topControlsWrap.appendChild(moqBar);

        // Container for Max Qty settings and Validation
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


    _renderExportButton() {
        const onLastPage = this.state.currentPage === this.state.totalPages || this.state.totalPages === 0;
        if (this.state.currentView === 'all' || (this.state.currentView === 'paginated' && onLastPage)) {
            const btn = Utils.el('button', { className: 'pack-btn global-export-btn', html: 'Log JSON to Console' });

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

        const applyBtn = Utils.el('button', { className: 'pack-btn', html: 'Apply Defaults' });
        applyBtn.onclick = () => {
            document.querySelectorAll('.global-max-qty').forEach(i => this.state.globalMaxMap[i.dataset.size] = parseInt(i.value, 10));
            (this.state.currentView === 'all' ? this.state.lineAggKeys : this.state.paginatedKeys)
                .forEach(k => delete this.state.tableConfigs[k]);
            this.render();
        };

        wrap.append(grid, Utils.el('div', { className: 'global-apply-block' }).appendChild(applyBtn).parentNode);
        parentContainer.appendChild(wrap);
    }

    _renderSummary(wrapper) {
        // Global Totals Indicator Header
        const statsHeader = Utils.el('div', {
            className: 'global-stats-summary',
            style: { marginBottom: '20px', padding: '15px', border: '1px solid #ddd', background: '#f9f9f9', borderRadius: '4px' }
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

    _renderAggregators(keys, wrapper) {
        keys.forEach(agg => {
            const items = this.state.groups[agg];
            const section = Utils.el('div', { className: 'line-agg-section' });
            section.appendChild(Utils.el('h3', { html: `Line Aggregator: ${Utils.escapeHTML(agg)}` }));

            const tables = Utils.el('div', { className: 'tables-container' });
            tables.appendChild(this._buildDataTable(items));

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

    _getBatches() {
        const uniqueSizes = new Set();
        const batches = [];

        this.items.forEach(i => {
            if (isNaN(i.qty) || i.qty <= 0 || i.size === '-') return;
            const size = Utils.escapeHTML(i.size);
            uniqueSizes.add(size);

            const existingBatch = batches.find(b => !b.some(x => x.size === size));
            const data = { size, qty: i.qty, seqNo: Utils.escapeHTML(i.id.ItemSequenceNumber) };
            existingBatch ? existingBatch.push(data) : batches.push([data]);
        });

        return { sizes: Array.from(uniqueSizes).sort(Utils.compareSizes), batches };
    }

    _getHTML(sizes, batches, maxQtyMap) {
        let rows = '', cartonNo = 1;
        const currentPackingLines = []; // Capture structural data for the exporter

        batches.forEach(batch => {
            batch.sort((a, b) => Utils.compareSizes(a.size, b.size)).forEach(({ size, qty, seqNo }) => {
                const max = maxQtyMap[size];
                if (!max || max <= 0) return;

                const full = Math.floor(qty / max);
                const rem = qty % max;

                const makeRow = (lbl, val, cnt) => {
                    currentPackingLines.push({
                        cartonLabel: lbl,
                        size: size,
                        qtyPerCarton: val,
                        cartonCount: cnt,
                        sequenceNumber: seqNo,
                        totalShipmentQty: cnt * val
                    });

                    const cells = sizes.map(s => s === size ? `<td><input type="text" value="${val}" class="transparent-input" data-seq="${seqNo}" readonly></td>` : '<td></td>').join('');
                    return `<tr><td><strong>${lbl}</strong></td>
                    ${cells}<td>${cnt}</td>
                    <td>${seqNo}</td>
                    <td>${cnt * val}</td></tr>`;
                };

                if (full > 0) {
                    const end = cartonNo + full - 1;
                    rows += makeRow(cartonNo === end ? String(cartonNo) : `${cartonNo}-${end}`, max, full);
                    cartonNo = end + 1;
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

                // Seed initial state so default weights show up in JSON even without user editing
                if (!this.state.validationWeights[size]) {
                    this.state.validationWeights[size] = netWeight;
                }

                // Add data-size to input so the listener knows which size was updated
                rows.push(`
                    <tr class="${ok ? 'success-text' : 'error-text'}">
                        <td>${Utils.escapeHTML(size)}</td>
                        <td><input type="number" step="0.01" class="val-weight-input" data-size="${Utils.escapeHTML(size)}" value="${Utils.escapeHTML(this.state.validationWeights[size])}" placeholder="Weight"></td>
                    </tr>
                `);
            });
        });

        return rows;
    }
}