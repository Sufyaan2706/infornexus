import { escapeHTML, compareSizes } from './utils.js';

export function extractOrderDataToJson(orderData) {
    if (!orderData || !Array.isArray(orderData.orderItem)) {
        console.error("Invalid order data format");
        return null;
    }

    const poNumber = orderData.poNumber ?? 'Unknown_PO';
    const uid = orderData.orderUid ?? orderData.__metadata?.uid ?? 'Unknown_UID';

    const jsonSchema = {
        [poNumber]: {
            [uid]: {}
        }
    };

    const lineAggsLevel = jsonSchema[poNumber][uid];

    orderData.orderItem.forEach((item) => {
        const bi = item.baseItem || {};
        const ref = bi.reference || {};
        const id = bi.itemIdentifier || {};
        const itemVar = bi.itemVariance || {};

        const uvariance = parseFloat(itemVar.upperVariance || 0);
        const lvariance = parseFloat(itemVar.lowerVariance || 0);
        const lineAgg = ref.LineAggregator ?? 'Unknown';
        const size = id.IdBuyerSize ?? 'Unknown';

        if (!lineAggsLevel[lineAgg]) lineAggsLevel[lineAgg] = {};
        if (!lineAggsLevel[lineAgg][size]) {
            lineAggsLevel[lineAgg][size] = {
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

        lineAggsLevel[lineAgg][size].items.push(itemDetail);
        lineAggsLevel[lineAgg][size].totalShipmentQtyPerSize += qty;
    });

    for (const lineAgg in lineAggsLevel) {
        const safeLineAggId = `packing-${lineAgg.replace(/\W/g, '_')}`;
        const packingContainer = document.getElementById(safeLineAggId);

        if (packingContainer && packingContainer.querySelector('table')) {
            for (const size in lineAggsLevel[lineAgg]) {
                const sizeData = lineAggsLevel[lineAgg][size];

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

    const sortedJsonSchema = {
        [poNumber]: {
            [uid]: {}
        }
    };

    const sortedLineAggsLevel = sortedJsonSchema[poNumber][uid];
    const sortedLineAggs = Object.keys(lineAggsLevel).sort();

    sortedLineAggs.forEach(lineAgg => {
        sortedLineAggsLevel[lineAgg] = {};

        const sortedSizes = Object.keys(lineAggsLevel[lineAgg]).sort(compareSizes);

        sortedSizes.forEach(size => {
            sortedLineAggsLevel[lineAgg][size] = lineAggsLevel[lineAgg][size];
        });
    });

    const jsonString = JSON.stringify(sortedJsonSchema, null, 2);
    console.log(jsonString);

    return sortedJsonSchema;
}