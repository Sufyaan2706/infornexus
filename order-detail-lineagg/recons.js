const fs = require('fs');

const raw = fs.readFileSync('data.txt', 'utf-8').trim();

//
const rawFixed = raw.replaceAll('\\,', ',');

const decoded = rawFixed
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"');

const obj = JSON.parse(decoded);

const output = JSON.stringify(obj, null, 2);

console.log(output);

fs.writeFileSync('recons.json', output, 'utf-8');