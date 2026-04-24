import { decodeEscapes } from './utils.js';

/**
 * @param {Array} rawResult
 * @returns {Object}
 */
export function extractCatalogPayload(rawResult) {
    if (!Array.isArray(rawResult)) {
        throw new Error("Invalid response format: expected an array from the proxy.");
    }

    let payloadData = null;

    for (const item of rawResult) {
        if (typeof item === 'string') {
            try {
                const decodedStr = decodeEscapes(item);
                const parsed = JSON.parse(decodedStr);

                if (parsed && parsed.result && Array.isArray(parsed.result)) {
                    payloadData = parsed;
                    break;
                }
            } catch (e) {
            }
        } else if (item && typeof item === 'object') {
            if (item.result && Array.isArray(item.result)) {
                payloadData = item;
                break;
            }
        }
    }

    if (!payloadData) {
        throw new Error("Could not find the encoded JSON payload in the proxy response.");
    }

    return payloadData;
}