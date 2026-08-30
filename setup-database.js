// This script sets up your database. You only need to run it once
// (or again later if you want to reset your product list).

const Database = require('better-sqlite3');
const db = new Database('store.db');

// Products table (unchanged from before)
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    emoji TEXT
  )
`);

// NEW: users table — stores accounts
// password_hash holds a scrambled version of the password, NEVER the real one
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// NEW: orders table — one row per order placed
// items_json stores the cart contents as text (a simple approach for a first version)
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    items_json TEXT NOT NULL,
    total REAL NOT NULL,
    delivery_address TEXT NOT NULL,
    status TEXT DEFAULT 'Placed',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

const existingCount = db.prepare('SELECT COUNT(*) AS count FROM products').get();

if (existingCount.count === 0) {
  const insert = db.prepare('INSERT INTO products (name, price, emoji) VALUES (?, ?, ?)');
  insert.run('Apples (1 lb)', 2.99, '🍎');
  insert.run('Milk (1 gal)', 3.49, '🥛');
  insert.run('Bread', 2.50, '🍞');
  console.log('Added 3 starting products to the database.');
} else {
  console.log('Products already exist in the database — skipped adding duplicates.');
}

db.close();
console.log('Database setup complete. Users, products, and orders tables all ready.');
