import { Utils } from './utils.js';
import { OrderExporter } from './export.js';
import { ApiClient } from './api.js';

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
        this.currentView = 'paginated';
        this.currentPage = 1;
        this.itemsPerPage = 5;
        this.container = null;
        this.globalMaxMap = {};
        this.sortedSizes = [];
    }

    load(orderData, container) {
        this.orderData = orderData;
        this.container = container;
        this.groups = {};
        this.tableConfigs = {};

        const sizes = new Set();
        orderData.orderItem.forEach(rawItem => {
            const item = new OrderItem(rawItem);
            (this.groups[item.lineAgg] ??= []).push(item);
            if (item.size && item.size !== '-') sizes.add(Utils.escapeHTML(item.size));
        });

        this.lineAggKeys = Object.keys(this.groups);
        this.sortedSizes = Array.from(sizes).sort(Utils.compareSizes);
    }

    get paginatedKeys() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        return this.lineAggKeys.slice(start, start + this.itemsPerPage);
    }

    get totalPages() { return Math.ceil(this.lineAggKeys.length / this.itemsPerPage); }

    ensureConfig(lineAgg, items) {
        if (this.tableConfigs[lineAgg]) return;
        const config = { maxQtyMap: {} };

        items.forEach(item => {
            const size = Utils.escapeHTML(item.size);
            if (item.qty > 0 && size !== '-') {
                config.maxQtyMap[size] = this.globalMaxMap[size] > 0 ? this.globalMaxMap[size] : 50;
            }
        });
        this.tableConfigs[lineAgg] = config;
    }
}

export class UIController {
    constructor(state) {
        this.state = state;
    }

    render() {
        this.state.container.innerHTML = '';

        if (this.state.currentView !== 'summary') {
            const topControlsWrap = Utils.el('div', {
                className: 'top-controls-wrapper',
                style: { display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '20px' }
            });

            this._renderSettings(topControlsWrap);

            const valWrap = Utils.el('div', { className: 'global-validation-container', style: { flex: '1 1 40%', overflowX: 'auto' } });
            topControlsWrap.appendChild(valWrap);

            // Gather all items globally for the single validation table
            const allItems = Object.values(this.state.groups).flat();
            new ValidationUI().render(allItems, valWrap);

            this.state.container.appendChild(topControlsWrap);
        }

        const uid = Utils.escapeHTML(this.state.orderData.__metadata?.uid || 'Unknown');
        const wrapper = Utils.el('div', {
            className: 'order-section',
            html: `<h2>Order Details (UID: <span class="uid-text">${uid}</span>)</h2>`
        });
        this.state.container.appendChild(wrapper);

        const viewRenderers = {
            summary: () => this._renderSummary(wrapper),
            all: () => this._renderAggregators(this.state.lineAggKeys, wrapper),
            paginated: () => {
                this._renderAggregators(this.state.paginatedKeys, wrapper);
                this._renderPagination(wrapper);
            }
        };
        viewRenderers[this.state.currentView]();

        const onLastPage = this.state.currentPage === this.state.totalPages || this.state.totalPages === 0;
        if (this.state.currentView === 'all' || (this.state.currentView === 'paginated' && onLastPage)) {
            const btn = Utils.el('button', { className: 'pack-btn global-export-btn', html: 'Export All to JSON' });
            btn.onclick = () => OrderExporter.extractToJson(this.state.orderData);
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
        `).join('');

        wrapper.appendChild(Utils.el('table', {
            html: `
                <thead><tr>
                <th>Size</th>
                <th>Seq #</th>
                <th>Ship Mode</th>
                <th>Status</th>
                <th>Qty</th>
                <th>Mfg Size</th>
                <th>Up Var</th>
                <th>Low Var</th>
                </tr></thead>
                <tbody>${rows}<tr class="total-row"><td colspan="4"><strong>TOTAL</strong></td><td><strong>${items.reduce((s, i) => s + i.qty, 0)}</strong></td></tr></tbody>
            `
        }));
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
        const unique = new Set();
        const batches = [];
        this.items.forEach(i => {
            if (isNaN(i.qty) || i.qty <= 0 || i.size === '-') return;
            const size = Utils.escapeHTML(i.size);
            unique.add(size);

            const existing = batches.find(b => !b.some(x => x.size === size));
            const data = { size, qty: i.qty, seqNo: Utils.escapeHTML(i.id.ItemSequenceNumber) };
            existing ? existing.push(data) : batches.push([data]);
        });
        return { sizes: Array.from(unique).sort(Utils.compareSizes), batches };
    }

    _getHTML(sizes, batches, maxQtyMap) {
        let rows = '', cartonNo = 1;

        batches.forEach(batch => {
            batch.sort((a, b) => Utils.compareSizes(a.size, b.size)).forEach(({ size, qty, seqNo }) => {
                const max = maxQtyMap[size];
                if (!max || max <= 0) return;

                const full = Math.floor(qty / max);
                const rem = qty % max;

                const makeRow = (lbl, val, cnt) => {
                    const cells = sizes.map(s => s === size ? `<td><input type="text" value="${val}" class="transparent-input" data-seq="${seqNo}" readonly></td>` : '<td></td>').join('');
                    return `<tr>
                    <td><strong>${lbl}</strong></td>${cells}
                    <td>${cnt}</td>
                    <td>${seqNo}</td>
                    <td>${cnt * val}</td>
                    </tr>`;
                };

                if (full > 0) {
                    const end = cartonNo + full - 1;
                    rows += makeRow(cartonNo === end ? cartonNo : `${cartonNo}-${end}`, max, full);
                    cartonNo = end + 1;
                }
                if (rem > 0) {
                    rows += makeRow(cartonNo++, rem, 1);
                }
            });
        });

        return `
            <table class="packing-table">
                <thead>
                    <tr>
                    <th rowspan="2">CTN NO</th>
                    <th colspan="${sizes.length}">SIZE</th>
                    <th rowspan="2">TOTAL CTNS</th><th rowspan="2">Seq #</th>
                    <th rowspan="2">SHIPMENT QNTY</th>
                    </tr>
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
                this.render();
            }
        }));
    }
}

