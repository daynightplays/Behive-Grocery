// The cart is an array of objects — each one holds an id, name, price, AND qty.
function loadCartFromStorage() {
  const saved = localStorage.getItem('buyhive_cart');
  return saved ? JSON.parse(saved) : [];
}

function saveCartToStorage() {
  localStorage.setItem('buyhive_cart', JSON.stringify(cart));
}

let cart = loadCartFromStorage();

// NEW: pressing Enter in the search box takes you to a dedicated results page,
// same as typing a search on Blinkit and hitting search
let allProductsCache = []; // filled in by loadProducts, reused by search.js too

function handleSearchKey(event) {
  if (event.key === 'Enter') {
    const query = document.getElementById('search-input').value.trim();
    if (query) {
      window.location.href = 'search.html?q=' + encodeURIComponent(query);
    }
  }
}

// NEW: shows a quick list of matching product names as you type,
// for fast recognition before you even hit Enter — clicking one jumps
// straight to that product's full search results
function handleSearchInput() {
  const query = document.getElementById('search-input').value.trim().toLowerCase();
  const box = document.getElementById('search-suggestions');
  if (!box) return; // safety check in case this page doesn't have one

  if (query === '') {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }

  const matches = allProductsCache
    .filter(function(product) { return product.name.toLowerCase().includes(query); })
    .slice(0, 6); // keep the list short and fast to scan, like Blinkit does

  if (matches.length === 0) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }

  box.innerHTML = '';
  matches.forEach(function(product) {
    const row = document.createElement('a');
    row.className = 'suggestion-row';
    row.href = 'search.html?q=' + encodeURIComponent(product.name);
    const visual = product.image_url
      ? '<img src="' + product.image_url + '" class="suggestion-image" alt="">'
      : '<span class="suggestion-emoji">' + product.emoji + '</span>';
    row.innerHTML = visual + '<span>' + product.name + '</span>';
    box.appendChild(row);
  });

  box.classList.remove('hidden');
}

// NEW: finds how many of a given product are currently in the cart
function getQty(productId) {
  const item = cart.find(function(i) { return i.id === productId; });
  return item ? item.qty : 0;
}

// NEW: builds the HTML for either the "Add to Cart" button or the +/- stepper,
// depending on whether this product is already in the cart
function qtyControlHTML(product) {
  const qty = getQty(product.id);

  if (qty === 0) {
    return '<button onclick="changeQty(' + product.id + ', 1)">Add to Cart</button>';
  }

  return '<div class="qty-stepper">' +
    '<button onclick="changeQty(' + product.id + ', -1)">−</button>' +
    '<span>' + qty + '</span>' +
    '<button onclick="changeQty(' + product.id + ', 1)">+</button>' +
  '</div>';
}

// NEW: as soon as the page loads, ask the server for the product list
// (which the server pulls straight from the database) and build the cards.
async function loadProducts() {
  const grid = document.getElementById('product-grid');
  if (!grid) return; // this page (e.g. search.html) doesn't have this element — skip safely

  const response = await fetch('/api/products');
  const products = await response.json();
  allProductsCache = products; // NEW: keep a copy for instant search filtering
  grid.innerHTML = '';

  // Check if the URL says "show only this one category"
  const urlParams = new URLSearchParams(window.location.search);
  const filterCategory = urlParams.get('category');

  // Group products by category
  const grouped = {};
  products.forEach(function(product) {
    const cat = product.category || 'Other';
    if (!grouped[cat]) {
      grouped[cat] = [];
    }
    grouped[cat].push(product);
  });

  if (filterCategory) {
    // NEW: we're viewing ONE category — show its products
    const backLink = document.createElement('a');
    backLink.href = 'index.html';
    backLink.textContent = '← All Categories';
    backLink.className = 'back-link';
    grid.appendChild(backLink);

    const section = document.createElement('div');
    section.className = 'category-section';

    const heading = document.createElement('h3');
    heading.className = 'category-heading';
    heading.textContent = filterCategory;
    section.appendChild(heading);

    const row = document.createElement('div');
    row.className = 'product-grid';

    const items = grouped[filterCategory] || [];
    items.forEach(function(product) {
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
      row.appendChild(card);
    });

    section.appendChild(row);
    grid.appendChild(section);

  } else {
    // NEW: homepage view — show only category TILES, no products listed yet
    const tileGrid = document.createElement('div');
    tileGrid.className = 'category-tile-grid';

    Object.keys(grouped).forEach(function(categoryName) {
      const tile = document.createElement('a');
      tile.className = 'category-tile';
      tile.href = 'index.html?category=' + encodeURIComponent(categoryName);

      const firstProduct = grouped[categoryName][0];
      const visual = firstProduct.image_url
        ? '<img src="' + firstProduct.image_url + '" class="tile-image" alt="' + categoryName + '">'
        : '<div class="tile-emoji">' + firstProduct.emoji + '</div>';

      tile.innerHTML = visual + '<div class="tile-label">' + categoryName + '</div>';
      tileGrid.appendChild(tile);
    });

    grid.appendChild(tileGrid);
  }
}

// Run these the moment the page finishes loading
window.addEventListener('DOMContentLoaded', function() {
  loadProducts();
  checkLoginStatus();
  updateCartDisplay();
});

