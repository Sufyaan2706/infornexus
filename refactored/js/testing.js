import fs from 'fs';
import { extractCatalogPayload } from './decodeScript.js';

// Read your uploaded testing.json
const rawFileContent = fs.readFileSync('/home/Raxxit/Data/projects/infor/infornexus/refactored/js/testing.json', 'utf-8');
const rawResultArray = JSON.parse(rawFileContent);

try {
    const cleanJson = extractCatalogPayload(rawResultArray);

    // Output the properly formatted JSON
    console.log(JSON.stringify(cleanJson, null, 2));
} catch (error) {
    console.error("Extraction failed:", error.message);
}