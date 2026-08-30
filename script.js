// The cart is an array of objects — each one holds a name AND a price.
let cart = [];

// NEW: as soon as the page loads, ask the server for the product list
// (which the server pulls straight from the database) and build the cards.
async function loadProducts() {
  const response = await fetch('/api/products');
  const products = await response.json();

  const grid = document.getElementById('product-grid');
  grid.innerHTML = ''; // clear it out first, just in case

  products.forEach(function(product) {
    const card = document.createElement('div');
    card.className = 'product-card';

    card.innerHTML =
      '<div class="product-emoji">' + product.emoji + '</div>' +
      '<h3>' + product.name + '</h3>' +
      '<p class="price">$' + product.price.toFixed(2) + '</p>' +
      '<button onclick="addToCart(\'' + product.name + '\', ' + product.price + ')">Add to Cart</button>';

    grid.appendChild(card);
  });
}

// Run these the moment the page finishes loading
window.addEventListener('DOMContentLoaded', function() {
  loadProducts();
  checkLoginStatus();
});

function addToCart(productName, productPrice) {
  cart.push({ name: productName, price: productPrice });
  document.getElementById('cart-count').textContent = cart.length;
  console.log('Cart contents:', cart);
  renderCart();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  document.getElementById('cart-count').textContent = cart.length;
  console.log('Cart contents after removal:', cart);
  renderCart();
}

function renderCart() {
  const cartItemsList = document.getElementById('cart-items');
  const emptyMsg = document.getElementById('cart-empty-msg');
  const totalDisplay = document.getElementById('cart-total');

  cartItemsList.innerHTML = '';

  if (cart.length === 0) {
    emptyMsg.style.display = 'block';
    totalDisplay.textContent = '';
    return;
  }

  emptyMsg.style.display = 'none';

  let total = 0;

  for (let i = 0; i < cart.length; i++) {
    const item = cart[i];
    const li = document.createElement('li');

    li.innerHTML =
      '<span>' + item.name + '</span>' +
      '<span>$' + item.price.toFixed(2) +
      ' <button class="remove-btn" onclick="removeFromCart(' + i + ')">✕</button></span>';

    cartItemsList.appendChild(li);
    total = total + item.price;
  }

  totalDisplay.textContent = 'Total: $' + total.toFixed(2);
}

function toggleCart() {
  const panel = document.getElementById('cart-panel');
  panel.classList.toggle('hidden');
}

// NEW: shows the delivery address form when "Checkout" is clicked
function showCheckout() {
  if (cart.length === 0) {
    alert('Your cart is empty — add something first!');
    return;
  }
  document.getElementById('checkout-view').classList.remove('hidden');
}

// NEW: sends the order to the server
async function placeOrder() {
  const address = document.getElementById('delivery-address').value;
  const messageBox = document.getElementById('checkout-message');

  if (!address.trim()) {
    messageBox.textContent = 'Please enter a delivery address.';
    messageBox.style.color = 'red';
    return;
  }

  // Recalculate the total the same way renderCart() does
  let total = 0;
  cart.forEach(function(item) { total += item.price; });

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: cart, total: total, deliveryAddress: address })
  });

  const result = await response.json();

  if (response.ok) {
    messageBox.textContent = 'Order placed! Order #' + result.orderId + '. Pay cash on delivery.';
    messageBox.style.color = 'green';

    // Empty the cart now that the order is placed
    cart = [];
    document.getElementById('cart-count').textContent = 0;
    renderCart();
    document.getElementById('delivery-address').value = '';
  } else {
    messageBox.textContent = result.error;
    messageBox.style.color = 'red';

    // If not logged in, tell them clearly and open the login panel
    if (response.status === 401) {
      toggleAuth();
      showLogin();
    }
  }
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

  if (loggedIn) {
    authLink.textContent = 'Hi, ' + email + ' (Log out)';
    authLink.onclick = function() { logout(); return false; };
    ordersLink.classList.remove('hidden');
  } else {
    authLink.textContent = 'Sign Up / Log In';
    authLink.onclick = function() { toggleAuth(); return false; };
    ordersLink.classList.add('hidden');
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
    const itemNames = items.map(function(item) { return item.name; }).join(', ');

    const card = document.createElement('div');
    card.className = 'order-card';
    card.innerHTML =
      '<strong>Order #' + order.id + '</strong> — <span class="order-status">' + order.status + '</span><br>' +
      'Items: ' + itemNames + '<br>' +
      'Total: $' + order.total.toFixed(2) + '<br>' +
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
