const uname = "admin";
const pw = '/K5="84@p3gNL<b#';
const creds = btoa(`${uname}:${pw}`);

const container = document.getElementById('container');

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

async function fetchDataAndRender() {
    try {
        const myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
        myHeaders.append("Authorization", `Basic ${creds}`);

        const urlencoded = new URLSearchParams();
        urlencoded.append("url", "https://network.infornexus.com/rest/3.1.0/OrderDetail/540027620376");
        urlencoded.append("request_method", "GET");
        urlencoded.append("customer", "adidas_sa_ltd");

        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: urlencoded,
            redirect: "follow"
        };

        const response = await fetch("http://10.0.0.87:8082/api/infornexus/auth", requestOptions);
        const rawResult = await response.json();


        const payloadString = rawResult[4];
        const decodedString = decodeEscapes(payloadString);
        const orderData = JSON.parse(decodedString);

        renderTables(orderData);

    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = `<div class="error">Failed to process data: ${error.message}</div>`;
    }
}


function renderTables(orderData) {
    const groups = {};

    orderData.orderItem.forEach((item) => {
        const ref = item.baseItem.reference || {};
        const lineAgg = ref.LineAggregator ?? 'Unknown';
        if (!groups[lineAgg]) groups[lineAgg] = [];
        groups[lineAgg].push(item);
    });

    Object.keys(groups).forEach(lineAgg => {
        const items = groups[lineAgg];
        let totalQty = 0;

        const heading = document.createElement('h2');
        heading.textContent = `Line Aggregator - ${lineAgg}`;
        container.appendChild(heading);

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Item Uid</th>
                    <th>Market Po Number</th>  
                    <th>Description</th>
                    <th>Brand</th>
                    <th>Item Status</th>
                    <th>Size</th>
                    <th>Quantity</th>
                </tr>
            </thead>
            <tbody id="body-${lineAgg.replace(/\s+/g, '')}"></tbody>
        `;

        container.appendChild(table);
        const tbody = table.querySelector('tbody');

        items.forEach((item) => {
            const bi = item.baseItem;
            const ref = bi.reference || {};
            const id = bi.itemIdentifier || {};
            const qty = parseFloat(bi.quantity || 0);
            totalQty += qty;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><span class="status">${bi.itemUid ?? '-'}</span></td>
                <td><span class="number">${orderData.poNumber ?? '-'}</span></td>
                <td><span class="description">${id.ShortDescription ?? '-'}</span></td>
                <td><span class="brand">${ref.BrandDescription ?? '-'}</span></td>
                <td><span class="status">${ref.ItemStatus ?? '-'}</span></td>
                <td><span class="size">${id.IdBuyerSize ?? '-'}</span></td>
                <td><span class="qty">${bi.quantity ?? '-'}</span></td>
            `;
            tbody.appendChild(row);
        });

        const totalRow = document.createElement('tr');
        totalRow.className = 'total-row';
        totalRow.innerHTML = `
            <td colspan="6"><strong>TOTAL QUANTITY</strong></td>
            <td><strong>${totalQty}</strong></td>
        `;
        tbody.appendChild(totalRow);
    });
}

fetchDataAndRender();