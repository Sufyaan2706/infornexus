import { escapeHTML, compareSizes } from './utils.js';
import { extractOrderDataToJson } from './export.js';
import { checkCatalogForItem } from './api.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a DOM element with optional className and innerHTML. */
function el(tag, { className, html, style } = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    if (style) Object.assign(node.style, style);
    return node;
}

/** Resolve baseItem sub-objects from an order item. */
function resolveItem(item) {
    const bi = item.baseItem || {};
    const ref = bi.reference || {};
    const id = bi.itemIdentifier || {};
    const vr = bi.itemVariance || {};
    return { bi, ref, id, vr };
}

// ─── AppState ────────────────────────────────────────────────────────────────

class AppState {
    constructor() {
        this.orderData = null;
        this.groups = {};
        this.lineAggKeys = [];
        this.tableConfigs = {};
        this.currentView = 'paginated';
        this.currentPage = 1;
        this.itemsPerPage = 5;
        this.containerElement = null;
        this.globalMaxMap = {};
        this.globalWeightMap = {};
        this.sortedGlobalSizes = [];
    }

    /** Populate groups & sizes from raw orderData. */
    load(orderData, containerElement) {
        this.orderData = orderData;
        this.containerElement = containerElement;
        this.groups = {};
        this.tableConfigs = {};

        const allSizes = new Set();

        orderData.orderItem.forEach(item => {
            const { ref, id } = resolveItem(item);
            const key = ref.LineAggregator ?? 'Unknown';
            (this.groups[key] ??= []).push(item);
            const size = id.IdBuyerSize;
            if (size && size !== '-') allSizes.add(escapeHTML(size));
        });

        this.lineAggKeys = Object.keys(this.groups);
        this.sortedGlobalSizes = Array.from(allSizes).sort(compareSizes);
    }

    /** Return the slice of lineAggKeys for the current paginated view. */
    get paginatedKeys() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        return this.lineAggKeys.slice(start, start + this.itemsPerPage);
    }

    get totalPages() {
        return Math.ceil(this.lineAggKeys.length / this.itemsPerPage);
    }

    /** Ensure a tableConfig exists for lineAgg, seeded from global maps. */
    ensureTableConfig(lineAgg, items) {
        if (this.tableConfigs[lineAgg]) return;

        const maxQtyMap = {};
        const weightMap = {};

        items.forEach(item => {
            const { bi, id } = resolveItem(item);
            const size = escapeHTML(id.IdBuyerSize);
            const qty = parseInt(bi.quantity, 10);
            if (!isNaN(qty) && qty > 0 && size !== '-') {
                maxQtyMap[size] = this.globalMaxMap[size] > 0 ? this.globalMaxMap[size] : 50;
                weightMap[size] = this.globalWeightMap[size] ?? '';
            }
        });

        this.tableConfigs[lineAgg] = { maxQtyMap, weightMap };
    }
}

const state = new AppState();

// ─── NavigationController ────────────────────────────────────────────────────

class NavigationController {
    constructor() {
        this.viewControls = document.getElementById('viewControls');
        this.btns = {
            summary: document.getElementById('viewSummaryBtn'),
            paginated: document.getElementById('viewPaginatedBtn'),
            all: document.getElementById('viewAllBtn'),
        };
    }

    setup() {
        if (this.viewControls) this.viewControls.style.display = 'inline-flex';

        const setView = (name, resetPage = false) => {
            state.currentView = name;
            if (resetPage) state.currentPage = 1;
            this._highlightBtn(name);
            renderCurrentView();
        };

        this.btns.summary.onclick = () => setView('summary');
        this.btns.paginated.onclick = () => setView('paginated', true);
        this.btns.all.onclick = () => setView('all');

        this._syncItemsPerPageInput();
    }

    _highlightBtn(activeView) {
        Object.entries(this.btns).forEach(([name, btn]) =>
            btn.classList.toggle('active-view', name === activeView)
        );
    }

