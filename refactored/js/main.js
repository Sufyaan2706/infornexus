import { ApiClient } from './api.js';
import { AppState, UIController } from './ui.js';
import { Utils } from './utils.js';
import '../styles.css';

class AppController {
    constructor() {
        this.searchType = document.getElementById('searchType');
        this.searchInput = document.getElementById('searchInput');
        this.container = document.getElementById('container');
        this.state = new AppState();
        this.ui = new UIController(this.state);

        this.init();
    }

    init() {
        document.getElementById('searchBtn')?.addEventListener('click', () => this.search());
        this.searchInput?.addEventListener('keypress', e => e.key === 'Enter' && this.search());
        this._setupViewControls();
    }

    _setupViewControls() {
        const controls = document.getElementById('viewControls');
        if (controls) controls.style.display = 'inline-flex';

        const setView = (view, resetPage = false) => {
            this.state.currentView = view;
            if (resetPage) this.state.currentPage = 1;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active-view', b.id === `view${view.charAt(0).toUpperCase() + view.slice(1)}Btn`));
            this.ui.render();
        };

        document.getElementById('viewSummaryBtn')?.addEventListener('click', () => setView('summary'));
        document.getElementById('viewPaginatedBtn')?.addEventListener('click', () => setView('paginated', true));
        document.getElementById('viewAllBtn')?.addEventListener('click', () => setView('all'));

        const perPageInput = document.getElementById('itemsPerPage');
        if (perPageInput) {
            perPageInput.addEventListener('change', e => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) {
                    this.state.itemsPerPage = val;
                    this.state.currentPage = 1;
                    if (this.state.currentView === 'paginated') this.ui.render();
                }
            });
        }
    }

    async search() {
        const query = this.searchInput.value.trim();
        if (!query) return this._showError('Please enter a search value.');

        this.container.innerHTML = `<div class="loading">Searching for <strong>${Utils.escapeHTML(query)}</strong>...</div>`;
        try {
            if (this.searchType.value === 'poNumber') {
                const uids = await ApiClient.fetchUidByPoNumber(query);
                this.container.innerHTML = `<h3>Found ${uids.length} Order(s)</h3><hr>`;
                for (const uid of uids) await this._renderOrder(uid);
            } else {
                this.container.innerHTML = '';
                await this._renderOrder(query);
            }
        } catch (error) {
            this._showError(`Process Failed:<br>${Utils.escapeHTML(error.message)}`);
        }
    }

    async _renderOrder(id) {
        try {
            const data = await ApiClient.fetchOrderData(id);
            if (!data?.orderItem?.length) throw new Error("No items found.");
            this.state.load(data, this.container);
            this.ui.render();
        } catch (error) {
            this.container.appendChild(Utils.el('div', { className: 'error', html: `Failed to process ${Utils.escapeHTML(id)}: <br>${Utils.escapeHTML(error.message)}` }));
        }
    }

    _showError(msg) {
        this.container.innerHTML = `<div class="error">${msg}</div>`;
    }
}

new AppController();