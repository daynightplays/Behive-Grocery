// Run this once to make an existing account an admin.
// Change the email below to the account you want to be the admin.

const Database = require('better-sqlite3');
const db = new Database('store.db');

// ↓↓↓ CHANGE THIS TO YOUR ACCOUNT'S EMAIL ↓↓↓
const email = 'testemail@123';
// ↑↑↑ CHANGE THIS TO YOUR ACCOUNT'S EMAIL ↑↑↑

const result = db.prepare('UPDATE users SET is_admin = 1 WHERE email = ?').run(email);

if (result.changes > 0) {
  console.log(email + ' is now an admin.');
} else {
  console.log('No account found with that email — check the spelling, or sign up first.');
}

db.close();