    _syncItemsPerPageInput() {
        const input = document.getElementById('itemsPerPage');
        if (!input) return;

        const parsed = parseInt(input.value, 10);
        if (!isNaN(parsed) && parsed > 0) state.itemsPerPage = parsed;

        input.oninput = e => {
            const val = parseInt(e.target.value, 10);
            if (val > 0) {
                state.itemsPerPage = val;
                state.currentPage = 1;
                if (state.currentView === 'paginated') renderCurrentView();
            }
        };

        input.onchange = e => {
            const val = parseInt(e.target.value, 10);
            if (isNaN(val) || val <= 0) e.target.value = state.itemsPerPage;
        };
    }
}

// ─── Renderers ───────────────────────────────────────────────────────────────

class GlobalSettingsRenderer {
    render() {
        const wrap = el('div', { className: 'global-settings' });
        wrap.appendChild(el('h3', { html: 'Default Settings Per Size' }));

        const grid = el('div', { className: 'global-sizes-container' });

        state.sortedGlobalSizes.forEach(size => {
            grid.appendChild(el('div', {
                className: 'global-size-block',
                html: `
                    <strong>${size}</strong>
                    <div class="input-group input-group-margin">
                        Max Qty:<br>
                        <input type="number" class="global-max-qty" data-size="${size}"
                            value="${state.globalMaxMap[size] || 50}" min="1">
                    </div>
                    <div class="input-group">
                        Weight:<br>
                        <input type="number" class="global-weight" data-size="${size}"
                            step="0.1" min="0" placeholder="0.0"
                            value="${state.globalWeightMap[size] || ''}">
                    </div>
                `,
            }));
        });

        const applyBtn = el('button', { className: 'pack-btn', html: 'Apply Defaults to Displayed Tables' });
        applyBtn.onclick = () => this._applyDefaults();

        const applyBlock = el('div', { className: 'global-apply-block' });
        applyBlock.appendChild(applyBtn);

        wrap.appendChild(grid);
        wrap.appendChild(applyBlock);
        state.containerElement.appendChild(wrap);
    }

    _applyDefaults() {
        document.querySelectorAll('.global-max-qty').forEach(input =>
            state.globalMaxMap[input.dataset.size] = parseInt(input.value, 10)
        );
        document.querySelectorAll('.global-weight').forEach(input =>
            state.globalWeightMap[input.dataset.size] = input.value
        );

        const keysToReset = state.currentView === 'all'
            ? state.lineAggKeys
            : state.paginatedKeys;

        keysToReset.forEach(key => delete state.tableConfigs[key]);
        renderCurrentView();
    }
}

class SummaryRenderer {
    render(wrapper) {
        const container = el('div', { className: 'summary-view-container' });

        state.lineAggKeys.forEach((lineAgg, index) => {
            const items = state.groups[lineAgg];
            const totalQty = items.reduce((s, i) => s + parseFloat(i.baseItem?.quantity || 0), 0);

            const section = el('div', { className: 'line-agg-section' });
            const header = el('div', {
                className: 'summary-header',
                html: `<h3>Line Aggregator: ${escapeHTML(lineAgg)} (Total Qty: ${totalQty})</h3>`
            });

            const gotoBtn = el('button', { className: 'nav-btn', html: 'Go to Editor Page' });
            gotoBtn.onclick = () => this._navigateTo(lineAgg, index);

            header.appendChild(gotoBtn);
            section.appendChild(header);

            const packWrap = el('div', { className: 'packing-container', style: { overflowX: 'auto' } });
            new PackingUIBuilder(items, packWrap, lineAgg).build();

            section.appendChild(packWrap);
            container.appendChild(section);
        });

        wrapper.appendChild(container);
    }

    _navigateTo(lineAgg, index) {
        state.currentView = 'paginated';
        state.currentPage = Math.ceil((index + 1) / state.itemsPerPage);

        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-view'));
        document.getElementById('viewPaginatedBtn')?.classList.add('active-view');

        renderCurrentView();

        setTimeout(() => {
            for (const h of document.querySelectorAll('.line-agg-section h3')) {
                if (h.innerText.includes(lineAgg)) {
                    h.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    break;
                }
            }
        }, 50);
    }
}

