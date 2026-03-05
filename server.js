const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MySQL/TiDB connection pool (use DATABASE_URL env var)
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL ||
    'mysql://user:pass@localhost:3306/test',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  ssl: {}
});

// Initialize tables if they don't exist
const initQueries = [
  `CREATE TABLE IF NOT EXISTS income (
  id INT AUTO_INCREMENT PRIMARY KEY,
  amount DOUBLE NOT NULL,
  source TEXT,
  date DATE NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  amount DOUBLE NOT NULL,
  category TEXT,
  date DATE NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS debts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  amount DOUBLE NOT NULL,
  creditor TEXT,
  due_date DATE NOT NULL
)`
];

async function initDb() {
  try {
    const conn = await pool.getConnection();
    console.log('Got connection, creating tables...');
    for (const query of initQueries) {
      await conn.query(query);
    }
    conn.release();
    console.log('Ensured tables exist');
  } catch (err) {
    console.error('Error initializing database', err.message);
  }
}

// Initialize DB but don't wait for it
initDb();

// Helper to validate type
const validTypes = ['income', 'expenses', 'debts'];

// CRUD routes
app.get('/api/:type', async (req, res) => {
  const { type } = req.params;
  if (!validTypes.includes(type))
    return res.status(400).json({ error: 'Invalid type' });
  try {
    const [rows] = await pool.query(`SELECT * FROM \`${type}\``);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/:type', async (req, res) => {
  const { type } = req.params;
  const data = req.body;
  if (!validTypes.includes(type))
    return res.status(400).json({ error: 'Invalid type' });
  const columns = Object.keys(data).join(', ');
  const placeholders = Object.keys(data).map(() => '?').join(', ');
  const values = Object.values(data);
  try {
    const [result] = await pool.query(
      `INSERT INTO \`${type}\` (${columns}) VALUES (${placeholders})`,
      values
    );
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const data = req.body;
  if (!validTypes.includes(type))
    return res.status(400).json({ error: 'Invalid type' });
  const assignments = Object.keys(data)
    .map((k) => `\`${k}\` = ?`)
    .join(', ');
  const values = [...Object.values(data), id];
  try {
    const [result] = await pool.query(
      `UPDATE \`${type}\` SET ${assignments} WHERE id = ?`,
      values
    );
    res.json({ changes: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  if (!validTypes.includes(type))
    return res.status(400).json({ error: 'Invalid type' });
  try {
    const [result] = await pool.query(
      `DELETE FROM \`${type}\` WHERE id = ?`,
      [id]
    );
    res.json({ changes: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Summary endpoint
app.get('/api/summary', async (req, res) => {
  try {
    const [[{ total: income }]] = await pool.query(
      'SELECT SUM(amount) as total FROM income'
    );
    const [[{ total: expenses }]] = await pool.query(
      'SELECT SUM(amount) as total FROM expenses'
    );
    const [[{ total: debts }]] = await pool.query(
      'SELECT SUM(amount) as total FROM debts'
    );
    const result = {
      income: income || 0,
      expenses: expenses || 0,
      debts: debts || 0,
    };
    result.net = result.income - result.expenses - result.debts;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
