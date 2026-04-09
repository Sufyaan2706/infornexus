import { escapeHTML, compareSizes } from './utils.js';
import { extractOrderDataToJson } from './export.js';

export function renderTables(orderData, containerElement) {
    if (!orderData || !Array.isArray(orderData.orderItem)) {
        containerElement.innerHTML += `<div class="error">No order items found for UID: ${escapeHTML(orderData?.__metadata?.uid || 'Unknown')}.</div>`;
        return;
    }

    const groups = {};
    orderData.orderItem.forEach((item) => {
        const ref = item.baseItem?.reference || {};
        const lineAgg = ref.LineAggregator ?? 'Unknown';
        if (!groups[lineAgg]) groups[lineAgg] = [];
        groups[lineAgg].push(item);
    });

    const orderWrapper = document.createElement('div');
    orderWrapper.className = 'order-section';
    orderWrapper.innerHTML = `<h2>Order Details (UID: <span class="uid-text">${escapeHTML(orderData.__metadata?.uid || 'Unknown')}</span>)</h2>`;

    Object.keys(groups).forEach(lineAgg => {
        const items = groups[lineAgg];
        let totalQty = 0;

        const lineAggSection = document.createElement('div');
        lineAggSection.className = 'line-agg-section';
        lineAggSection.innerHTML = `<h3>Line Aggregator: ${escapeHTML(lineAgg)}</h3>`;

        const packBtn = document.createElement('button');
        packBtn.className = 'pack-btn';
        packBtn.innerText = 'Generate Packing List';
        lineAggSection.appendChild(packBtn);

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
            const qty = parseFloat(bi.quantity || 0);
            totalQty += qty;

            tbody.innerHTML += `
                <tr>
                    <td><span class="size">${escapeHTML(id.IdBuyerSize)}</span></td>
                    <td><span class="description">${escapeHTML(id.ItemSequenceNumber)}</span></td>
                    <td><span class="brand">${escapeHTML(ref.AdidasShipMode)}</span></td>
                    <td><span class="status">${escapeHTML(ref.ItemStatus)}</span></td>
                    <td><span class="qty">${escapeHTML(bi.quantity)}</span></td>
                    <td><span class="qty">${escapeHTML(bi.itemVariance.upperVariance)}</span></td>
                    <td><span class="qty">${escapeHTML(bi.itemVariance.lowerVariance)}</span></td>
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

        packBtn.onclick = () => createPackingUI(items, packingContainer);
        orderWrapper.appendChild(lineAggSection);
    });

    containerElement.appendChild(orderWrapper);

    const globalExportBtn = document.createElement('button');
    globalExportBtn.className = 'pack-btn';
    globalExportBtn.style.cssText = 'display: block; margin: 20px auto; padding: 12px 24px; font-size: 16px;';
    globalExportBtn.innerText = 'Export All to JSON';
    globalExportBtn.onclick = () => extractOrderDataToJson(orderData);

    containerElement.appendChild(globalExportBtn);
}

export function createPackingUI(items, packingContainer) {
    packingContainer.innerHTML = '';
    const maxQtyMap = {};
    const weightMap = {};

    items.forEach(item => {
        const bi = item.baseItem || {};
        const id = bi.itemIdentifier || {};
        const size = escapeHTML(id.IdBuyerSize);
        const qty = parseInt(bi.quantity, 10);
        if (!isNaN(qty) && qty > 0 && size !== '-') {
            maxQtyMap[size] = 0;
            weightMap[size] = '';
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
                    batches[i].push({ size, qty, seqNo }); // Store it in the batch
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
                    <td colspan="1" class="input-label">Input max box quantity:</td>
                    ${sizes.map(s => `
                        <td>
                            <input type="number" class="max-qty-header-input" data-size="${s}" value="${maxQtyMap[s]}" min="1">
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
        });
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

    // Listener for Max Qty changes
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
                e.target.value = maxQtyMap[updatedSize];
            }
        });
    });

    // Listener for Weight changes
    const weightInputs = container.querySelectorAll('.weight-header-input');
    weightInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const updatedSize = e.target.getAttribute('data-size');
            weightMap[updatedSize] = e.target.value;
        });
    });
}
