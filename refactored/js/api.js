import { creds, PROXY_URL, API_BASE_URL, CUSTOMER_ID } from './config.js';
import { decodeEscapes } from './utils.js';

function getHeaders() {
    const headers = new Headers();
    headers.append("Content-Type", "application/x-www-form-urlencoded");
    headers.append("Authorization", `Basic ${creds}`);
    return headers;
}

export async function fetchFromProxy(targetUrl) {
    const urlencoded = new URLSearchParams();
    urlencoded.append("url", targetUrl);
    urlencoded.append("request_method", "GET");
    urlencoded.append("customer", CUSTOMER_ID);

    const requestOptions = { method: "POST", headers: getHeaders(), body: urlencoded, redirect: "follow" };
    const response = await fetch(PROXY_URL, requestOptions);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
}

export function extractPayload(rawResult, validateFn) {
    if (!Array.isArray(rawResult)) {
        throw new Error("Invalid response format: expected an array from the proxy.");
    }

    for (const item of rawResult) {
        let parsed = item;
        if (typeof item === 'string') {
            try {
                parsed = JSON.parse(decodeEscapes(item));
            } catch (e) {
                continue;
            }
        }

        // If parsed is an object and meets our specific validation criteria, return it
        if (parsed && typeof parsed === 'object' && validateFn(parsed)) {
            return parsed;
        }
    }

    throw new Error("Could not find the expected JSON payload in the proxy response.");
}

// ---------------------------------------------------------
// EXPORTED API METHODS
// ---------------------------------------------------------

export async function fetchUidByPoNumber(poNumber) {
    const oqlQuery = `poNumber='${poNumber}'`;
    const targetUrl = `${API_BASE_URL}/OrderDetail/query?oql=${encodeURIComponent(oqlQuery)}`;

    const rawResult = await fetchFromProxy(targetUrl);

    // We expect the payload to have a "result" property
    const queryData = extractPayload(rawResult, data => data.result !== undefined);

    if (!queryData.result || queryData.result.length === 0) {
        throw new Error("No orders found matching this PO Number.");
    }

    return queryData.result.map(order => order.orderUid);
}

export async function fetchOrderData(orderId) {
    const targetUrl = `${API_BASE_URL}/OrderDetail/${encodeURIComponent(orderId)}`;

    const rawResult = await fetchFromProxy(targetUrl);

    // We expect the payload to have an "orderItem" property
    return extractPayload(rawResult, data => data.orderItem !== undefined);
}

export function extractCatalogPayload(rawResult) {
    // For catalog, we expect a "result" property that is an Array
    return extractPayload(rawResult, data => data.result && Array.isArray(data.result));
}