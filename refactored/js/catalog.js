import { ApiClient } from './api.js';
import { Utils } from './utils.js';

export class CatalogController {
    constructor(containerId, btnId) {
        this.container = document.getElementById(containerId);
        this.loadBtn = document.getElementById(btnId);
        this.init();
    }

    init() {
        if (!this.container) return;
        this.loadBtn ? this.loadBtn.addEventListener('click', () => this.load()) : this.load();
    }

    async load() {
        this.container.innerHTML = '<div class="loading">Loading product catalog...</div>';
        try {
            const data = await ApiClient.fetchBulkCatalog();
            this.render(data.result);
        } catch (error) {
            this.container.innerHTML = `<div class="error">Failed to load:<br>${Utils.escapeHTML(error.message)}</div>`;
        }
    }

    render(items) {
        this.container.innerHTML = '';
        if (!items || !items.length) {
            this.container.innerHTML = '<div class="alert">No items found.</div>';
            return;
        }

        const list = Utils.el('ul', { className: 'catalog-list' });
        items.forEach(item => {
            const attrs = item.itemAttribute || {};
            list.appendChild(Utils.el('li', {
                className: 'catalog-item',
                html: `
                    <div class="item-card">
                        <div class="item-header">
                            <h4>${Utils.escapeHTML(item.itemKey)}</h4>
                            <span class="badge">Size: ${Utils.escapeHTML(attrs.ManufacturingSize)}</span>
                        </div>
                        <div class="item-body">
                            <p><strong>Buyer Item:</strong> ${Utils.escapeHTML(attrs.buyerItemNumber)}</p>
                            <p><strong>Net Weight:</strong> ${Utils.escapeHTML(attrs['measurements/netWeight'])} ${Utils.escapeHTML(attrs['measurements/weightUnit'] || 'KG')}</p>
                        </div>
                    </div>
                `
            }));
        });
        this.container.appendChild(list);
    }
}

new CatalogController('catalog-container', 'loadCatalogBtn');