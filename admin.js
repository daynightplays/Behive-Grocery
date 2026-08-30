// This runs only on admin.html — checks access, then loads the product manager.

async function checkAdminAccess() {
  const response = await fetch('/api/admin/check');

  if (response.ok) {
    document.getElementById('admin-content').classList.remove('hidden');
    loadAdminProducts();
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
      ' <button onclick="deleteProduct(' + product.id + ')" style="background:#c62828; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;">Delete</button>';
    list.appendChild(row);
  });
}

// Sends the new product form to the server
async function addProduct() {
  const name = document.getElementById('new-name').value;
  const price = document.getElementById('new-price').value;
  const emoji = document.getElementById('new-emoji').value;
  const messageBox = document.getElementById('admin-message');

  const response = await fetch('/api/admin/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, price: price, emoji: emoji })
  });

  const result = await response.json();

  if (response.ok) {
    messageBox.textContent = 'Product added!';
    messageBox.style.color = 'green';
    document.getElementById('new-name').value = '';
    document.getElementById('new-price').value = '';
    document.getElementById('new-emoji').value = '';
    loadAdminProducts(); // refresh the list
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

// Run the access check the moment this page loads
window.addEventListener('DOMContentLoaded', checkAdminAccess);
