# Infor Nexus Order Detail Viewer — Technical Documentation

## Overview

This repository delivers a lightweight browser app that searches for order details in Infor Nexus, renders item and packing tables, and exports structured JSON.

The app uses the following modules:

- `index.html` — main page structure and app shell.
- `styles.css` — UI styling.
- `js/main.js` — search orchestration, user input validation, and render coordination.
- `js/api.js` — API proxy communication and payload decoding.
- `js/ui.js` — DOM rendering for line aggregators, tables, and packing UI.
- `js/export.js` — JSON export builder from order and packing state.
- `js/config.js` — API URL constants and encoded credentials.
- `js/secrets.js` — raw credentials.
- `js/utils.js` — escaping and size-sorting utility helpers.

---

## UML-style Flow Diagram

```mermaid
flowchart TD
    A[Browser Load<br>index.html] --> B[main.js Loaded]
    B --> C[User selects search type]
    C --> D[User enters query and clicks Search / presses Enter]
    D --> E[searchData()]
    E -->|poNumber| F[fetchUidByPoNumber(query)]
    E -->|orderUid| G[fetchOrderData(orderId)]
    F --> H[API Proxy Request via fetch()]
    G --> H
    H --> I[Proxy returns escaped JSON array]
    I --> J[decodeEscapes()]
    J --> K[parse JSON payload]
    K --> L[fetchResult returned to main.js]
    L --> M[renderTables(orderData, container)]
    M --> N[Group items by LineAggregator]
    N --> O[Render original order table per group]
    N --> P[Render global size defaults panel]
    N --> Q[Render packing UI per group via createPackingUI()]
    Q --> R[Render packing table rows and inputs]
    R --> S[User optionally updates max qty/weights]
    S --> T[Re-render packing tables]
    M --> U[Export button click]
    U --> V[extractOrderDataToJson(orderData)]
    V --> W[Build structured JSON and log it]
```

> The above Mermaid flow diagram describes the core runtime path from search input through API calls, rendering, and export.

---

## Detailed Module Reference

### `js/main.js`

#### Purpose

Controls the user search workflow, validates input, and connects request results to rendering.

#### Key DOM references

- `searchType` — dropdown to choose search mode (`poNumber` or `orderUid`).
- `searchInput` — text input for the query.
- `container` — target element for result rendering.

#### Functions

##### `async function searchData()`

- Reads the trimmed query and search type.
- Displays a loading message inside `container`.
- If the query is blank, shows an error message.
- For `poNumber` mode:
  - calls `fetchUidByPoNumber(query)`
  - renders a header indicating how many orders were found
  - fetches and renders each order UID individually
- For `orderUid` mode:
  - fetches and renders the order by UID directly
- Handles errors centrally and renders readable failure messages.

##### `async function fetchAndRenderSingleOrder(orderId)`

- Fetches order details using `fetchOrderData(orderId)`.
- Passes the result to `renderTables(orderData, container)`.
- Displays a per-order error section if fetching fails.

#### Event listeners

- `searchInput` listens for Enter key presses.
- `searchBtn` listens for click events.

---

### `js/api.js`

#### Purpose

Provides API client functions for the Infor Nexus proxy.

#### Helper

##### `function getHeaders()`

- Returns a `Headers` object with:
  - `Content-Type: application/x-www-form-urlencoded`
  - `Authorization: Basic ${creds}`

#### Functions

##### `export async function fetchUidByPoNumber(poNumber)`

- Builds an OQL query string: `poNumber='${poNumber}'`.
- Constructs a proxy request to `PROXY_URL` with `url`, `request_method`, and `customer` fields.
- Sends a `POST` request to the proxy.
- Expects `response.json()` to return an array where index `4` contains an escaped JSON string.
- Decodes that string with `decodeEscapes()` and parses it.
- Returns an array of matching `orderUid` values.
- Throws if HTTP status is not OK, the data structure is invalid, or no orders are found.

##### `export async function fetchOrderData(orderId)`

- Builds a direct order detail endpoint URL and sends it through the proxy.
- Expects a similar escaped payload array response.
- Decodes and parses the payload into a JavaScript object.
- Throws if any expected part of the API response is missing or invalid.

---

### `js/ui.js`

#### Purpose

Renders order detail tables and the packing UI, grouped by `LineAggregator`.

#### Exports

- `renderTables(orderData, containerElement)`
- `createPackingUI(items, packingContainer, globalMaxQtyMap = {}, globalWeightMap = {})`

#### Functions

##### `renderTables(orderData, containerElement)`

- Validates that `orderData.orderItem` exists and is an array.
- Groups items by `ref.LineAggregator`.
- Collects unique buyer sizes and sorts them using `compareSizes()`.
- Builds a global settings box with default fields for each unique size:
  - `Max Qty`
  - `Weight`
