const uname = "";
const pw = ''
const creds = btoa(`${uname}:${pw}`);

const searchType = document.getElementById('searchType');
const searchInput = document.getElementById('searchInput');
const container = document.getElementById('container');

async function searchData() {
    const query = searchInput.value.trim();
    const type = searchType.value;

    if (!query) {
        container.innerHTML = '<div class="error">Please enter a search value.</div>';
        return;
    }

    container.innerHTML = `<div class="loading">Searching for <strong class="bold-text">${escapeHTML(query)}</strong>...</div>`;

    try {
        if (type === 'poNumber') {
            const uids = await fetchUidByPoNumber(query);

            container.innerHTML = '';
            const summary = document.createElement('div');
            summary.innerHTML = `<h3>Found ${uids.length} Order(s) for PO: ${escapeHTML(query)}</h3><hr>`;
            container.appendChild(summary);

            for (const uid of uids) {
                await fetchDataAndRender(uid);
            }
        } else {
            container.innerHTML = '';
            await fetchDataAndRender(query);
        }
    } catch (error) {
        console.error('Process Error:', error);
        container.innerHTML = `<div class="error">Process Failed:<br>${escapeHTML(error.message)}</div>`;
    }
}

searchInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        searchData();
    }
});

async function fetchUidByPoNumber(poNumber) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
    myHeaders.append("Authorization", `Basic ${creds}`);

    const oqlQuery = `poNumber='${poNumber}'`;
    const targetUrl = `https://network.infornexus.com/rest/3.1.0/OrderDetail/query?oql=${encodeURIComponent(oqlQuery)}`;

    const urlencoded = new URLSearchParams();
    urlencoded.append("url", targetUrl);
    urlencoded.append("request_method", "GET");
    urlencoded.append("customer", "adidas_sa_ltd");

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: urlencoded,
        redirect: "follow"
    };

    const response = await fetch("http://10.0.0.87:8082/api/infornexus/auth", requestOptions);
    if (!response.ok) throw new Error(`HTTP error during UID lookup: ${response.status}`);

    const rawResult = await response.json();
    if (!Array.isArray(rawResult) || rawResult.length <= 4) throw new Error("Proxy returned unexpected data structure.");

    const decodedString = decodeEscapes(rawResult[4]);
    const queryData = JSON.parse(decodedString);

    if (!queryData.result || queryData.result.length === 0) {
        throw new Error("No orders found matching this PO Number.");
    }

    return queryData.result.map(order => order.orderUid);
}

async function fetchDataAndRender(orderId) {
    try {
        const myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
        myHeaders.append("Authorization", `Basic ${creds}`);

        const targetUrl = `https://network.infornexus.com/rest/3.1.0/OrderDetail/${encodeURIComponent(orderId)}`;

        const urlencoded = new URLSearchParams();
        urlencoded.append("url", targetUrl);
        urlencoded.append("request_method", "GET");
        urlencoded.append("customer", "adidas_sa_ltd");

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: urlencoded,
            redirect: "follow"
        };

        const response = await fetch("http://10.0.0.87:8082/api/infornexus/auth", requestOptions);

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const rawResult = await response.json();

        if (!Array.isArray(rawResult) || rawResult.length <= 4) {
            throw new Error("Proxy API returned an unexpected or empty data structure.");
        }

        const payloadString = rawResult[4];
        if (!payloadString) throw new Error("Payload at index 4 is missing.");

        let orderData;
        try {
            const decodedString = decodeEscapes(payloadString);
            orderData = JSON.parse(decodedString);
        } catch (parseError) {
            throw new Error("Failed to parse the decoded JSON string.");
        }

        renderTables(orderData);

    } catch (error) {
        console.error('Error fetching details:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.innerHTML = `Failed to process order ${escapeHTML(orderId)}: <br>${escapeHTML(error.message)}`;
        container.appendChild(errorDiv);
    }
}

function getSizeWeight(sizeStr) {
    const size = String(sizeStr).toUpperCase().trim();

    const baseWeights = {
        'S': 100,
        'M': 200,
        'L': 300
    };

    if (baseWeights[size]) return baseWeights[size];

    if (size.endsWith('XS')) {
        const num = size.replace('XS', '');
        const multiplier = num === '' ? 1 : parseInt(num, 10);
        return 100 - multiplier;
    }

    if (size.endsWith('XL')) {
        const num = size.replace('XL', '');
        const multiplier = num === '' ? 1 : parseInt(num, 10);
        return 300 + multiplier;
    }

    if (!isNaN(size) && size !== '') return parseFloat(size);

    return 9999;
}