class AggregatorRenderer {
    render(aggKeys, wrapper) {
        aggKeys.forEach(lineAgg => {
            const items = state.groups[lineAgg];

            const section = el('div', { className: 'line-agg-section' });
            section.appendChild(el('h3', { html: `Line Aggregator: ${escapeHTML(lineAgg)}` }));

            // Single flex row — all three panels sit side-by-side as direct children
            const tablesContainer = el('div', { className: 'tables-container' });

            // Panel 1: original data table
            tablesContainer.appendChild(this._buildDataTable(items));

            // Panel 2: packing table
            const packWrap = el('div', { className: 'packing-container' });
            new PackingUIBuilder(items, packWrap, lineAgg).build();
            tablesContainer.appendChild(packWrap);

            // Panel 3: validation table (async, appends itself into tablesContainer)
            const validationWrap = el('div', { className: 'validation-container' });
            tablesContainer.appendChild(validationWrap);
            renderValidationTable(state.groups[lineAgg], validationWrap);

            section.appendChild(tablesContainer);
            wrapper.appendChild(section);
        });
    }

    _buildDataTable(items) {
        const wrapper = el('div', { className: 'original-table-wrapper' });
        const table = el('table');

        let totalQty = 0;
        let rows = '';

        items.forEach(item => {
            const { bi, ref, id, vr } = resolveItem(item);
            const qty = parseFloat(bi.quantity || 0);
            totalQty += qty;

            rows += `
                <tr>
                    <td><span class="size">${escapeHTML(id.IdBuyerSize)}</span></td>
                    <td><span class="description">${escapeHTML(id.ItemSequenceNumber)}</span></td>
                    <td><span class="brand">${escapeHTML(ref.AdidasShipMode)}</span></td>
                    <td><span class="status">${escapeHTML(ref.ItemStatus)}</span></td>
                    <td><span class="qty">${escapeHTML(bi.quantity)}</span></td>
                    <td><span class="qty">${escapeHTML(ref.ManufacturingSize)}</span></td>
                    <td><span class="qty">${escapeHTML(item.itemKey)}</span></td>
                    <td><span class="qty">${escapeHTML(vr.upperVariance)}</span></td>
                    <td><span class="qty">${escapeHTML(vr.lowerVariance)}</span></td>
                </tr>
            `;
        });

        table.innerHTML = `
            <thead>
                <tr>
                    <th>Size</th><th>Seq #</th><th>Ship Mode</th><th>Status</th>
                    <th>Quantity</th><th>Manufacturing Size</th><th>Upper Var</th><th>Lower Var</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
                <tr class="total-row">
                    <td colspan="4"><strong class="bold-text">TOTAL QUANTITY</strong></td>
                    <td><strong class="bold-text">${totalQty}</strong></td>
                </tr>
            </tbody>
        `;

        wrapper.appendChild(table);
        return wrapper;
    }
}

class PaginationRenderer {
    render(wrapper) {
        if (state.totalPages <= 1) return;

        const controls = el('div', { className: 'pagination-controls' });

        for (let i = 1; i <= state.totalPages; i++) {
            const btn = el('button', {
                className: `page-btn ${i === state.currentPage ? 'active-page' : ''}`,
                html: String(i),
            });
            btn.onclick = () => {
                state.currentPage = i;
                renderCurrentView();
                document.querySelector('.global-settings')
                    ?.scrollIntoView({ behavior: 'smooth' });
            };
            controls.appendChild(btn);
        }

        wrapper.appendChild(controls);
    }
}

// ─── PackingUIBuilder ────────────────────────────────────────────────────────

class PackingUIBuilder {
    constructor(items, container, lineAgg) {
        this.items = items;
        this.container = container;
        this.lineAgg = lineAgg;
    }

    build() {
        state.ensureTableConfig(this.lineAgg, this.items);
        const { maxQtyMap, weightMap } = state.tableConfigs[this.lineAgg];
        this._render(maxQtyMap, weightMap);
    }

    _render(maxQtyMap, weightMap) {
        const { sizes, batches } = this._computeBatches();

        if (batches.length === 0) {
            this.container.innerHTML = '<div class="empty-pack-msg">No valid items found to pack.</div>';
            return;
        }

        this.container.innerHTML = this._buildTableHTML(sizes, batches, maxQtyMap, weightMap);
        this._attachInputListeners(sizes);
    }