export class ValidationUI {
    async render(items, container) {
        container.innerHTML = '<h4>Catalog Verification</h4><div class="loading">Fetching...</div>';
        const catalog = await ApiClient.fetchBulkCatalog();
        const buyers = [...new Set(items.map(i => i.buyerNumber).filter(Boolean))];

        // Grab the common Buyer Number for the header
        const mainBuyerNumber = buyers.length > 0 ? buyers[0] : 'Unknown';

        let rows = '';
        buyers.forEach(bNum => {
            const reqSizes = [...new Set(items.filter(i => i.buyerNumber === bNum).map(i => i.mfgSize))];
            const found = catalog.result?.filter(c => c.itemAttribute?.buyerItemNumber === bNum) || [];

            if (!found.length) {
                rows += `<tr class="error-text"><td colspan="2">No data found for Buyer ${Utils.escapeHTML(bNum)}</td></tr>`;
                return;
            }

            reqSizes.forEach(size => {
                const catalogItem = found.find(c => c.itemAttribute?.ManufacturingSize === size);
                const ok = !!catalogItem;

                // Pull value, defaulting to empty string if missing so the input field remains clean
                const netWeight = catalogItem?.itemAttribute?.['measurements/netWeight'] || '';

                // Apply color class to the whole row
                rows += `<tr class="${ok ? 'success-text' : 'error-text'}">
                    <td>${Utils.escapeHTML(size)}</td>
                    <td><input type="number" step="0.01" class="val-weight-input" value="${Utils.escapeHTML(netWeight)}" placeholder="Weight"></td>
                </tr>`;
            });
        });

        container.innerHTML = `<h4>Catalog Verification (Buyer No: ${Utils.escapeHTML(mainBuyerNumber)})</h4>
        <table class="validation-table">
            <thead>
                <tr>
                    <th>Listed Size</th>
                    <th>Net Weight</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
    }
}