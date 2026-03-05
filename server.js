const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
  `CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
  `CREATE TABLE IF NOT EXISTS income (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DOUBLE NOT NULL,
  source TEXT,
  date DATE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`,
  `CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DOUBLE NOT NULL,
  category TEXT,
  date DATE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`,
  `CREATE TABLE IF NOT EXISTS debts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DOUBLE NOT NULL,
  creditor TEXT,
  due_date DATE NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Helper to validate type
const validTypes = ['income', 'expenses', 'debts'];

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const conn = await pool.getConnection();
    
    await conn.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    
    conn.release();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Username or email already exists' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  try {
    const conn = await pool.getConnection();
    const [[user]] = await conn.query(
      'SELECT id, username, password FROM users WHERE username = ?',
      [username]
    );
    conn.release();
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: '7d'
    });
    
    res.json({ token, message: 'Login successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CRUD routes
app.get('/api/:type', authenticateToken, async (req, res) => {
  const { type } = req.params;
  const userId = req.user.id;
  
  if (!validTypes.includes(type))
    return res.status(400).json({ error: 'Invalid type' });
  try {
    const [rows] = await pool.query(
      `SELECT * FROM \`${type}\` WHERE user_id = ?`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/:type', authenticateToken, async (req, res) => {
  const { type } = req.params;
  const userId = req.user.id;
  const data = req.body;
  
  if (!validTypes.includes(type))
    return res.status(400).json({ error: 'Invalid type' });
  
  const columns = ['user_id', ...Object.keys(data)].join(', ');
  const placeholders = Array(Object.keys(data).length + 1)
    .fill('?')
    .join(', ');
  const values = [userId, ...Object.values(data)];
  
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

app.put('/api/:type/:id', authenticateToken, async (req, res) => {
  const { type, id } = req.params;
  const userId = req.user.id;
  const data = req.body;
  
  if (!validTypes.includes(type))
    return res.status(400).json({ error: 'Invalid type' });
  
  const assignments = Object.keys(data)
    .map((k) => `\`${k}\` = ?`)
    .join(', ');
  const values = [...Object.values(data), id, userId];
  
  try {
    const [result] = await pool.query(
      `UPDATE \`${type}\` SET ${assignments} WHERE id = ? AND user_id = ?`,
      values
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Record not found or unauthorized' });
    }
    
    res.json({ changes: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/:type/:id', authenticateToken, async (req, res) => {
  const { type, id } = req.params;
  const userId = req.user.id;
  
  if (!validTypes.includes(type))
    return res.status(400).json({ error: 'Invalid type' });
  
  try {
    const [result] = await pool.query(
      `DELETE FROM \`${type}\` WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Record not found or unauthorized' });
    }
    
    res.json({ changes: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Summary endpoint
app.get('/api/summary', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  
  try {
    const queries = [
      'SELECT SUM(amount) as total FROM income WHERE user_id = ?',
      'SELECT SUM(amount) as total FROM expenses WHERE user_id = ?',
      'SELECT SUM(amount) as total FROM debts WHERE user_id = ?'
    ];
    
    const results = await Promise.all(
      queries.map(q => pool.query(q, [userId]))
    );
    
    const income = results[0][0][0].total || 0;
    const expenses = results[1][0][0].total || 0;
    const debts = results[2][0][0].total || 0;
    
    const result = {
      income,
      expenses,
      debts,
      net: income - expenses - debts
    };
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
