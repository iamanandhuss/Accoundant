const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SQLite DB connection
const db = new sqlite3.Database(path.join(__dirname, 'db', 'finance.db'), (err) => {
    if (err) {
        console.error('Failed to connect to DB', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Initialize tables if they don't exist
const initSql = `
CREATE TABLE IF NOT EXISTS income (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  source TEXT,
  date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  category TEXT,
  date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  creditor TEXT,
  due_date TEXT NOT NULL
);
`;

db.exec(initSql, (err) => {
    if (err) console.error('Error creating tables', err);
});

// Helper to validate type
const validTypes = ['income', 'expenses', 'debts'];

// CRUD routes
app.get('/api/:type', (req, res) => {
    const { type } = req.params;
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    db.all(`SELECT * FROM ${type}`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/:type', (req, res) => {
    const { type } = req.params;
    const data = req.body;
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    let columns = Object.keys(data).join(', ');
    let placeholders = Object.keys(data).map(() => '?').join(', ');
    let values = Object.values(data);
    db.run(`INSERT INTO ${type} (${columns}) VALUES (${placeholders})`, values, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

app.put('/api/:type/:id', (req, res) => {
    const { type, id } = req.params;
    const data = req.body;
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    const assignments = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    db.run(`UPDATE ${type} SET ${assignments} WHERE id = ?`, values, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

app.delete('/api/:type/:id', (req, res) => {
    const { type, id } = req.params;
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    db.run(`DELETE FROM ${type} WHERE id = ?`, [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ changes: this.changes });
    });
});

// Summary endpoint
app.get('/api/summary', (req, res) => {
    const queries = {
        income: 'SELECT SUM(amount) as total FROM income',
        expenses: 'SELECT SUM(amount) as total FROM expenses',
        debts: 'SELECT SUM(amount) as total FROM debts'
    };
    const result = {};
    let completed = 0;
    for (const [key, sql] of Object.entries(queries)) {
        db.get(sql, [], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            result[key] = row.total || 0;
            completed++;
            if (completed === Object.keys(queries).length) {
                result.net = (result.income || 0) - (result.expenses || 0) - (result.debts || 0);
                res.json(result);
            }
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
