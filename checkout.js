// This runs only on checkout.html

const FREE_DELIVERY_THRESHOLD = 149; // keep in sync with the server-side value
const DELIVERY_FEE = 20;

// Displays the cart contents as an order summary, and checks login status
async function renderCheckoutSummary() {
  const itemsDiv = document.getElementById('checkout-items');
  const emptyMsg = document.getElementById('checkout-empty-msg');
  const totalDisplay = document.getElementById('checkout-total');
  const formSection = document.getElementById('checkout-form-section');
  const deliveryFeeMsg = document.getElementById('delivery-fee-message');

  itemsDiv.innerHTML = '';

  if (cart.length === 0) {
    emptyMsg.classList.remove('hidden');
    formSection.classList.add('hidden');
    totalDisplay.innerHTML = '';
    deliveryFeeMsg.classList.add('hidden');
    return;
  }

  emptyMsg.classList.add('hidden');

  let subtotal = 0;

  cart.forEach(function(item) {
    const row = document.createElement('div');
    row.className = 'checkout-item-row';

    const visual = item.image_url
      ? '<img src="' + item.image_url + '" class="checkout-item-image" alt="">'
      : '<span class="checkout-item-emoji">' + (item.emoji || '🛒') + '</span>';

    row.innerHTML =
      '<div class="checkout-item-left">' +
        visual +
        '<div>' +
          '<div class="checkout-item-name">' + item.name + '</div>' +
          '<div class="checkout-item-unit-price">₹' + item.price.toFixed(2) + ' each</div>' +
        '</div>' +
      '</div>' +
      '<div class="checkout-item-right">' +
        '<div class="qty-stepper">' +
          '<button onclick="changeQtyOnCheckout(' + item.id + ', -1)">−</button>' +
          '<span>' + item.qty + '</span>' +
          '<button onclick="changeQtyOnCheckout(' + item.id + ', 1)">+</button>' +
        '</div>' +
        '<div class="checkout-item-line-total">₹' + (item.price * item.qty).toFixed(2) + '</div>' +
      '</div>';
    itemsDiv.appendChild(row);
    subtotal += item.price * item.qty;
  });

  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const grandTotal = subtotal + deliveryFee;

  if (deliveryFee > 0) {
    const remaining = (FREE_DELIVERY_THRESHOLD - subtotal).toFixed(2);
    deliveryFeeMsg.innerHTML = '🛵 Add <strong>₹' + remaining + '</strong> more for FREE delivery';
    deliveryFeeMsg.classList.remove('hidden', 'free');
  } else {
    deliveryFeeMsg.innerHTML = '🎉 You\'ve unlocked FREE delivery!';
    deliveryFeeMsg.classList.remove('hidden');
    deliveryFeeMsg.classList.add('free');
  }

  totalDisplay.innerHTML =
    '<div class="bill-row"><span>Subtotal</span><span>₹' + subtotal.toFixed(2) + '</span></div>' +
    '<div class="bill-row"><span>Delivery Fee</span><span>' + (deliveryFee > 0 ? '₹' + deliveryFee.toFixed(2) : '<span class="free-tag">FREE</span>') + '</span></div>' +
    '<div class="bill-row bill-total"><span>To Pay</span><span>₹' + grandTotal.toFixed(2) + '</span></div>';

  // Check if the person is actually logged in before letting them order
  const response = await fetch('/api/me');
  const result = await response.json();

  if (result.loggedIn) {
    formSection.classList.remove('hidden');
    document.getElementById('login-required').classList.add('hidden');
  } else {
    formSection.classList.add('hidden');
    document.getElementById('login-required').classList.remove('hidden');
  }
}

// Adjusts quantity right from the checkout page, same logic as the
// product card steppers — going to 0 removes the item entirely
function changeQtyOnCheckout(productId, delta) {
  let item = cart.find(function(i) { return i.id === productId; });
  if (!item) return;

  // NEW: don't allow increasing past available stock
  if (delta > 0 && item.stock !== null && item.stock !== undefined && item.qty >= item.stock) {
    alert('Only ' + item.stock + ' left in stock.');
    return;
  }

  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(function(i) { return i.id !== productId; });
  }

  saveCartToStorage();
  updateCartDisplay();
  renderCheckoutSummary(); // redraw the whole summary with the new quantities/total
}

async function placeOrder() {
  const address = document.getElementById('delivery-address').value;
  const messageBox = document.getElementById('checkout-message');

  if (!address.trim()) {
    messageBox.textContent = 'Please enter a delivery address.';
    messageBox.style.color = 'red';
    return;
  }

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: cart, deliveryAddress: address })
  });

  const result = await response.json();

  if (response.ok) {
    cart = [];
    saveCartToStorage();
    updateCartDisplay();

    document.getElementById('checkout-summary').classList.add('hidden');
    document.getElementById('success-order-id').textContent =
      'Order #' + result.orderId + ' — Total: ₹' + result.total.toFixed(2) +
      (result.deliveryFee > 0 ? ' (incl. ₹' + result.deliveryFee.toFixed(2) + ' delivery fee)' : ' (Free delivery)');
    document.getElementById('order-success').classList.remove('hidden');
  } else {
    messageBox.textContent = result.error;
    messageBox.style.color = 'red';
  }
}

window.addEventListener('DOMContentLoaded', function() {
  checkLoginStatus();
  renderCheckoutSummary();
});