    _computeBatches() {
        const uniqueSizes = new Set();
        const batches = [];

        this.items.forEach(item => {
            const { bi, id } = resolveItem(item);
            const size = escapeHTML(id.IdBuyerSize);
            const qty = parseInt(bi.quantity, 10);
            const seqNo = escapeHTML(id.ItemSequenceNumber || '');

            if (isNaN(qty) || qty <= 0 || size === '-') return;

            uniqueSizes.add(size);
            const existing = batches.find(b => !b.some(x => x.size === size));
            existing ? existing.push({ size, qty, seqNo }) : batches.push([{ size, qty, seqNo }]);
        });

        const sizes = Array.from(uniqueSizes).sort(compareSizes);
        return { sizes, batches };
    }

    _buildTableHTML(sizes, batches, maxQtyMap, weightMap) {
        const sizeHeaders = sizes.map(s => `<th>${s}</th>`).join('');
        const maxQtyInputs = sizes.map(s =>
            `<td><input type="number" class="max-qty-header-input" data-size="${s}" value="${maxQtyMap[s] || ''}" min="1"></td>`
        ).join('');
        const weightInputs = sizes.map(s =>
            `<td><input type="number" class="weight-header-input" data-size="${s}" step="0.1" value="${weightMap[s] || ''}"></td>`
        ).join('');

        let rows = '';
        let cartonNo = 1;

        batches.forEach(batch => {
            batch.sort((a, b) => compareSizes(a.size, b.size));

            batch.forEach(({ size, qty, seqNo }) => {
                const maxQty = maxQtyMap[size];
                if (!maxQty || maxQty <= 0) return;

                const full = Math.floor(qty / maxQty);
                const remainder = qty % maxQty;

                const makeRow = (ctnLabel, value, count, shipQty) => {
                    const cells = sizes.map(s =>
                        s === size
                            ? `<td><input type="text" value="${value}" class="transparent-input" data-seq="${seqNo}" readonly></td>`
                            : '<td></td>'
                    ).join('');
                    return `<tr><td class="bold-text">${ctnLabel}</td>${cells}<td class="highlight-cell">${count}</td><td class="highlight-cell">${shipQty}</td></tr>`;
                };

                if (full > 0) {
                    const end = cartonNo + full - 1;
                    rows += makeRow(cartonNo === end ? `${cartonNo}` : `${cartonNo}-${end}`, maxQty, full, full * maxQty);
                    cartonNo = end + 1;
                }
                if (remainder > 0) {
                    rows += makeRow(`${cartonNo}`, remainder, 1, remainder);
                    cartonNo++;
                }
            });
        });

        return `
            <table class="packing-table">
                <thead>
                    <tr>
                        <th rowspan="2">CTN NO</th>
                        <th colspan="${sizes.length}">SIZE</th>
                        <th rowspan="2">TOTAL CTNS</th>
                        <th rowspan="2">SHIPMENT QNTY</th>
                    </tr>
                    <tr>${sizeHeaders}</tr>
                    <tr class="input-row">
                        <td class="input-label">Max qty/box:</td>
                        ${maxQtyInputs}
                        <td colspan="2"></td>
                    </tr>
                    <tr class="input-row">
                        <td class="input-label">Weight:</td>
                        ${weightInputs}
                        <td colspan="2"></td>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    _attachInputListeners(sizes) {
        this.container.querySelectorAll('.max-qty-header-input').forEach(input => {
            input.addEventListener('change', e => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) {
                    state.tableConfigs[this.lineAgg].maxQtyMap[e.target.dataset.size] = val;
                    const { maxQtyMap, weightMap } = state.tableConfigs[this.lineAgg];
                    this._render(maxQtyMap, weightMap);
                }
            });
        });

        this.container.querySelectorAll('.weight-header-input').forEach(input => {
            input.addEventListener('input', e => {
                state.tableConfigs[this.lineAgg].weightMap[e.target.dataset.size] = e.target.value;
            });
        });
    }
}

// ─── ValidationTable ─────────────────────────────────────────────────────────

export async function renderValidationTable(orderItems, container) {
    // Show a loading state immediately while the async fetch runs
    container.innerHTML = '<h4>Catalog Verification</h4><div class="loading">Checking catalog…</div>';

    const uniqueBuyerNums = [...new Set(
        orderItems.map(i => i.baseItem?.itemIdentifier?.BuyerNumber).filter(Boolean)
    )];

    let rows = '';

    for (const bNum of uniqueBuyerNums) {
        const requiredSizes = [...new Set(
            orderItems
                .filter(i => i.baseItem.itemIdentifier.BuyerNumber === bNum)
                .map(i => i.baseItem.itemIdentifier.IdBuyerSize)
        )];

        const catalogData = await checkCatalogForItem('buyerItemNumber = ' + "'" + bNum + "'");
        console.log(catalogData);
        const catalogItems = catalogData?.result || [];

        if (catalogItems.length === 0) {
            rows += `<tr>
                <td class="error-text">${escapeHTML(bNum)}</td>
                <td colspan="2" class="error-text">Buyer Number not found in catalog</td>
            </tr>`;
            continue;
        }

        const availableSizes = catalogItems
            .map(c => c.itemAttribute?.ManufacturingSize || c.itemAttribute?.IdBuyerSize)
            .filter(Boolean);

        requiredSizes.forEach(size => {
            const ok = availableSizes.includes(size);
            rows += `<tr>
                <td class="bold-text">${escapeHTML(bNum)}</td>
                <td>${escapeHTML(size)}</td>
                <td class="${ok ? 'success-text' : 'error-text'}">${ok ? '✅ Verified' : '❌ Size Missing'}</td>
            </tr>`;
        });
    }

    container.innerHTML = `
        <h4>Catalog Verification</h4>
        <table class="validation-table">
            <thead><tr><th>Buyer No.</th><th>Required Size</th><th>Catalog Status</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function renderTables(orderData, containerElement) {
    if (!orderData || !Array.isArray(orderData.orderItem)) {
        containerElement.innerHTML += '<div class="error">No order items found.</div>';
        return;
    }

    state.load(orderData, containerElement);
    new NavigationController().setup();
    renderCurrentView();
}

export function createPackingUI(items, container, globalMaxQtyMap = {}, globalWeightMap = {}, lineAgg = '') {
    container.innerHTML = '';
    // Merge caller-supplied globals into state before building
    Object.assign(state.globalMaxMap, globalMaxQtyMap);
    Object.assign(state.globalWeightMap, globalWeightMap);
    new PackingUIBuilder(items, container, lineAgg).build();
}

// ─── Core render orchestrator ─────────────────────────────────────────────────

function renderCurrentView() {
    state.containerElement.innerHTML = '';

    if (state.currentView !== 'summary') {
        new GlobalSettingsRenderer().render();
    }

    const uid = escapeHTML(state.orderData.__metadata?.uid || 'Unknown');
    const orderWrapper = el('div', {
        className: 'order-section',
        html: `<h2>Order Details (UID: <span class="uid-text">${uid}</span>)</h2>`
    });
    state.containerElement.appendChild(orderWrapper);

    if (state.currentView === 'summary') {
        new SummaryRenderer().render(orderWrapper);

    } else if (state.currentView === 'all') {
        new AggregatorRenderer().render(state.lineAggKeys, orderWrapper);

    } else {
        new AggregatorRenderer().render(state.paginatedKeys, orderWrapper);
        new PaginationRenderer().render(orderWrapper);
    }

    // Export button: visible on "all" view, or on the last paginated page
    const onLastPage = state.currentPage === state.totalPages || state.totalPages === 0;
    const showExport = state.currentView === 'all' || (state.currentView === 'paginated' && onLastPage);

    if (showExport) {
        const exportBtn = el('button', { className: 'pack-btn global-export-btn', html: 'Export All to JSON' });
        exportBtn.onclick = () => extractOrderDataToJson(state.orderData);
        state.containerElement.appendChild(exportBtn);
    }
}