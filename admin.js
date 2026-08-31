// This runs only on admin.html — checks access, then loads the product manager.

async function checkAdminAccess() {
  const response = await fetch('/api/admin/check');

  if (response.ok) {
    document.getElementById('admin-content').classList.remove('hidden');
    loadAdminProducts();

    // NEW: only show order management on the main page — a category detail
    // view should stay focused on just that category's products
    const urlParams = new URLSearchParams(window.location.search);
    const isViewingOneCategory = urlParams.has('category');
    const ordersSection = document.getElementById('admin-orders-section');

    if (isViewingOneCategory) {
      ordersSection.classList.add('hidden');
    } else {
      ordersSection.classList.remove('hidden');
      loadAdminOrders();
    }
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

  // Group products by category
  const grouped = {};
  products.forEach(function(product) {
    const cat = product.category || 'Other';
    if (!grouped[cat]) {
      grouped[cat] = [];
    }
    grouped[cat].push(product);
  });

  // NEW: check if we're viewing one specific category
  const urlParams = new URLSearchParams(window.location.search);
  const filterCategory = urlParams.get('category');

  if (filterCategory) {
    // DETAIL VIEW: just this category's products, with a back link
    const backLink = document.createElement('a');
    backLink.href = 'admin.html';
    backLink.textContent = '← All Categories';
    backLink.className = 'back-link';
    list.appendChild(backLink);

    const heading = document.createElement('h3');
    heading.className = 'admin-category-heading';
    heading.textContent = filterCategory;
    list.appendChild(heading);

    const items = grouped[filterCategory] || [];
    if (items.length === 0) {
      list.innerHTML += '<p>No products in this category yet.</p>';
    } else {
      items.forEach(function(product) {
        const row = document.createElement('div');
        row.className = 'admin-product-row';
        row.innerHTML =
          '<span class="admin-product-info">' + product.emoji + ' <strong>' + product.name + '</strong> — ₹' + product.price.toFixed(2) + '</span>' +
          '<button onclick="deleteProduct(' + product.id + ')" class="admin-delete-btn">Delete</button>';
        list.appendChild(row);
      });
    }

  } else {
    // LIST VIEW: category tiles, click one to see its products
    const tileGrid = document.createElement('div');
    tileGrid.className = 'admin-category-tile-grid';

    Object.keys(grouped).forEach(function(categoryName) {
      const tile = document.createElement('a');
      tile.className = 'admin-category-tile';
      tile.href = 'admin.html?category=' + encodeURIComponent(categoryName);
      tile.innerHTML =
        '<div class="admin-tile-name">' + categoryName + '</div>' +
        '<div class="admin-tile-count">' + grouped[categoryName].length + ' product' + (grouped[categoryName].length !== 1 ? 's' : '') + '</div>';
      tileGrid.appendChild(tile);
    });

    list.appendChild(tileGrid);
  }

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
// NEW: shows a small preview of the selected photo before uploading
function showPhotoPreview() {
  const fileInput = document.getElementById('new-photo');
  const preview = document.getElementById('photo-preview');

  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.src = e.target.result;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    preview.classList.add('hidden');
  }
}

async function addProduct() {
  const name = document.getElementById('new-name').value;
  const price = document.getElementById('new-price').value;
  const emoji = document.getElementById('new-emoji').value;
  const imageUrl = document.getElementById('new-image-url').value;
  const photoFile = document.getElementById('new-photo').files[0];
  const messageBox = document.getElementById('admin-message');

  // NEW: figure out which category value to actually use —
  // either the typed new one, or whatever's selected in the dropdown
  const select = document.getElementById('category-select');
  let category = select.value;
  if (category === '__new__') {
    category = document.getElementById('new-category-input').value;
  }

  // NEW: FormData is required when sending an actual file — it lets the
  // browser package text fields AND a file together in one request
  const formData = new FormData();
  formData.append('name', name);
  formData.append('price', price);
  formData.append('emoji', emoji);
  formData.append('category', category);
  formData.append('imageUrl', imageUrl);
  if (photoFile) {
    formData.append('photo', photoFile);
  }

  const response = await fetch('/api/admin/products', {
    method: 'POST',
    body: formData
    // NOTE: no Content-Type header here — the browser sets it automatically
    // for FormData, including the special boundary marker it needs
  });

  const result = await response.json();

  if (response.ok) {
    messageBox.textContent = 'Product added!';
    messageBox.style.color = 'green';
    document.getElementById('new-name').value = '';
    document.getElementById('new-price').value = '';
    document.getElementById('new-emoji').value = '';
    document.getElementById('new-image-url').value = '';
    document.getElementById('new-photo').value = '';
    document.getElementById('photo-preview').classList.add('hidden');
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
      '<strong>Order #' + order.id + '</strong> — ' + (order.customer_name || 'N/A') + ' (' + order.customer_phone + ') — ' + order.customer_email + '<br>' +
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
