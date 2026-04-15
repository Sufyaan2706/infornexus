import { fetchFromProxy, extractCatalogPayload } from './api.js';
import { escapeHTML } from './utils.js';

// ==========================================
// 1. RENDERING LOGIC
// ==========================================
export function renderCatalogUI(catalogItems, containerElement) {
    if (!containerElement) {
        console.error("No valid container element provided for rendering.");
        return;
    }

    containerElement.innerHTML = '';

    if (!catalogItems || catalogItems.length === 0) {
        containerElement.innerHTML = '<div class="alert">No items found in the catalog.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    const listContainer = document.createElement('ul');
    listContainer.className = 'catalog-list';

    catalogItems.forEach(item => {
        const listItem = document.createElement('li');
        listItem.className = 'catalog-item';

        const itemKey = escapeHTML(item.itemKey);
        const attributes = item.itemAttribute || {};
        const size = escapeHTML(attributes.ManufacturingSize);
        const buyerNumber = escapeHTML(attributes.buyerItemNumber);
        const netWeight = escapeHTML(attributes['measurements/netWeight']);
        const weightUnit = escapeHTML(attributes['measurements/weightUnit'] || 'KG');

        listItem.innerHTML = `
            <div class="item-card">
                <div class="item-header">
                    <h4>${itemKey}</h4>
                    <span class="badge">Size: ${size}</span>
                </div>
                <div class="item-body">
                    <p><strong>Buyer Item:</strong> ${buyerNumber}</p>
                    <p><strong>Net Weight:</strong> ${netWeight} ${weightUnit}</p>
                </div>
            </div>
        `;

        listContainer.appendChild(listItem);
    });

    fragment.appendChild(listContainer);
    containerElement.appendChild(fragment);
}

// ==========================================
// 2. FETCHING & CONTROLLER LOGIC
// ==========================================
const catalogContainer = document.getElementById('catalog-container');
const loadCatalogBtn = document.getElementById('loadCatalogBtn');

async function loadCatalog() {
    if (!catalogContainer) return;

    catalogContainer.innerHTML = '<div class="loading">Loading product catalog...</div>';

    try {
        const targetUrl = 'https://network.infornexus.com/rest/3.1.0/ProductCatalogItem/adidasWeightsUnified5717989018343878/list';

        // Fetch straight from catalog.js using the clean helper!
        const rawResultArray = await fetchFromProxy(targetUrl);
        const payloadData = extractCatalogPayload(rawResultArray);

        // Render the result
        renderCatalogUI(payloadData.result, catalogContainer);

    } catch (error) {
        console.error('Catalog Load Error:', error);
        catalogContainer.innerHTML = `<div class="error">Failed to load catalog:<br>${escapeHTML(error.message)}</div>`;
    }
}

// Initialize when the script is loaded
if (catalogContainer) {
    if (loadCatalogBtn) {
        loadCatalogBtn.addEventListener('click', loadCatalog);
    } else {
        loadCatalog();
    }
}