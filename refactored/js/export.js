import { Utils } from './utils.js';

export class OrderExporter {
    static extractToJson(orderData) {
        if (!orderData || !Array.isArray(orderData.orderItem)) return null;

        const poNumber = orderData.poNumber ?? 'Unknown_PO';
        const uid = orderData.orderUid ?? orderData.__metadata?.uid ?? 'Unknown_UID';
        const jsonSchema = { [poNumber]: { [uid]: {} } };
        const lineAggsLevel = jsonSchema[poNumber][uid];

        orderData.orderItem.forEach(item => {
            const bi = item.baseItem || {};
            const ref = bi.reference || {};
            const id = bi.itemIdentifier || {};

            const lineAgg = ref.LineAggregator ?? 'Unknown';
            const size = id.IdBuyerSize ?? 'Unknown';

            lineAggsLevel[lineAgg] ??= {};
            lineAggsLevel[lineAgg][size] ??= { maxBoxQty: 0, weightPerItem: 0, totalShipmentQtyPerSize: 0, items: [] };

            const qty = parseFloat(bi.quantity || 0);
            lineAggsLevel[lineAgg][size].items.push({
                itemSequenceNo: id.ItemSequenceNumber ?? '',
                cartonNumbers: "N/A",
                shipMode: ref.AdidasShipMode ?? '',
                itemSts: ref.ItemStatus ?? '',
                quantity: qty,
                variance: {
                    ub: parseFloat(bi.itemVariance?.upperVariance || 0),
                    lb: parseFloat(bi.itemVariance?.lowerVariance || 0)
                }
            });
            lineAggsLevel[lineAgg][size].totalShipmentQtyPerSize += qty;
        });

        this._enrichFromUI(lineAggsLevel);
        return this._sortSchema(jsonSchema, poNumber, uid, lineAggsLevel);
    }

    static _enrichFromUI(lineAggsLevel) {
        for (const lineAgg in lineAggsLevel) {
            const containerId = `packing-${lineAgg.replace(/\W/g, '_')}`;
            const container = document.getElementById(containerId);
            if (!container || !container.querySelector('table')) continue;

            for (const size in lineAggsLevel[lineAgg]) {
                const sizeData = lineAggsLevel[lineAgg][size];

                const maxQty = container.querySelector(`.max-qty-header-input[data-size="${size}"]`)?.value;
                if (maxQty) sizeData.maxBoxQty = parseInt(maxQty, 10);

                const weight = container.querySelector(`.weight-header-input[data-size="${size}"]`)?.value;
                if (weight) sizeData.weightPerItem = parseFloat(weight);

                sizeData.items.forEach(item => {
                    const seq = Utils.escapeHTML(item.itemSequenceNo);
                    const inputs = container.querySelectorAll(`.transparent-input[data-seq="${seq}"]`);
                    const cartons = Array.from(inputs).map(i => i.closest('tr')?.cells[0].innerText.trim()).filter(Boolean);
                    if (cartons.length) item.cartonNumbers = cartons.join(", ");
                });
            }
        }
    }

    static _sortSchema(schema, poNumber, uid, lineAggsLevel) {
        const sorted = { [poNumber]: { [uid]: {} } };
        const sortedAggs = sorted[poNumber][uid];

        Object.keys(lineAggsLevel).sort().forEach(agg => {
            sortedAggs[agg] = {};
            Object.keys(lineAggsLevel[agg]).sort(Utils.compareSizes).forEach(size => {
                sortedAggs[agg][size] = lineAggsLevel[agg][size];
            });
        });

        console.log(JSON.stringify(sorted, null, 2));
        return sorted;
    }
}