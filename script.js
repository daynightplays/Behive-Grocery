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

// Run loadProducts() the moment the page finishes loading
window.addEventListener('DOMContentLoaded', loadProducts);

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