- Renders a packing section for each `LineAggregator`:
  - original item table
  - packing container where carton layout is generated
- Adds click handling to "Apply Defaults to All Tables" so all group packing UIs re-render.
- Adds an "Export All to JSON" button.

##### `createPackingUI(items, packingContainer, globalMaxQtyMap = {}, globalWeightMap = {})`

- Clears the packing container.
- Builds per-size maps using global defaults.
- Calls `renderPackingTable(items, maxQtyMap, weightMap, packingContainer)`.

##### `renderPackingTable(items, maxQtyMap, weightMap, container)`

- Creates item batches by preventing duplicate sizes in the same carton row.
- Builds an HTML table that includes:
  - size header columns
  - input rows for max qty and weight
  - carton rows for shipment quantities
- Splits each item quantity into full cartons and one remainder carton when needed.
- Listens for changes to:
  - `.max-qty-header-input` and rerenders the table
  - `.weight-header-input` and stores the value

---

### `js/export.js`

#### Purpose

Transforms rendered order and packing UI state into a structured JSON object.

#### Function

##### `export function extractOrderDataToJson(orderData)`

- Validates that `orderData.orderItem` is present.
- Uses `poNumber` and `orderUid` (or `__metadata.uid`) as top-level JSON keys.
- Builds a nested structure by:
  - line aggregator
  - size
  - item details array
- Captures:
  - `maxBoxQty`
  - `weightPerItem`
  - `totalShipmentQtyPerSize`
  - `items` with sequence number, ship mode, status, quantity, and variance
- Reads current DOM packing inputs and carton assignments to fill export values.
- Sorts final output by line aggregator and size.
- Logs the JSON string and returns the object.

---

### `js/utils.js`

#### Purpose

Shared helper functions for string escaping, decoding, and size order comparison.

#### Functions

##### `export function decodeEscapes(s)`

- Converts escape sequences into actual characters.
- Handles:
  - `\\,` -> `,`
  - `\\uXXXX` -> Unicode character
  - `\\n`, `\\t`, `\\r`
  - `\\\\` -> `\\`
  - `\\"` -> `"`
- If input is not a string, returns `JSON.stringify(s)`.

##### `export function escapeHTML(str)`

- Prevents unsafe HTML injection.
- Converts `null`/`undefined` to `-`.
- Uses `textContent` on a temporary DOM node.

##### `export function getSizeWeight(sizeStr)`

- Normalizes size strings to sort weights.
- Recognizes standard sizes `S`, `M`, `L`.
- Supports extended formats like `XS`, `XXL`, etc.
- Returns numeric weights for numeric sizes.
- Returns `9999` for unknown formats.

##### `export function compareSizes(a, b)`

- Sorts size strings by weight first.
- Falls back to lexical sort for unknown formats.

---

### `js/config.js`

#### Purpose

Holds runtime configuration values and encoded credentials.

#### Exports

- `creds` — Base64-encoded credentials from `js/secrets.js`
- `PROXY_URL` — proxy endpoint used for API requests
- `API_BASE_URL` — Infor Nexus REST API root
- `CUSTOMER_ID` — customer identifier string

---

### `js/secrets.js`

#### Purpose

Stores raw username/password values consumed by `config.js`.

#### Exports

- `uname`
- `pw`

> Security note: these credentials are exposed in browser-delivered code and should be moved to a secure backend in production.

---

## Data Shape Expectations

The application expects order detail responses to contain the following fields:

- `orderData.__metadata.uid`
- `orderData.poNumber`
- `orderData.orderItem` — array of items

Each item should include:

- `baseItem.quantity`
- `baseItem.reference.LineAggregator`
- `baseItem.reference.AdidasShipMode`
- `baseItem.reference.ItemStatus`
- `baseItem.itemIdentifier.IdBuyerSize`
- `baseItem.itemIdentifier.ItemSequenceNumber`
- `baseItem.itemVariance.upperVariance`
- `baseItem.itemVariance.lowerVariance`

---

## Recommended Developer Flow

1. Open `js/main.js` to understand user search flow.
2. Inspect `js/api.js` for proxy communication and response parsing.
3. Review `js/ui.js` for render logic and packing table generation.
4. Check `js/export.js` for how JSON output is assembled.
5. Use `js/utils.js` to understand how sizes are compared and responses are decoded.

---

## Important Notes

- The app currently stores credentials in `js/secrets.js`, which is insecure for production.
- The API response format relies on the proxy returning a JSON array with the useful payload at index `4`.
- The Mermaid diagram above is designed for Markdown renderers that support Mermaid syntax.

---

## Viewing the Diagram

If your Markdown viewer supports Mermaid, the flow chart will render automatically. If not, use a compatible editor such as Visual Studio Code with a Mermaid preview extension.
