// This file runs using Node.js, NOT in the browser.
// It starts a small server on your own computer.

const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 3000;
const db = new Database('store.db');

// NEW: sets up where uploaded product photos get saved, and gives each one
// a unique filename so two different uploads never overwrite each other
const uploadStorage = multer.diskStorage({
  destination: 'uploads/',
  filename: function(req, file, cb) {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max per photo — keeps things reasonable
  fileFilter: function(req, file, cb) {
    // Only allow actual image files, not random file types
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  }
});

// NEW: limits login attempts — max 10 tries per 15 minutes, per visitor.
// This makes it impractical for someone to "guess" a password by brute force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes, in milliseconds
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

// This lets the server understand JSON data sent from the browser
app.use(express.json());

// NEW: sets up sessions — this lets the server remember who's logged in
// across different requests, using a secure cookie in the browser
// The session secret is read from an environment variable (SESSION_SECRET)
// instead of being written directly in the code — this keeps it out of GitHub.
// If it's not set (like on your own computer during testing), it falls back
// to a placeholder — fine for local testing, but the real one must be set on Render.
app.use(session({
  secret: process.env.SESSION_SECRET || 'local-dev-only-not-for-production',
  resave: false,
  saveUninitialized: false
}));

// This tells the server: "serve any file in this folder directly"
app.use(express.static(__dirname));

// This is a new kind of route — instead of a webpage, it sends back
// raw data (in a format called JSON) that JavaScript can easily read.
// Visiting/fetching /api/products will run this and return the product list.
app.get('/api/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products').all();
  res.json(products);
});

// NEW: signup route — creates a new account
app.post('/api/signup', async (req, res) => {
  const { name, phone, email, password } = req.body;

  // Basic check: make sure all fields were actually sent
  if (!name || !phone || !email || !password) {
    return res.status(400).json({ error: 'Name, phone, email, and password are all required.' });
  }

  if (name.trim().length === 0 || name.length > 100) {
    return res.status(400).json({ error: 'Please enter a valid name.' });
  }

  // NEW: a simple check for a 10-digit Indian phone number (with optional +91)
  const phonePattern = /^(\+91)?[6-9]\d{9}$/;
  if (!phonePattern.test(phone.replace(/\s/g, ''))) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit phone number.' });
  }

  // NEW: a simple pattern check — makes sure the email at least LOOKS like
  // one (something@something.something). This isn't perfect, but catches typos.
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  // NEW: require a reasonable minimum password length
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    // Scramble the password — 10 is the "cost factor," a standard safe default
    const passwordHash = await bcrypt.hash(password, 10);

    const insert = db.prepare('INSERT INTO users (name, phone, email, password_hash) VALUES (?, ?, ?, ?)');
    insert.run(name.trim(), phone.trim(), email, passwordHash);

    res.json({ success: true, message: 'Account created!' });
  } catch (error) {
    // This specific error code means the email already exists (remember UNIQUE?)
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'An account with that email already exists.' });
    } else {
      console.error('Signup error:', error.message); // NEW: so we can actually see what broke
      res.status(500).json({ error: 'Something went wrong creating the account.' });
    }
  }
});

// NEW: login route — checks email/password and starts a session
// loginLimiter runs first, blocking excessive repeated attempts
app.post('/api/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    return res.status(400).json({ error: 'No account found with that email.' });
  }

  // bcrypt.compare checks the typed password against the scrambled one —
  // it never un-scrambles anything, just checks if they'd match
  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    return res.status(400).json({ error: 'Incorrect password.' });
  }

  // Save the user's info into their session — this is what "remembers" them
  req.session.userId = user.id;
  req.session.userEmail = user.email;
  req.session.userName = user.name;

  res.json({ success: true, message: 'Logged in!', email: user.email, name: user.name });
});

// NEW: logout route — clears the session
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// NEW: lets the page check "am I currently logged in?" when it loads
app.get('/api/me', (req, res) => {
  if (req.session.userId) {
    res.json({ loggedIn: true, email: req.session.userEmail, name: req.session.userName });
  } else {
    res.json({ loggedIn: false });
  }
});

