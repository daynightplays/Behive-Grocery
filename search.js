// This runs only on search.html

async function loadSearchResults() {
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q') || '';

  // Pre-fill the search box with the current query, so it's clear what was searched
  document.getElementById('search-input').value = query;

  const response = await fetch('/api/products');
  const products = await response.json();
  allProductsCache = products; // keep this in sync, same as script.js does

  const matches = products.filter(function(product) {
    return product.name.toLowerCase().includes(query.toLowerCase());
  });

  const titleEl = document.getElementById('search-results-title');
  titleEl.textContent = matches.length + ' result' + (matches.length !== 1 ? 's' : '') + ' for "' + query + '"';

  const grid = document.getElementById('search-product-grid');
  grid.innerHTML = '';

  if (matches.length === 0) {
    grid.innerHTML = '<p>No products found. Try a different search.</p>';
    return;
  }

  matches.forEach(function(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    const visual = product.image_url
      ? '<img src="' + product.image_url + '" class="product-image" alt="' + product.name + '">'
      : '<div class="product-emoji">' + product.emoji + '</div>';
    card.innerHTML =
      visual +
      '<h3>' + product.name + '</h3>' +
      '<p class="price">₹' + product.price.toFixed(2) + '</p>' +
      '<div id="qty-container-' + product.id + '">' + qtyControlHTML(product) + '</div>';
    grid.appendChild(card);
  });
}

window.addEventListener('DOMContentLoaded', function() {
  loadSearchResults();
  checkLoginStatus();
  updateCartDisplay();
});
