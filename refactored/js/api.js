import { Config } from './config.js';
import { Utils } from './utils.js';

export class ApiClient {
    static _getHeaders() {
        const headers = new Headers();
        headers.append("Content-Type", "application/x-www-form-urlencoded");
        headers.append("Authorization", `Basic ${Config.credentials}`);
        return headers;
    }

    static async fetchFromProxy(targetUrl) {
        const body = new URLSearchParams({
            url: targetUrl,
            request_method: "GET",
            customer: Config.customerId
        });

        const response = await fetch(Config.proxyUrl, {
            method: "POST",
            headers: this._getHeaders(),
            body
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    }

    static _extractPayload(rawResult, validateFn) {
        if (!Array.isArray(rawResult)) throw new Error("Invalid response format.");

        for (const item of rawResult) {
            let parsed = item;
            if (typeof item === 'string') {
                try { parsed = JSON.parse(Utils.decodeEscapes(item)); } catch (e) { continue; }
            }
            if (parsed && typeof parsed === 'object' && validateFn(parsed)) {
                return parsed;
            }
        }
        throw new Error("Could not find the expected JSON payload.");
    }

    static async fetchUidByPoNumber(poNumber) {
        const url = `${Config.apiBaseUrl}/OrderDetail/query?oql=${encodeURIComponent(`poNumber='${poNumber}'`)}`;
        const result = await this.fetchFromProxy(url);
        const data = this._extractPayload(result, d => d.result !== undefined);

        if (!data.result || !data.result.length) throw new Error("No orders found.");
        return data.result.map(order => order.orderUid);
    }

    static async fetchOrderData(orderId) {
        const url = `${Config.apiBaseUrl}/OrderDetail/${encodeURIComponent(orderId)}`;
        const result = await this.fetchFromProxy(url);
        return this._extractPayload(result, d => d.orderItem !== undefined);
    }

    static async fetchBulkCatalog() {
        const url = `${Config.apiBaseUrl}/ProductCatalogItem/adidasWeightsUnified5717989018343878/list`;
        try {
            const result = await this.fetchFromProxy(url);
            return this._extractPayload(result, d => d.result && Array.isArray(d.result));
        } catch (e) {
            return { result: [] };
        }
    }
}