// NEW: handles both "Add to Cart" (delta = 1) and the +/- stepper buttons.
// Looks up full product details (name, price, emoji, image) from the cache
// so the cart always stores complete info — used later for checkout images.
function changeQty(productId, delta) {
  let item = cart.find(function(i) { return i.id === productId; });

  if (item) {
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter(function(i) { return i.id !== productId; });
    }
  } else if (delta > 0) {
    const product = allProductsCache.find(function(p) { return p.id === productId; });
    if (!product) return; // safety: shouldn't happen, but avoid crashing if it does
    cart.push({
      id: productId,
      name: product.name,
      price: product.price,
      qty: 1,
      emoji: product.emoji,
      image_url: product.image_url
    });
  }

  saveCartToStorage();
  updateCartDisplay();
  console.log('Cart contents:', cart);

  // Redraw this product's control wherever it's shown as a card
  const container = document.getElementById('qty-container-' + productId);
  if (container) {
    container.innerHTML = qtyControlHTML({ id: productId });
  }
}

// NEW: updates both the header count AND the bottom cart bar —
// used on every page that includes script.js
function updateCartDisplay() {
  let totalItems = 0;
  let totalPrice = 0;
  cart.forEach(function(item) {
    totalItems += item.qty;
    totalPrice += item.qty * item.price;
  });

  const countEl = document.getElementById('cart-count');
  if (countEl) {
    countEl.textContent = totalItems;
  }

  const bar = document.getElementById('cart-bar');
  const barInfo = document.getElementById('cart-bar-info');
  if (!bar) return; // this page doesn't have a cart bar (e.g. checkout.html itself)

  if (totalItems === 0) {
    bar.classList.add('hidden');
    return;
  }

  barInfo.textContent = totalItems + ' item' + (totalItems > 1 ? 's' : '') + ' · ₹' + totalPrice.toFixed(2);
  bar.classList.remove('hidden');
}

// NEW: shows/hides the signup/login box
function toggleAuth() {
  const panel = document.getElementById('auth-panel');
  panel.classList.toggle('hidden');
}

// NEW: sends the signup form's email/password to the server
async function signup() {
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const messageBox = document.getElementById('auth-message');

  const response = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  });

  const result = await response.json();

  if (response.ok) {
    messageBox.textContent = result.message + ' You can log in now.';
    messageBox.style.color = 'green';
  } else {
    messageBox.textContent = result.error;
    messageBox.style.color = 'red';
  }
}

// NEW: sends login form data to the server
async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const messageBox = document.getElementById('auth-message');

  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, password: password })
  });

  const result = await response.json();

  if (response.ok) {
    messageBox.textContent = '';
    updateAuthUI(true, result.email);
    toggleAuth(); // close the panel after successful login
  } else {
    messageBox.textContent = result.error;
    messageBox.style.color = 'red';
  }
}

// NEW: logs the user out
async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  updateAuthUI(false);
}

// NEW: switches between the signup and login forms inside the panel
function showLogin() {
  document.getElementById('signup-view').classList.add('hidden');
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('auth-message').textContent = '';
}

function showSignup() {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('signup-view').classList.remove('hidden');
  document.getElementById('auth-message').textContent = '';
}

// UPDATED: also shows/hides the "My Orders" link based on login state
function updateAuthUI(loggedIn, email) {
  const authLink = document.getElementById('auth-link');
  const ordersLink = document.getElementById('orders-link');

  // NEW: some pages (like checkout.html) have a simpler header without these —
  // skip safely instead of crashing if they're missing
  if (!authLink) return;

  if (loggedIn) {
    authLink.textContent = 'Hi, ' + email + ' (Log out)';
    authLink.onclick = function() { logout(); return false; };
    if (ordersLink) ordersLink.classList.remove('hidden');
  } else {
    authLink.textContent = 'Sign Up / Log In';
    authLink.onclick = function() { toggleAuth(); return false; };
    if (ordersLink) ordersLink.classList.add('hidden');
  }
}

// NEW: shows/hides the My Orders panel, loading fresh data each time it opens
async function toggleOrders() {
  const panel = document.getElementById('orders-panel');
  panel.classList.toggle('hidden');

  if (!panel.classList.contains('hidden')) {
    await loadOrders();
  }
}

// NEW: fetches the logged-in user's orders and displays them
async function loadOrders() {
  const response = await fetch('/api/orders');
  const orders = await response.json();

  const list = document.getElementById('orders-list');
  list.innerHTML = '';

  if (orders.length === 0) {
    list.innerHTML = '<p>No orders yet.</p>';
    return;
  }

  orders.forEach(function(order) {
    // items_json was stored as text — JSON.parse turns it back into a real array
    const items = JSON.parse(order.items_json);
    const itemNames = items.map(function(item) {
      const qty = item.qty || 1; // older orders may not have a qty field
      return item.name + (qty > 1 ? ' x' + qty : '');
    }).join(', ');

    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML =
      '<strong>Order #' + order.id + '</strong> — <span class="order-status">' + order.status + '</span><br>' +
      'Items: ' + itemNames + '<br>' +
      'Total: ₹' + order.total.toFixed(2) + '<br>' +
      'Deliver to: ' + order.delivery_address;

    list.appendChild(card);
  });
}

// NEW: checks with the server whether we're already logged in,
// as soon as the page loads (so refreshing doesn't log you out)
async function checkLoginStatus() {
  const response = await fetch('/api/me');
  const result = await response.json();
  updateAuthUI(result.loggedIn, result.email);
}
