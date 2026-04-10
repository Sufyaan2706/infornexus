export function decodeEscapes(s) {
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

export function escapeHTML(str) {
    if (str === null || str === undefined) return '-';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

export function getSizeWeight(sizeStr) {
    const size = String(sizeStr).toUpperCase().trim();
    const baseWeights = { 'S': 100, 'M': 200, 'L': 300 };

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

export function compareSizes(a, b) {
    const weightA = getSizeWeight(a);
    const weightB = getSizeWeight(b);

    if (weightA !== 9999 && weightB !== 9999) {
        return weightA - weightB;
    }
    return String(a).localeCompare(String(b));
}