import { Utils } from './utils.js';

export class OrderExporter {
    static extractToJson(state) {
        const orderData = state.orderData;
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
            lineAggsLevel[lineAgg][size] ??= {
                maxBoxQty: state.tableConfigs[lineAgg]?.maxQtyMap[size] || 0,
                weightPerItem: state.validationWeights[size] || 0,
                totalShipmentQtyPerSize: 0,
                items: [],
                packingDetails: []
            };

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

        // 2. Enrich with real-time UI state
        this._enrichFromState(lineAggsLevel, state.packingData);

        // 3. Sort and dump to console
        return this._sortAndLogSchema(jsonSchema, poNumber, uid, lineAggsLevel);
    }

    static _enrichFromState(lineAggsLevel, packingData) {
        for (const lineAgg in packingData) {
            if (!lineAggsLevel[lineAgg]) continue;

            const lines = packingData[lineAgg];
            lines.forEach(packLine => {
                const size = packLine.size;
                if (lineAggsLevel[lineAgg][size]) {
                    // Push the full packing row details into the size data
                    lineAggsLevel[lineAgg][size].packingDetails.push(packLine);

                    // Update the specific item's carton number based on sequence
                    const targetItem = lineAggsLevel[lineAgg][size].items.find(i => i.itemSequenceNo === packLine.sequenceNumber);
                    if (targetItem) {
                        if (targetItem.cartonNumbers === "N/A") {
                            targetItem.cartonNumbers = packLine.cartonLabel;
                        } else {
                            targetItem.cartonNumbers += `, ${packLine.cartonLabel}`;
                        }
                    }
                }
            });
        }
    }

    static _sortAndLogSchema(schema, poNumber, uid, lineAggsLevel) {
        const sorted = { [poNumber]: { [uid]: {} } };
        const sortedAggs = sorted[poNumber][uid];

        Object.keys(lineAggsLevel).sort().forEach(agg => {
            sortedAggs[agg] = {};
            Object.keys(lineAggsLevel[agg]).sort(Utils.compareSizes).forEach(size => {
                sortedAggs[agg][size] = lineAggsLevel[agg][size];
            });
        });

        console.log('--- EXPORTED ORDER DATA ---');
        console.log(JSON.stringify(sorted, null, 2));
        return sorted;
    }
}