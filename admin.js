// This runs only on admin.html — checks access, then loads the product manager.

async function checkAdminAccess() {
  const response = await fetch('/api/admin/check');

  if (response.ok) {
    document.getElementById('admin-content').classList.remove('hidden');
    loadAdminProducts();
    loadAdminOrders();
  } else {
    document.getElementById('access-denied').classList.remove('hidden');
  }
}

// Loads and displays all products, each with a delete button
async function loadAdminProducts() {
  const response = await fetch('/api/products');
  const products = await response.json();

  const list = document.getElementById('admin-product-list');
  list.innerHTML = '';

  products.forEach(function(product) {
    const row = document.createElement('div');
    row.style.padding = '8px 0';
    row.style.borderBottom = '1px solid #eee';
    row.innerHTML =
      product.emoji + ' <strong>' + product.name + '</strong> — ₹' + product.price.toFixed(2) +
      ' (' + product.category + ')' +
      ' <button onclick="deleteProduct(' + product.id + ')" style="background:#c62828; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;">Delete</button>';
    list.appendChild(row);
  });

  // NEW: rebuild the category dropdown from whatever categories currently exist,
  // so it always reflects real data instead of a fixed hardcoded list
  populateCategoryDropdown(products);
}

// NEW: fills the dropdown with each unique category found in the current products
function populateCategoryDropdown(products) {
  const select = document.getElementById('category-select');
  const currentValue = select.value; // remember what was selected, if anything

  // Get a list of unique category names
  const categories = [...new Set(products.map(function(p) { return p.category; }))];

  select.innerHTML = '<option value="">-- Select category --</option>';
  categories.forEach(function(cat) {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });

  const newOption = document.createElement('option');
  newOption.value = '__new__';
  newOption.textContent = '+ Add a new category';
  select.appendChild(newOption);

  select.value = currentValue; // restore selection if it still exists
}

// NEW: shows/hides the "new category name" text box based on dropdown choice
function toggleNewCategoryInput() {
  const select = document.getElementById('category-select');
  const newInput = document.getElementById('new-category-input');

  if (select.value === '__new__') {
    newInput.classList.remove('hidden');
  } else {
    newInput.classList.add('hidden');
  }
}

// Sends the new product form to the server
async function addProduct() {
  const name = document.getElementById('new-name').value;
  const price = document.getElementById('new-price').value;
  const emoji = document.getElementById('new-emoji').value;
  const imageUrl = document.getElementById('new-image-url').value;
  const messageBox = document.getElementById('admin-message');

  // NEW: figure out which category value to actually use —
  // either the typed new one, or whatever's selected in the dropdown
  const select = document.getElementById('category-select');
  let category = select.value;
  if (category === '__new__') {
    category = document.getElementById('new-category-input').value;
  }

  const response = await fetch('/api/admin/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, price: price, emoji: emoji, category: category, imageUrl: imageUrl })
  });

  const result = await response.json();

  if (response.ok) {
    messageBox.textContent = 'Product added!';
    messageBox.style.color = 'green';
    document.getElementById('new-name').value = '';
    document.getElementById('new-price').value = '';
    document.getElementById('new-emoji').value = '';
    document.getElementById('new-image-url').value = '';
    document.getElementById('new-category-input').value = '';
    document.getElementById('category-select').value = '';
    toggleNewCategoryInput();
    loadAdminProducts(); // refresh the list AND the dropdown
  } else {
    messageBox.textContent = result.error;
    messageBox.style.color = 'red';
  }
}

// Deletes a product after asking for confirmation
async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;

  await fetch('/api/admin/products/' + id, { method: 'DELETE' });
  loadAdminProducts(); // refresh the list
}

// Loads all orders (admin view) and displays them with a status dropdown
async function loadAdminOrders() {
  const response = await fetch('/api/admin/orders');
  const orders = await response.json();

  const list = document.getElementById('admin-orders-list');
  list.innerHTML = '';

  if (orders.length === 0) {
    list.innerHTML = '<p>No orders yet.</p>';
    return;
  }

  const statuses = ['Placed', 'Packed', 'Out for Delivery', 'Delivered', 'Cancelled'];

  orders.forEach(function(order) {
    const items = JSON.parse(order.items_json);
    const itemNames = items.map(function(item) {
      const qty = item.qty || 1;
      return item.name + (qty > 1 ? ' x' + qty : '');
    }).join(', ');

    // Build the dropdown options, marking the current status as selected
    let optionsHtml = '';
    statuses.forEach(function(s) {
      const selected = (s === order.status) ? 'selected' : '';
      optionsHtml += '<option value="' + s + '" ' + selected + '>' + s + '</option>';
    });

    const row = document.createElement('div');
    row.style.padding = '10px 0';
    row.style.borderBottom = '1px solid #eee';
    row.innerHTML =
      '<strong>Order #' + order.id + '</strong> — ' + order.customer_email + '<br>' +
      'Items: ' + itemNames + '<br>' +
      'Total: ₹' + order.total.toFixed(2) + '<br>' +
      'Deliver to: ' + order.delivery_address + '<br>' +
      'Status: <select onchange="updateOrderStatus(' + order.id + ', this.value)">' + optionsHtml + '</select>';

    list.appendChild(row);
  });
}

// Sends a status change to the server
async function updateOrderStatus(orderId, newStatus) {
  await fetch('/api/admin/orders/' + orderId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
}

// Run the access check the moment this page loads
window.addEventListener('DOMContentLoaded', checkAdminAccess);