// NEW: places an order — only works if the user is logged in
app.post('/api/orders', (req, res) => {
  // Check login first — this is important: no placing orders as "nobody"
  if (!req.session.userId) {
    return res.status(401).json({ error: 'You must be logged in to place an order.' });
  }

  const { items, deliveryAddress } = req.body;

  if (!deliveryAddress || deliveryAddress.trim() === '') {
    return res.status(400).json({ error: 'Delivery address is required.' });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  // NEW: the server calculates the subtotal and delivery fee itself,
  // rather than trusting whatever total the browser sends — this way
  // nobody can tamper with the order total by editing the request.
  const FREE_DELIVERY_THRESHOLD = 149;
  const DELIVERY_FEE = 20;

  let subtotal = 0;
  items.forEach(function(item) {
    subtotal += item.price * item.qty;
  });

  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const finalTotal = subtotal + deliveryFee;

  // NEW: check real stock (from the database, not the browser) before allowing
  // the order — this is the actual source of truth, and stops overselling
  // even if two people try to buy the last item at the same time.
  const insertOrder = db.prepare(
    'INSERT INTO orders (user_id, items_json, total, delivery_fee, delivery_address) VALUES (?, ?, ?, ?, ?)'
  );
  const getStock = db.prepare('SELECT stock, name FROM products WHERE id = ?');
  const decrementStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

  // db.transaction bundles all these steps together — if ANY of them fails
  // (like insufficient stock), everything rolls back as if nothing happened,
  // instead of leaving stock partially reduced.
  const placeOrderTransaction = db.transaction(function() {
    for (const item of items) {
      const product = getStock.get(item.id);
      if (product && product.stock !== null && product.stock < item.qty) {
        // Throwing inside a transaction cancels the whole thing automatically
        throw new Error('OUT_OF_STOCK:' + product.name + ':' + product.stock);
      }
    }

    for (const item of items) {
      const product = getStock.get(item.id);
      if (product && product.stock !== null) {
        decrementStock.run(item.qty, item.id);
      }
    }

    return insertOrder.run(req.session.userId, JSON.stringify(items), finalTotal, deliveryFee, deliveryAddress);
  });

  let result;
  try {
    result = placeOrderTransaction();
  } catch (error) {
    if (error.message.startsWith('OUT_OF_STOCK:')) {
      const parts = error.message.split(':');
      const availableQty = parts[2];
      return res.status(400).json({
        error: 'Sorry, "' + parts[1] + '" only has ' + availableQty + ' left in stock. Please adjust your cart.'
      });
    }
    console.error('Order placement error:', error.message);
    return res.status(500).json({ error: 'Something went wrong placing your order.' });
  }

  res.json({ success: true, orderId: result.lastInsertRowid, deliveryFee: deliveryFee, total: finalTotal });
});

// NEW: fetches the logged-in user's own past orders — never anyone else's
app.get('/api/orders', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'You must be logged in to view orders.' });
  }

  const orders = db.prepare(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.session.userId);

  res.json(orders);
});

// NEW: a small reusable check — blocks the request unless the logged-in
// user is an admin. Used before any admin-only route.
function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'You must be logged in.' });
  }

  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.session.userId);

  if (!user || user.is_admin !== 1) {
    return res.status(403).json({ error: 'Admin access only.' });
  }

  next(); // means "okay, continue to the actual route"
}

// NEW: lets the admin page check "am I actually an admin?" before showing itself
app.get('/api/admin/check', requireAdmin, (req, res) => {
  res.json({ isAdmin: true });
});