function compareSizes(a, b) {
    const weightA = getSizeWeight(a);
    const weightB = getSizeWeight(b);

    if (weightA !== 9999 && weightB !== 9999) {
        return weightA - weightB;
    }

    return String(a).localeCompare(String(b));
}

function renderTables(orderData) {
    if (!orderData || !Array.isArray(orderData.orderItem)) {
        const noDataDiv = document.createElement('div');
        noDataDiv.className = 'error';
        noDataDiv.innerHTML = `No order items found for UID: ${escapeHTML(orderData?.__metadata?.uid || 'Unknown')}.`;
        container.appendChild(noDataDiv);
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

    const orderHeading = document.createElement('h2');
    orderHeading.innerHTML = `Order Details (UID: <span class="uid-text">${escapeHTML(orderData.__metadata?.uid || 'Unknown')}</span>)`;
    orderWrapper.appendChild(orderHeading);

    Object.keys(groups).forEach(lineAgg => {
        const items = groups[lineAgg];
        let totalQty = 0;

        const lineAggSection = document.createElement('div');
        lineAggSection.className = 'line-agg-section';

        const heading = document.createElement('h3');
        heading.textContent = `Line Aggregator: ${lineAgg}`;
        lineAggSection.appendChild(heading);

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
                <tr>
                    <th>Size</th> 
                    <th>Item Sequence Number</th>
                    <th>Ship Mode</th>
                    <th>Item Status</th>
                    <th>Quantity</th>
                </tr>
            </thead>
            <tbody id="body-${escapeHTML(lineAgg.replace(/\s+/g, ''))}"></tbody>
        `;

        const tbody = table.querySelector('tbody');

        items.forEach((item) => {
            const bi = item.baseItem || {};
            const ref = bi.reference || {};
            const id = bi.itemIdentifier || {};
            const qty = parseFloat(bi.quantity || 0);
            totalQty += qty;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><span class="size">${escapeHTML(id.IdBuyerSize)}</span></td>
                <td><span class="description">${escapeHTML(id.ItemSequenceNumber)}</span></td>
                <td><span class="brand">${escapeHTML(ref.AdidasShipMode)}</span></td>
                <td><span class="status">${escapeHTML(ref.ItemStatus)}</span></td>
                <td><span class="qty">${escapeHTML(bi.quantity)}</span></td>
            `;
            tbody.appendChild(row);
        });

        const totalRow = document.createElement('tr');
        totalRow.className = 'total-row';
        totalRow.innerHTML = `
            <td colspan="4"><strong class="bold-text">TOTAL QUANTITY</strong></td>
            <td><strong class="bold-text">${totalQty}</strong></td>
        `;
        tbody.appendChild(totalRow);
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

    container.appendChild(orderWrapper);

    // Global Export Button at the bottom
    const globalExportBtn = document.createElement('button');
    globalExportBtn.className = 'pack-btn';
    globalExportBtn.style.display = 'block';
    globalExportBtn.style.margin = '20px auto';
    globalExportBtn.style.padding = '12px 24px';
    globalExportBtn.style.fontSize = '16px';
    globalExportBtn.innerText = 'Export All to JSON';

    globalExportBtn.onclick = () => {
        extractOrderDataToJson(orderData);
        alert("JSON extracted! Open your browser's Developer Tools (F12) Console to view it.");
    };

    container.appendChild(globalExportBtn);
}

function createPackingUI(items, packingContainer) {
    packingContainer.innerHTML = '';
    const defaultMaxQty = 50;
    const maxQtyMap = {};
    const weightMap = {};

    items.forEach(item => {
        const bi = item.baseItem || {};
        const id = bi.itemIdentifier || {};
        const size = escapeHTML(id.IdBuyerSize);
        const qty = parseInt(bi.quantity, 10);
        if (!isNaN(qty) && qty > 0 && size !== '-') {
            maxQtyMap[size] = defaultMaxQty;
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

        if (!isNaN(qty) && qty > 0 && size !== '-') {
            uniqueSizes.add(size);

            let placed = false;
            for (let i = 0; i < batches.length; i++) {
                if (!batches[i].some(bItem => bItem.size === size)) {
                    batches[i].push({ size, qty });
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                batches.push([{ size, qty }]);
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
                        ${s === currentSize ? `<input type="text" value="${maxQty}" class="transparent-input">` : ''}
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
                        ${s === currentSize ? `<input type="text" value="${remainder}" class="transparent-input">` : ''}
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

    // Listener for Max Qty changes (triggers table redraw)
    const headerInputs = container.querySelectorAll('.max-qty-header-input');
    headerInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            const updatedSize = e.target.getAttribute('data-size');
            const newValue = parseInt(e.target.value, 10);

            if (newValue && newValue > 0) {
                maxQtyMap[updatedSize] = newValue;
                // Pass weightMap back in so weights survive the redraw
                renderPackingTable(items, maxQtyMap, weightMap, container);
            } else {
                alert('Please enter a valid number greater than 0');
                e.target.value = maxQtyMap[updatedSize];
            }
        });
    });

    // Listener for Weight changes (saves silently without redrawing the table)
    const weightInputs = container.querySelectorAll('.weight-header-input');
    weightInputs.forEach(input => {
        input.addEventListener('input', (e) => {
            const updatedSize = e.target.getAttribute('data-size');
            weightMap[updatedSize] = e.target.value;
        });
    });
}

function extractOrderDataToJson(orderData) {
    if (!orderData || !Array.isArray(orderData.orderItem)) {
        console.error("Invalid order data format");
        return null;
    }

    const jsonSchema = {};

    orderData.orderItem.forEach((item) => {
        const bi = item.baseItem || {};
        const ref = bi.reference || {};
        const id = bi.itemIdentifier || {};

        const itemVar = bi.itemVariance || {};
        const uvariance = parseFloat(itemVar.upperVariance || 0);
        const lvariance = parseFloat(itemVar.lowerVariance || 0);

        const lineAgg = ref.LineAggregator ?? 'Unknown';
        const size = id.IdBuyerSize ?? 'Unknown';

        if (!jsonSchema[lineAgg]) {
            jsonSchema[lineAgg] = {};
        }

        if (!jsonSchema[lineAgg][size]) {
            // Find the specific packing table container for this Line Aggregator
            const safeLineAggId = `packing-${lineAgg.replace(/\W/g, '_')}`;
            const packingContainer = document.getElementById(safeLineAggId);

            // Set fallbacks in case the table hasn't been generated yet
            let userMaxQty = 50;
            let userWeight = 0;

            // Dynamically read the User's Inputs directly from the UI
            if (packingContainer) {
                const maxQtyInput = packingContainer.querySelector(`.max-qty-header-input[data-size="${size}"]`);
                if (maxQtyInput && maxQtyInput.value) {
                    userMaxQty = parseInt(maxQtyInput.value, 10);
                }

                const weightInput = packingContainer.querySelector(`.weight-header-input[data-size="${size}"]`);
                if (weightInput && weightInput.value) {
                    userWeight = parseFloat(weightInput.value);
                }
            }

            jsonSchema[lineAgg][size] = {
                maxBoxQty: userMaxQty,
                cartonNumbers: "",
                weightPerItem: userWeight,
                totalShipmentQtyPerSize: 0,
                items: []
            };
        }

        const qty = parseFloat(bi.quantity || 0);

        const itemDetail = {
            itemSequenceNo: id.ItemSequenceNumber ?? '',
            shipMode: ref.AdidasShipMode ?? '',
            itemSts: ref.ItemStatus ?? '',
            quantity: qty,
            variance: {
                ub: uvariance,
                lb: lvariance
            }
        };

        jsonSchema[lineAgg][size].items.push(itemDetail);
        jsonSchema[lineAgg][size].totalShipmentQtyPerSize += qty;
    });

    // Output the final formatted JSON to the console
    console.log("=== Extracted Data matching Schema ===");
    console.log(JSON.stringify(jsonSchema, null, 2));

    return jsonSchema;
}


function decodeEscapes(s) {
    if (typeof s !== 'string') return JSON.stringify(s);
    return s
        .replace(/\\,/g, ',')
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\\\/g, '\\')
        .replace(/\\"/g, '"');
}

function escapeHTML(str) {
    if (str === null || str === undefined) return '-';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}