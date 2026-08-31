// This creates one starter product in each category so the categories
// exist and show up in the admin dropdown right away.
// You can safely delete/replace these placeholder products later via the admin panel.

const Database = require('better-sqlite3');
const db = new Database('store.db');

const insert = db.prepare('INSERT INTO products (name, price, emoji, category) VALUES (?, ?, ?, ?)');

const starterProducts = [
  { name: 'Lays Chips', price: 20, emoji: '🥔', category: 'Chips & Namkeen' },
  { name: 'Amul Ice Cream', price: 50, emoji: '🍦', category: 'Ice Cream & Cold Drinks' },
  { name: 'Colgate Toothpaste', price: 45, emoji: '🪥', category: 'Personal Care' },
  { name: 'Sunflower Oil (1L)', price: 150, emoji: '🛢️', category: 'Cooking Essentials' },
  { name: 'Cigarette Pack', price: 200, emoji: '🚬', category: 'Cigarettes' },
  { name: 'Maggi Noodles', price: 15, emoji: '🍜', category: 'Quick Bites' }
];

starterProducts.forEach(function(product) {
  insert.run(product.name, product.price, product.emoji, product.category);
  console.log('Added: ' + product.name + ' (' + product.category + ')');
});

db.close();
console.log('All 6 categories now exist with a starter product each.');
