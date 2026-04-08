const fs = require('fs');

const raw = fs.readFileSync('response.json', 'utf-8').trim();

// Find the position of the JSON start
const designPos = raw.indexOf('design');
const pos = designPos - 3; // position of {
console.log('pos:', pos);
console.log('raw.substring(pos, pos+10):', raw.substring(pos, pos + 10));
const start = pos + 1; // the space before {
const end = raw.lastIndexOf('}}') + 3; // the " after }
console.log('start:', start, 'end:', end);
const jsonString = raw.substring(start + 1, end - 1); // the content without quotes

console.log('jsonString starts with:', jsonString.substring(0, 20));
console.log('jsonString ends with:', jsonString.substring(jsonString.length - 20));

// Parse it as JSON string
const obj = JSON.parse(jsonString);

const output = JSON.stringify(obj, null, 2);

console.log('Parsed successfully');

fs.writeFileSync('recons.json', output, 'utf-8');