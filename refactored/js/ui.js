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

    // --- Global Settings Grid (Cleaned up with CSS Classes) ---
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

    const orderWrapper = document.createElement('div');
    orderWrapper.className = 'order-section';
    orderWrapper.innerHTML = `<h2>Order Details (UID: <span class="uid-text">${escapeHTML(orderData.__metadata?.uid || 'Unknown')}</span>)</h2>`;

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

    Object.keys(groups).forEach(lineAgg => {
        const items = groups[lineAgg];
        let totalQty = 0;

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
                <tr><th>Size</th><th>Item Sequence Number</th><th>Ship Mode</th><th>Item Status</th><th>Quantity</th><th>Upper Variance</th><th>Lower Variance</th></tr>
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
        orderWrapper.appendChild(lineAggSection);

        const initialMaps = getGlobalMaps();
        createPackingUI(items, packingContainer, initialMaps.maxMap, initialMaps.wMap);

        renderTriggers.push(() => {
            const maps = getGlobalMaps();
            createPackingUI(items, packingContainer, maps.maxMap, maps.wMap);
        });
    });

    containerElement.appendChild(orderWrapper);

    const applyBtn = document.getElementById('apply-globals-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            renderTriggers.forEach(trigger => trigger());
        });
    }

    // Extracted inline styling to .global-export-btn class
    const globalExportBtn = document.createElement('button');
    globalExportBtn.className = 'pack-btn global-export-btn';
    globalExportBtn.innerText = 'Export All to JSON';
    globalExportBtn.onclick = () => extractOrderDataToJson(orderData);

    containerElement.appendChild(globalExportBtn);
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

                    let rowHtml = `<tr>
                        <td class="bold-text">${ctnString}</td>`;

                    sizes.forEach(s => {
                        rowHtml += `<td>
                            ${s === currentSize ? `<input type="text" value="${maxQty}" class="transparent-input" data-seq="${item.seqNo}" readonly>` : ''}
                        </td>`;
                    });
                    rowHtml += `
                        <td class="highlight-cell">${fullCartons}</td>
                        <td class="highlight-cell">${fullCartons * maxQty}</td>
                    </tr>`;

                    html += rowHtml;
                    cartonNo = endCtn + 1;
                }

                if (remainder > 0) {
                    const ctnString = `${cartonNo}`;

                    let rowHtml = `<tr>
                        <td class="bold-text">${ctnString}</td>`;

                    sizes.forEach(s => {
                        rowHtml += `<td>
                            ${s === currentSize ? `<input type="text" value="${remainder}" class="transparent-input" data-seq="${item.seqNo}" readonly>` : ''}
                        </td>`;
                    });

                    rowHtml += `
                        <td class="highlight-cell">1</td>
                        <td class="highlight-cell">${remainder}</td>
                    </tr>`;

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