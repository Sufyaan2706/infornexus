import { escapeHTML } from './utils.js';

export function extractOrderDataToJson(orderData) {
    if (!orderData || !Array.isArray(orderData.orderItem)) {
        console.error("Invalid order data format");
        return null;
    }

    const jsonSchema = {};

    orderData.orderItem.forEach((item) => {
        const bi = item.baseItem || {};
        const ref = bi.reference || {};
        const id = bi.itemIdentifier || {};
        const itemVar = bi.itemVariance || {};

        const uvariance = parseFloat(itemVar.upperVariance || 0);
        const lvariance = parseFloat(itemVar.lowerVariance || 0);
        const lineAgg = ref.LineAggregator ?? 'Unknown';
        const size = id.IdBuyerSize ?? 'Unknown';

        if (!jsonSchema[lineAgg]) jsonSchema[lineAgg] = {};
        if (!jsonSchema[lineAgg][size]) {
            jsonSchema[lineAgg][size] = {
                maxBoxQty: 0,
                weightPerItem: 0,
                totalShipmentQtyPerSize: 0,
                items: []
            };
        }

        const qty = parseFloat(bi.quantity || 0);
        const itemDetail = {
            itemSequenceNo: id.ItemSequenceNumber ?? '',
            cartonNumbers: "N/A",
            shipMode: ref.AdidasShipMode ?? '',
            itemSts: ref.ItemStatus ?? '',
            quantity: qty,
            variance: { ub: uvariance, lb: lvariance }
        };

        jsonSchema[lineAgg][size].items.push(itemDetail);
        jsonSchema[lineAgg][size].totalShipmentQtyPerSize += qty;
    });

    for (const lineAgg in jsonSchema) {
        const safeLineAggId = `packing-${lineAgg.replace(/\W/g, '_')}`;
        const packingContainer = document.getElementById(safeLineAggId);

        if (packingContainer && packingContainer.querySelector('table')) {
            for (const size in jsonSchema[lineAgg]) {
                const sizeData = jsonSchema[lineAgg][size];

                const maxQtyInput = packingContainer.querySelector(`.max-qty-header-input[data-size="${size}"]`);
                if (maxQtyInput && maxQtyInput.value) sizeData.maxBoxQty = parseInt(maxQtyInput.value, 10);

                const weightInput = packingContainer.querySelector(`.weight-header-input[data-size="${size}"]`);
                if (weightInput && weightInput.value) sizeData.weightPerItem = parseFloat(weightInput.value);

                sizeData.items.forEach(item => {
                    const seq = escapeHTML(item.itemSequenceNo);
                    const inputs = packingContainer.querySelectorAll(`.transparent-input[data-seq="${seq}"]`);
                    const cartonNumbersList = [];

                    inputs.forEach(input => {
                        const tr = input.closest('tr');
                        if (tr) cartonNumbersList.push(tr.cells[0].innerText.trim());
                    });

                    if (cartonNumbersList.length > 0) item.cartonNumbers = cartonNumbersList.join(", ");
                });
            }
        }
    }

    const jsonString = JSON.stringify(jsonSchema, null, 2);
    console.log(jsonString);
    return jsonSchema;
}