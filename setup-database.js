// This script sets up your database. You only need to run it once
// (or again later if you want to reset your product list).

const Database = require('better-sqlite3');

// This creates (or opens, if it already exists) a file called store.db
// That single file IS your database — everything gets stored inside it.
const db = new Database('store.db');

// Create a "table" — think of it like a spreadsheet with named columns —
// but only if one doesn't already exist, so running this twice is safe.
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    emoji TEXT
  )
`);

// Check if the table is empty before adding products,
// so we don't add duplicates every time this script runs.
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
console.log('Database setup complete. A file called store.db now exists in this folder.');
