// This file runs using Node.js, NOT in the browser.
// It starts a small server on your own computer.

const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const PORT = 3000;
const db = new Database('store.db');

// This tells the server: "serve any file in this folder directly"
app.use(express.static(__dirname));

// This is a new kind of route — instead of a webpage, it sends back
// raw data (in a format called JSON) that JavaScript can easily read.
// Visiting/fetching /api/products will run this and return the product list.
app.get('/api/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products').all();
  res.json(products);
});

// This actually starts the server, listening on port 3000
app.listen(PORT, () => {
  console.log('Server is running at http://localhost:' + PORT);
});
