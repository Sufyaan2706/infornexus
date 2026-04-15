import { creds, PROXY_URL, API_BASE_URL, CUSTOMER_ID } from './config.js';
import { decodeEscapes } from './utils.js';

function getHeaders() {
    const headers = new Headers();
    headers.append("Content-Type", "application/x-www-form-urlencoded");
    headers.append("Authorization", `Basic ${creds}`);
    return headers;
}

export async function fetchUidByPoNumber(poNumber) {
    const oqlQuery = `poNumber='${poNumber}'`;
    const targetUrl = `${API_BASE_URL}/OrderDetail/query?oql=${encodeURIComponent(oqlQuery)}`;

    const urlencoded = new URLSearchParams();
    urlencoded.append("url", targetUrl);
    urlencoded.append("request_method", "GET");
    urlencoded.append("customer", CUSTOMER_ID);

    const requestOptions = { method: "POST", headers: getHeaders(), body: urlencoded, redirect: "follow" };
    const response = await fetch(PROXY_URL, requestOptions);

    if (!response.ok) throw new Error(`HTTP error during UID lookup: ${response.status}`);

    const rawResult = await response.json();
    if (!Array.isArray(rawResult)) throw new Error("Proxy returned unexpected data structure.");

    let queryData = null;

    for (const item of rawResult) {
        if (typeof item === 'string') {
            try {
                const parsed = JSON.parse(decodeEscapes(item));
                if (parsed && parsed.result) {
                    queryData = parsed;
                    break;
                }
            } catch (e) {
            }
        }
    }

    if (!queryData || !queryData.result || queryData.result.length === 0) {
        throw new Error("No orders found matching this PO Number.");
    }

    return queryData.result.map(order => order.orderUid);
}

export async function fetchOrderData(orderId) {
    const targetUrl = `${API_BASE_URL}/OrderDetail/${encodeURIComponent(orderId)}`;

    const urlencoded = new URLSearchParams();
    urlencoded.append("url", targetUrl);
    urlencoded.append("request_method", "GET");
    urlencoded.append("customer", CUSTOMER_ID);

    const requestOptions = { method: "POST", headers: getHeaders(), body: urlencoded, redirect: "follow" };
    const response = await fetch(PROXY_URL, requestOptions);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const rawResult = await response.json();
    if (!Array.isArray(rawResult)) {
        throw new Error("Proxy API returned an unexpected or empty data structure.");
    }

    let orderData = null;

    // Dynamically search the proxy array for the object containing the 'orderItem' property
    for (const item of rawResult) {
        if (typeof item === 'string') {
            try {
                const parsed = JSON.parse(decodeEscapes(item));
                if (parsed && parsed.orderItem) {
                    orderData = parsed;
                    break;
                }
            } catch (parseError) {
                // Ignore elements that cannot be parsed as valid JSON
            }
        } else if (item && typeof item === 'object') {
            if (item.orderItem) {
                orderData = item;
                break;
            }
        }
    }

    if (!orderData) {
        throw new Error("Could not find order payload containing 'orderItem' in the proxy response.");
    }

    return orderData;
}