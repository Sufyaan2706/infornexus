let globalData = [];
// Fetch data from data.json
fetch('data.json')
  .then(response => response.json())
  .then(orderData => {


    // Group items by LineAggregator
    const groups = {};

    orderData.orderItem.forEach((item) => {
      const ref = item.baseItem.reference || {};
      const lineAgg = ref.LineAggregator ?? 'Unknown';

      // If this group doesn't exist yet, create it
      if (!groups[lineAgg]) {
        groups[lineAgg] = [];
      }

      // Add the item into its group
      groups[lineAgg].push(item);
    });

    // For each group, build a separate table
    const container = document.getElementById('container');

    Object.keys(groups).forEach(lineAgg => {
      const items = groups[lineAgg];
      let totalQty = 0;

      // Create a heading for this group
      const heading = document.createElement('h2');
      heading.textContent = `Line Aggregator — ${lineAgg}`;
      container.appendChild(heading);

      // Create the table
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr>
          <th>Item Uid</th>
          <th>Market Po Number</th>  
          <th>Description</th>
          <th>Brand</th>
          <th>Item Status</th>
          <th>Size</th>
          <th>Quantity</th>
            
          </tr>
        </thead>
      `;

      const tbody = document.createElement('tbody');

      // Loop through items
      items.forEach((item, i) => {
        const bi = item.baseItem;
        const ref = bi.reference || {};
        const id = bi.itemIdentifier || {};
        const qty = parseFloat(bi.quantity || 0);
        totalQty += qty;

        const row = document.createElement('tr');
        row.innerHTML = `
        
          <td><span class="status">${bi.itemUid ?? '—'}</span></td>
          <td><span class="number">${orderData.poNumber ?? '—'}</span></td>
          <td><span class="description">${id.ShortDescription ?? '—'}</span></td>
          <td><span class="brand">${ref.BrandDescription ?? '—'}</span></td>
          <td><span class="status">${ref.ItemStatus ?? '—'}</span></td>
          <td><span class="size">${id.IdBuyerSize ?? '—'}</span></td>
          <td><span class="qty">${bi.quantity ?? '—'}</span></td>
          
        `;
        tbody.appendChild(row);
      });

      // Add total row 
      const totalRow = document.createElement('tr');
      totalRow.className = 'total-row';
      totalRow.innerHTML = `
        <td colspan="6"><strong>TOTAL QUANTITY</strong></td>
        <td><strong>${totalQty}</strong></td>
      `;
      tbody.appendChild(totalRow);

      table.appendChild(tbody);
      container.appendChild(table);

      // Add spacing between tables
      const spacer = document.createElement('div');
      spacer.style.marginBottom = '40px';
      container.appendChild(spacer);
    });


  })

  // Error Checker

  .catch(error => {
    console.error('Error loading data.json:', error);
    document.getElementById('container').innerHTML = `
      <div class="error">
        Failed to load data.json. Make sure you are running a local server.
      </div>
    `;
  });


