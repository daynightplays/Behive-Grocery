// This runs only on admin.html — checks access, then loads the product manager.

let allAdminProducts = []; // cached full product list, used for dropdowns and editing
let editingProductId = null; // set when the form is in "edit" mode instead of "add" mode

async function checkAdminAccess() {
  const response = await fetch('/api/admin/check');

  if (response.ok) {
    document.getElementById('admin-content').classList.remove('hidden');
    loadAdminProducts();

    // Only show order management on the main page — a category/subcategory
    // detail view should stay focused on just those products
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

// Loads and displays products — category tiles, or a category's subcategory
// tiles, or a final list of products with edit/delete, depending on the URL
async function loadAdminProducts() {
  const response = await fetch('/api/products');
  const products = await response.json();
  allAdminProducts = products;

  const list = document.getElementById('admin-product-list');
  list.innerHTML = '';

  const urlParams = new URLSearchParams(window.location.search);
  const filterCategory = urlParams.get('category');
  const filterSubcategory = urlParams.get('subcategory');

  if (!filterCategory) {
    // TOP LEVEL: category tiles
    const grouped = {};
    products.forEach(function(product) {
      const cat = product.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(product);
    });

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

  } else {
    // Inside a category
    const backLink = document.createElement('a');
    backLink.href = 'admin.html';
    backLink.textContent = '← All Categories';
    backLink.className = 'back-link';
    list.appendChild(backLink);

    const categoryProducts = products.filter(function(p) { return p.category === filterCategory; });

    // Does this category actually have any subcategories in use?
    const subcatSet = new Set(categoryProducts.filter(function(p) { return p.subcategory; }).map(function(p) { return p.subcategory; }));

    if (!filterSubcategory && subcatSet.size > 0) {
      // SUBCATEGORY TILES for this category
      const heading = document.createElement('h3');
      heading.className = 'admin-category-heading';
      heading.textContent = filterCategory;
      list.appendChild(heading);

      const tileGrid = document.createElement('div');
      tileGrid.className = 'admin-category-tile-grid';

      // Group counts per subcategory (and an "Uncategorized" bucket for items with none)
      const subGrouped = {};
      categoryProducts.forEach(function(p) {
        const key = p.subcategory || 'Uncategorized';
        if (!subGrouped[key]) subGrouped[key] = [];
        subGrouped[key].push(p);
      });

      Object.keys(subGrouped).forEach(function(subName) {
        const tile = document.createElement('a');
        tile.className = 'admin-category-tile';
        tile.href = 'admin.html?category=' + encodeURIComponent(filterCategory) + '&subcategory=' + encodeURIComponent(subName);
        tile.innerHTML =
          '<div class="admin-tile-name">' + subName + '</div>' +
          '<div class="admin-tile-count">' + subGrouped[subName].length + ' product' + (subGrouped[subName].length !== 1 ? 's' : '') + '</div>';
        tileGrid.appendChild(tile);
      });

      list.appendChild(tileGrid);

    } else {
      // PRODUCT LIST — either this category has no subcategories at all,
      // or we're inside a specific subcategory already
      const headingText = filterSubcategory ? (filterCategory + ' → ' + filterSubcategory) : filterCategory;
      const heading = document.createElement('h3');
      heading.className = 'admin-category-heading';
      heading.textContent = headingText;
      list.appendChild(heading);

      if (filterSubcategory) {
        const backToCategoryLink = document.createElement('a');
        backToCategoryLink.href = 'admin.html?category=' + encodeURIComponent(filterCategory);
        backToCategoryLink.textContent = '← ' + filterCategory;
        backToCategoryLink.className = 'back-link';
        list.appendChild(backToCategoryLink);
      }

      let items = categoryProducts;
      if (filterSubcategory) {
        items = categoryProducts.filter(function(p) {
          return (p.subcategory || 'Uncategorized') === filterSubcategory;
        });
      }

      if (items.length === 0) {
        list.innerHTML += '<p>No products here yet.</p>';
      } else {
        items.forEach(function(product) {
          const row = document.createElement('div');
          row.className = 'admin-product-row';
          row.innerHTML =
            '<span class="admin-product-info admin-product-clickable" onclick="startEditProduct(' + product.id + ')">' +
              product.emoji + ' <strong>' + product.name + '</strong>' +
              (product.unit ? ' (' + product.unit + ')' : '') +
              ' — ₹' + product.price.toFixed(2) +
              ' <span class="stock-tag' + (product.stock === 0 ? ' out' : '') + '">' +
                (product.stock === null || product.stock === undefined ? 'Unlimited stock' : 'Stock: ' + product.stock) +
              '</span>' +
              (product.variant_group ? ' <span class="variant-tag">linked: ' + product.variant_group + '</span>' : '') +
            '</span>' +
            '<button onclick="deleteProduct(' + product.id + ')" class="admin-delete-btn">Delete</button>';
          list.appendChild(row);
        });
      }
    }
  }

  populateCategoryDropdown(products);
}

// Fills the category dropdown with each unique category found in the current products
function populateCategoryDropdown(products) {
  const select = document.getElementById('category-select');
  const currentValue = select.value;

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

  select.value = currentValue;
  populateSubcategoryDropdown(); // keep subcategory options in sync with whichever category is selected
}

// NEW: fills the subcategory dropdown based on whichever category is currently selected
function populateSubcategoryDropdown() {
  const categorySelect = document.getElementById('category-select');
  const subSelect = document.getElementById('subcategory-select');
  const currentValue = subSelect.value;
  const selectedCategory = categorySelect.value;

  const subcats = [...new Set(
    allAdminProducts
      .filter(function(p) { return p.category === selectedCategory && p.subcategory; })
      .map(function(p) { return p.subcategory; })
  )];

  subSelect.innerHTML = '<option value="">-- Subcategory (optional) --</option>';
  subcats.forEach(function(sub) {
    const option = document.createElement('option');
    option.value = sub;
    option.textContent = sub;
    subSelect.appendChild(option);
  });

  const newOption = document.createElement('option');
  newOption.value = '__new__';
  newOption.textContent = '+ Add a new subcategory';
  subSelect.appendChild(newOption);

  subSelect.value = currentValue;
}

// Runs when the category dropdown changes — handles both the "new category"
// input AND refreshing the subcategory list to match
function onCategoryChange() {
  toggleNewCategoryInput();
  populateSubcategoryDropdown();
}

function toggleNewCategoryInput() {
  const select = document.getElementById('category-select');
  const newInput = document.getElementById('new-category-input');
  if (select.value === '__new__') {
    newInput.classList.remove('hidden');
  } else {
    newInput.classList.add('hidden');
  }
}

// NEW: shows/hides the "new subcategory name" text box based on dropdown choice
function toggleNewSubcategoryInput() {
  const select = document.getElementById('subcategory-select');
  const newInput = document.getElementById('new-subcategory-input');
  if (select.value === '__new__') {
    newInput.classList.remove('hidden');
  } else {
    newInput.classList.add('hidden');
  }
}

function toggleCustomUnitInput() {
  const select = document.getElementById('new-unit-select');
  const customInput = document.getElementById('new-unit-custom');
  if (select.value === '__custom__') {
    customInput.classList.remove('hidden');
  } else {
    customInput.classList.add('hidden');
  }
}

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

// NEW: populates the form with an existing product's details, switching into "edit" mode
function startEditProduct(productId) {
  const product = allAdminProducts.find(function(p) { return p.id === productId; });
  if (!product) return;

  editingProductId = productId;

  document.getElementById('form-heading').textContent = 'Edit Product';
  document.getElementById('submit-product-btn').textContent = 'Update Product';
  document.getElementById('cancel-edit-link').classList.remove('hidden');

  document.getElementById('new-name').value = product.name;
  document.getElementById('new-price').value = product.price;
  document.getElementById('new-stock').value = (product.stock === null || product.stock === undefined) ? '' : product.stock;
  document.getElementById('new-emoji').value = product.emoji || '';
  document.getElementById('new-variant-group').value = product.variant_group || '';
  document.getElementById('new-image-url').value = product.image_url || '';

  // Unit: check if it matches a preset, otherwise use the custom slot
  const unitSelect = document.getElementById('new-unit-select');
  const presetValues = Array.from(unitSelect.options).map(function(o) { return o.value; });
  if (product.unit && presetValues.includes(product.unit)) {
    unitSelect.value = product.unit;
    document.getElementById('new-unit-custom').classList.add('hidden');
  } else if (product.unit) {
    unitSelect.value = '__custom__';
    document.getElementById('new-unit-custom').value = product.unit;
    document.getElementById('new-unit-custom').classList.remove('hidden');
  } else {
    unitSelect.value = '';
    document.getElementById('new-unit-custom').classList.add('hidden');
  }

  document.getElementById('category-select').value = product.category;
  toggleNewCategoryInput();
  populateSubcategoryDropdown();
  document.getElementById('subcategory-select').value = product.subcategory || '';
  toggleNewSubcategoryInput();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// NEW: exits edit mode and resets the form back to "Add a Product"
function cancelEdit() {
  editingProductId = null;
  document.getElementById('form-heading').textContent = 'Add a Product';
  document.getElementById('submit-product-btn').textContent = 'Add Product';
  document.getElementById('cancel-edit-link').classList.add('hidden');
  resetForm();
}

function resetForm() {
  document.getElementById('new-name').value = '';
  document.getElementById('new-price').value = '';
  document.getElementById('new-stock').value = '';
  document.getElementById('new-emoji').value = '';
  document.getElementById('new-unit-select').value = '';
  document.getElementById('new-unit-custom').value = '';
  document.getElementById('new-unit-custom').classList.add('hidden');
  document.getElementById('new-variant-group').value = '';
  document.getElementById('new-image-url').value = '';
  document.getElementById('new-photo').value = '';
  document.getElementById('photo-preview').classList.add('hidden');
  document.getElementById('new-category-input').value = '';
  document.getElementById('category-select').value = '';
  document.getElementById('subcategory-select').value = '';
  document.getElementById('new-subcategory-input').value = '';
  toggleNewCategoryInput();
  toggleNewSubcategoryInput();
}

// Handles both adding a new product AND saving edits to an existing one
async function addProduct() {
  const name = document.getElementById('new-name').value;
  const price = document.getElementById('new-price').value;
  const stock = document.getElementById('new-stock').value;
  const emoji = document.getElementById('new-emoji').value;
  const unitSelect = document.getElementById('new-unit-select');
  const unit = unitSelect.value === '__custom__'
    ? document.getElementById('new-unit-custom').value
    : unitSelect.value;
  const variantGroup = document.getElementById('new-variant-group').value;
  const imageUrl = document.getElementById('new-image-url').value;
  const photoFile = document.getElementById('new-photo').files[0];
  const messageBox = document.getElementById('admin-message');

  const catSelect = document.getElementById('category-select');
  let category = catSelect.value;
  if (category === '__new__') {
    category = document.getElementById('new-category-input').value;
  }

  const subSelect = document.getElementById('subcategory-select');
  let subcategory = subSelect.value;
  if (subcategory === '__new__') {
    subcategory = document.getElementById('new-subcategory-input').value;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('price', price);
  formData.append('stock', stock);
  formData.append('emoji', emoji);
  formData.append('category', category);
  formData.append('subcategory', subcategory);
  formData.append('imageUrl', imageUrl);
  formData.append('unit', unit);
  formData.append('variantGroup', variantGroup);
  if (photoFile) {
    formData.append('photo', photoFile);
  }

  // NEW: edit mode calls PUT on the specific product, add mode calls POST
  const url = editingProductId ? '/api/admin/products/' + editingProductId : '/api/admin/products';
  const method = editingProductId ? 'PUT' : 'POST';

  const response = await fetch(url, { method: method, body: formData });
  const result = await response.json();

  if (response.ok) {
    messageBox.textContent = editingProductId ? 'Product updated!' : 'Product added!';
    messageBox.style.color = 'green';

    if (editingProductId) {
      cancelEdit(); // exits edit mode and resets the form
    } else {
      resetForm();
    }

    loadAdminProducts(); // refresh the list AND the dropdowns
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

async function updateOrderStatus(orderId, newStatus) {
  await fetch('/api/admin/orders/' + orderId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
}

window.addEventListener('DOMContentLoaded', checkAdminAccess);