// NEW: adds a new product — admin only
// NEW: upload.single('photo') is Multer middleware — it processes the incoming
// file (if any), saves it to the uploads/ folder, and makes it available as req.file
app.post('/api/admin/products', requireAdmin, upload.single('photo'), (req, res) => {
  const { name, price, emoji, category, subcategory, unit, variantGroup, stock } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: 'Name and price are required.' });
  }

  // NEW: make sure price is actually a valid positive number
  const parsedPrice = parseFloat(price);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'Price must be a positive number.' });
  }

  // NEW: a reasonable cap on name length, so nothing absurd gets stored
  if (name.trim().length === 0 || name.length > 100) {
    return res.status(400).json({ error: 'Product name must be between 1 and 100 characters.' });
  }

  // NEW: stock is optional — an empty value means "unlimited," not zero
  let parsedStock = null;
  if (stock !== undefined && stock !== null && stock.toString().trim() !== '') {
    parsedStock = parseInt(stock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      return res.status(400).json({ error: 'Stock must be a non-negative whole number.' });
    }
  }

  // If a photo was uploaded, its saved path becomes the image URL.
  // Otherwise, fall back to a pasted URL if one was given, or nothing.
  const imageUrl = req.file ? '/uploads/' + req.file.filename : (req.body.imageUrl || null);

  const insert = db.prepare('INSERT INTO products (name, price, emoji, category, subcategory, image_url, unit, variant_group, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const result = insert.run(
    name.trim(),
    parsedPrice,
    emoji || '🛒',
    category || 'Other',
    subcategory && subcategory.trim() ? subcategory.trim() : null,
    imageUrl,
    unit ? unit.trim() : null,
    variantGroup && variantGroup.trim() ? variantGroup.trim() : null,
    parsedStock
  );

  res.json({ success: true, productId: result.lastInsertRowid });
});

// NEW: edits an existing product — admin only
app.put('/api/admin/products/:id', requireAdmin, upload.single('photo'), (req, res) => {
  const { name, price, emoji, category, subcategory, unit, variantGroup, imageUrl, stock } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: 'Name and price are required.' });
  }

  const parsedPrice = parseFloat(price);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'Price must be a positive number.' });
  }

  if (name.trim().length === 0 || name.length > 100) {
    return res.status(400).json({ error: 'Product name must be between 1 and 100 characters.' });
  }

  // NEW: stock is optional — an empty value means "unlimited," not zero
  let parsedStock = null;
  if (stock !== undefined && stock !== null && stock.toString().trim() !== '') {
    parsedStock = parseInt(stock, 10);
    if (isNaN(parsedStock) || parsedStock < 0) {
      return res.status(400).json({ error: 'Stock must be a non-negative whole number.' });
    }
  }

  // If a new photo was uploaded, use it. Otherwise keep whatever was already
  // there, unless a pasted URL was given instead.
  const existing = db.prepare('SELECT image_url FROM products WHERE id = ?').get(req.params.id);
  let finalImageUrl = existing ? existing.image_url : null;
  if (req.file) {
    finalImageUrl = '/uploads/' + req.file.filename;
  } else if (imageUrl) {
    finalImageUrl = imageUrl;
  }

  db.prepare(
    'UPDATE products SET name = ?, price = ?, emoji = ?, category = ?, subcategory = ?, image_url = ?, unit = ?, variant_group = ?, stock = ? WHERE id = ?'
  ).run(
    name.trim(),
    parsedPrice,
    emoji || '🛒',
    category || 'Other',
    subcategory && subcategory.trim() ? subcategory.trim() : null,
    finalImageUrl,
    unit ? unit.trim() : null,
    variantGroup && variantGroup.trim() ? variantGroup.trim() : null,
    parsedStock,
    req.params.id
  );

  res.json({ success: true });
});

// NEW: deletes a product — admin only
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// NEW: lets an admin see ALL orders from ALL customers (not just their own)
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const orders = db.prepare(`
    SELECT orders.*, users.name AS customer_name, users.email AS customer_email, users.phone AS customer_phone
    FROM orders
    JOIN users ON orders.user_id = users.id
    ORDER BY orders.created_at DESC
  `).all();

  res.json(orders);
});

// NEW: lets an admin update an order's status
app.put('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['Placed', 'Packed', 'Out for Delivery', 'Delivered', 'Cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// This actually starts the server, listening on port 3000
app.listen(PORT, () => {
  console.log('Server is running at http://localhost:' + PORT);
});
