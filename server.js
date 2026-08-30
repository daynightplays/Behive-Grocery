// This file runs using Node.js, NOT in the browser.
// It starts a small server on your own computer.

const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = 3000;
const db = new Database('store.db');

// This lets the server understand JSON data sent from the browser
app.use(express.json());

// NEW: sets up sessions — this lets the server remember who's logged in
// across different requests, using a secure cookie in the browser
app.use(session({
  secret: 'change-this-to-something-random-later',
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
  const { email, password } = req.body;

  // Basic check: make sure both fields were actually sent
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Scramble the password — 10 is the "cost factor," a standard safe default
    const passwordHash = await bcrypt.hash(password, 10);

    const insert = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
    insert.run(email, passwordHash);

    res.json({ success: true, message: 'Account created!' });
  } catch (error) {
    // This specific error code means the email already exists (remember UNIQUE?)
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'An account with that email already exists.' });
    } else {
      res.status(500).json({ error: 'Something went wrong creating the account.' });
    }
  }
});

// NEW: login route — checks email/password and starts a session
app.post('/api/login', async (req, res) => {
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

  res.json({ success: true, message: 'Logged in!', email: user.email });
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
    res.json({ loggedIn: true, email: req.session.userEmail });
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

  const { items, total, deliveryAddress } = req.body;

  if (!deliveryAddress || deliveryAddress.trim() === '') {
    return res.status(400).json({ error: 'Delivery address is required.' });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  const insert = db.prepare(
    'INSERT INTO orders (user_id, items_json, total, delivery_address) VALUES (?, ?, ?, ?)'
  );

  // JSON.stringify turns the items array into a text string so it can be
  // stored in a single database column (SQLite doesn't store arrays directly)
  const result = insert.run(req.session.userId, JSON.stringify(items), total, deliveryAddress);

  res.json({ success: true, orderId: result.lastInsertRowid });
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
app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, price, emoji } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: 'Name and price are required.' });
  }

  const insert = db.prepare('INSERT INTO products (name, price, emoji) VALUES (?, ?, ?)');
  const result = insert.run(name, parseFloat(price), emoji || '🛒');

  res.json({ success: true, productId: result.lastInsertRowid });
});

// NEW: deletes a product — admin only
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// This actually starts the server, listening on port 3000
app.listen(PORT, () => {
  console.log('Server is running at http://localhost:' + PORT);
});
