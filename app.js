    function calculateTotal() {
      const tier = document.getElementById('tier-select').value;
      const addTB = parseInt(document.getElementById('add-tb').value, 10) || 0;
      const months = parseInt(document.getElementById('lease-months').value, 10) || 1;

      let baseCost = 2500;
      let initialTB = 1;

      if (tier === 'growth') { baseCost = 3500; initialTB = 5; }
      if (tier === 'enterprise') { baseCost = 4750; initialTB = 10; }

      const totalTB = initialTB + addTB;
      // Extra TBs priced at $750/mo each
      let monthlyRate = baseCost + (addTB * 750);

      // Straight monthly rate with no discounts applied for extra months
      const grandTotal = Math.round(monthlyRate * months);

      document.getElementById('checkout-total-display').textContent = `$${grandTotal.toLocaleString()} Total (${months} mo)`;
      document.getElementById('allocated-tb-display').textContent = `${totalTB} TB (${document.getElementById('tier-select').selectedOptions[0].text.split('—')[0]})`;
      document.getElementById('available-tb-display').textContent = `${(totalTB - 0.28).toFixed(2)} TB`;
    }
