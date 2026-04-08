const uname = "admin";
const pw = '/K5="84@p3gNL<b#'
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
        const seqNo = escapeHTML(id.ItemSequenceNumber || ''); // Grab the sequence number

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
                    // Added data-seq attribute here
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
                    // Added data-seq attribute here
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
            jsonSchema[lineAgg][size] = {
                maxBoxQty: 50,
                weightPerItem: 0,
                totalShipmentQtyPerSize: 0,
                items: []
            };
        }

        const qty = parseFloat(bi.quantity || 0);

        // Carton Numbers moved inside the itemDetail
        const itemDetail = {
            itemSequenceNo: id.ItemSequenceNumber ?? '',
            cartonNumbers: "N/A",
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

    for (const lineAgg in jsonSchema) {
        const safeLineAggId = `packing-${lineAgg.replace(/\W/g, '_')}`;
        const packingContainer = document.getElementById(safeLineAggId);

        if (packingContainer && packingContainer.querySelector('table')) {
            for (const size in jsonSchema[lineAgg]) {
                const sizeData = jsonSchema[lineAgg][size];

                // 1. Grab Max Box Qty
                const maxQtyInput = packingContainer.querySelector(`.max-qty-header-input[data-size="${size}"]`);
                if (maxQtyInput && maxQtyInput.value) {
                    sizeData.maxBoxQty = parseInt(maxQtyInput.value, 10);
                }

                // 2. Grab Weight Per Item
                const weightInput = packingContainer.querySelector(`.weight-header-input[data-size="${size}"]`);
                if (weightInput && weightInput.value) {
                    sizeData.weightPerItem = parseFloat(weightInput.value);
                }

                // 3. Scrape Carton Numbers PER ITEM based on Sequence Number
                sizeData.items.forEach(item => {
                    const seq = escapeHTML(item.itemSequenceNo);
                    // Find all input boxes that match this exact item sequence number
                    const inputs = packingContainer.querySelectorAll(`.transparent-input[data-seq="${seq}"]`);

                    const cartonNumbersList = [];
                    inputs.forEach(input => {
                        // Go up to the table row (<tr>) and grab the first cell (CTN NO)
                        const tr = input.closest('tr');
                        if (tr) {
                            const ctnNo = tr.cells[0].innerText.trim();
                            cartonNumbersList.push(ctnNo);
                        }
                    });

                    if (cartonNumbersList.length > 0) {
                        item.cartonNumbers = cartonNumbersList.join(", ");
                    }
                });
            }
        }
    }

    console.log(JSON.stringify(jsonSchema, null, 2));
    fs.writeFileSync('recons.json', jsonSchema, 'utf-8');

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