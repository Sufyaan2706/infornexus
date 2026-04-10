import { fetchUidByPoNumber, fetchOrderData } from './api.js';
import { renderTables } from './ui.js';
import { escapeHTML } from './utils.js';

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
            container.innerHTML = `<h3>Found ${uids.length} Order(s) for PO: ${escapeHTML(query)}</h3><hr>`;

            for (const uid of uids) {
                await fetchAndRenderSingleOrder(uid);
            }
        } else {
            container.innerHTML = '';
            await fetchAndRenderSingleOrder(query);
        }
    } catch (error) {
        console.error('Process Error:', error);
        container.innerHTML = `<div class="error">Process Failed:<br>${escapeHTML(error.message)}</div>`;
    }
}

async function fetchAndRenderSingleOrder(orderId) {
    try {
        const orderData = await fetchOrderData(orderId);
        renderTables(orderData, container);
    } catch (error) {
        console.error('Error fetching details:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.innerHTML = `Failed to process order ${escapeHTML(orderId)}: <br>${escapeHTML(error.message)}`;
        container.appendChild(errorDiv);
    }
}

searchInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') searchData();
});

document.getElementById('searchBtn').addEventListener('click', searchData);

