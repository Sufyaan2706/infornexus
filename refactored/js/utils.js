export class Utils {
    static decodeEscapes(s) {
        if (typeof s !== 'string') return JSON.stringify(s);
        return s.replace(/\\,/g, ',')
            .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/\\[ntr\\"]/g, m => ({ '\\n': '\n', '\\t': '\t', '\\r': '\r', '\\\\': '\\', '\\"': '"' }[m]));
    }

    static escapeHTML(str) {
        if (str == null) return '-';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    static getSizeWeight(sizeStr) {
        const size = String(sizeStr).toUpperCase().trim();
        const baseWeights = { 'S': 100, 'M': 200, 'L': 300 };

        if (baseWeights[size]) return baseWeights[size];
        if (size.endsWith('XS')) return 100 - (parseInt(size.replace('XS', '') || 1, 10));
        if (size.endsWith('XL')) return 300 + (parseInt(size.replace('XL', '') || 1, 10));
        if (!isNaN(size) && size !== '') return parseFloat(size);

        return 9999;
    }

    static compareSizes(a, b) {
        const weightA = Utils.getSizeWeight(a);
        const weightB = Utils.getSizeWeight(b);
        if (weightA !== 9999 && weightB !== 9999) return weightA - weightB;
        return String(a).localeCompare(String(b));
    }

    static el(tag, { className, html, style } = {}) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (html !== undefined) node.innerHTML = html;
        if (style) Object.assign(node.style, style);
        return node;
    }

    // --- NEW MODULAR HELPERS ---

    static groupBy(array, keyProp) {
        return array.reduce((acc, item) => {
            const key = item[keyProp];
            if (key !== undefined) {
                (acc[key] = acc[key] || []).push(item);
            }
            return acc;
        }, {});
    }

    static buildTable(headers, bodyRows, footerRow = '', className = '') {
        const headHtml = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
        const bodyHtml = `<tbody>${bodyRows.join('')}${footerRow ? `<tr class="total-row">${footerRow}</tr>` : ''}</tbody>`;
        return this.el('table', { className, html: headHtml + bodyHtml });
    }
}