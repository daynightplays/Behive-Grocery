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
    emoji TEXT,
    category TEXT DEFAULT 'Other',
    image_url TEXT
  )
`);

// Same safe-migration pattern as category and is_admin before it
const imageColumns = db.prepare("PRAGMA table_info(products)").all();
const hasImageUrl = imageColumns.some(function(col) { return col.name === 'image_url'; });
if (!hasImageUrl) {
  db.exec('ALTER TABLE products ADD COLUMN image_url TEXT');
  console.log('Added image_url column to existing products table.');
}

// NEW: users table — stores accounts
// password_hash holds a scrambled version of the password, NEVER the real one
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Safe migration for databases that already existed before name/phone were added
const userTableColumns = db.prepare("PRAGMA table_info(users)").all();
const hasName = userTableColumns.some(function(col) { return col.name === 'name'; });
if (!hasName) {
  db.exec('ALTER TABLE users ADD COLUMN name TEXT');
  console.log('Added name column to existing users table.');
}
const hasPhone = userTableColumns.some(function(col) { return col.name === 'phone'; });
if (!hasPhone) {
  db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
  console.log('Added phone column to existing users table.');
}

// Since your database already existed before is_admin was added,
// this safely adds the column if it's missing — and does nothing if it's already there.
const userColumns = db.prepare("PRAGMA table_info(users)").all();
const hasIsAdmin = userColumns.some(function(col) { return col.name === 'is_admin'; });
if (!hasIsAdmin) {
  db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
  console.log('Added is_admin column to existing users table.');
}

// NEW: orders table — one row per order placed
// items_json stores the cart contents as text (a simple approach for a first version)
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    items_json TEXT NOT NULL,
    total REAL NOT NULL,
    delivery_fee REAL DEFAULT 0,
    delivery_address TEXT NOT NULL,
    status TEXT DEFAULT 'Placed',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// Same safe-migration pattern used for other columns added after the table already existed
const orderColumns = db.prepare("PRAGMA table_info(orders)").all();
const hasDeliveryFee = orderColumns.some(function(col) { return col.name === 'delivery_fee'; });
if (!hasDeliveryFee) {
  db.exec('ALTER TABLE orders ADD COLUMN delivery_fee REAL DEFAULT 0');
  console.log('Added delivery_fee column to existing orders table.');
}

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
