/**
 * JWT USER DATA SEPARATION GUIDE
 * Personal Finance Tracker - Complete Implementation
 * 
 * This guide demonstrates proper JWT implementation for user data isolation
 */

// ============================================
// 1. SETUP AND CONFIGURATION
// ============================================

/**
 * Installation:
 * npm install express jsonwebtoken bcryptjs mysql2/promise dotenv
 * 
 * .env file should contain:
 * JWT_SECRET=your-super-secret-key-change-this-in-production
 * DATABASE_URL=mysql://user:pass@host:port/database
 * PORT=3000
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be defined in .env file');
}

// ============================================
// 2. DATABASE SCHEMA
// ============================================

/**
 * Users table structure:
 * 
 * CREATE TABLE users (
 *   id INT AUTO_INCREMENT PRIMARY KEY,
 *   username VARCHAR(255) NOT NULL UNIQUE,
 *   email VARCHAR(255) NOT NULL UNIQUE,
 *   password VARCHAR(255) NOT NULL (hashed with bcrypt),
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * );
 * 
 * Transactions table example (income, expenses, debts):
 * 
 * CREATE TABLE income (
 *   id INT AUTO_INCREMENT PRIMARY KEY,
 *   user_id INT NOT NULL,
 *   amount DOUBLE NOT NULL,
 *   source TEXT,
 *   date DATE NOT NULL,
 *   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
 * );
 */

// ============================================
// 3. AUTHENTICATION MIDDLEWARE
// ============================================

/**
 * JWT Verification Middleware
 * 
 * This middleware:
 * 1. Extracts token from Authorization header
 * 2. Verifies the token signature
 * 3. Attaches decoded user data to req.user
 * 4. Passes control to next middleware/route if valid
 * 5. Returns 401/403 if token is missing or invalid
 */
const authenticateToken = (req, res, next) => {
  // Extract token from "Authorization: Bearer <token>" header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Get part after "Bearer "
  
  // Return 401 if no token provided
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  // Verify token signature and expiration
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // Token is invalid, expired, or has wrong signature
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Token is valid - attach user data to request
    // This user object contains { id, username } from the login token
    req.user = user;
    next();
  });
};

// ============================================
// 4. LOGIN/AUTHENTICATION ROUTES
// ============================================

/**
 * Registration Route
 * POST /auth/register
 * 
 * Request body:
 * {
 *   "username": "john_doe",
 *   "email": "john@example.com",
 *   "password": "securePassword123"
 * }
 */
app.post('/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  // Validation
  if (!username || !email || !password) {
    return res.status(400).json({ 
      error: 'Username, email, and password are required' 
    });
  }
  
  try {
    // Hash password before storing (never store plain passwords!)
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Get database connection
    const conn = await pool.getConnection();
    
    // Insert user into database
    await conn.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    
    conn.release();
    
    res.status(201).json({ 
      message: 'User registered successfully' 
    });
  } catch (err) {
    // Handle duplicate username/email
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        error: 'Username or email already exists' 
      });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * Login Route
 * POST /auth/login
 * 
 * Request body:
 * {
 *   "username": "john_doe",
 *   "password": "securePassword123"
 * }
 * 
 * Response:
 * {
 *   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "message": "Login successful"
 * }
 */
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ 
      error: 'Username and password are required' 
    });
  }
  
  try {
    const conn = await pool.getConnection();
    
    // Find user by username
    const [[user]] = await conn.query(
      'SELECT id, username, password FROM users WHERE username = ?',
      [username]
    );
    
    conn.release();
    
    // User not found
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid username or password' 
      });
    }
    
    // Compare provided password with hashed password in database
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ 
        error: 'Invalid username or password' 
      });
    }
    
    // Create JWT token
    // Token contains: user id and username
    // Token expires in 7 days
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token: token, 
      message: 'Login successful' 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 5. PROTECTED ROUTES - DATA SEPARATION
// ============================================

/**
 * Get User's Transactions
 * GET /api/income
 * 
 * Headers required:
 * Authorization: Bearer <token>
 * 
 * This route uses authenticateToken middleware to:
 * 1. Verify JWT token
 * 2. Extract user ID from token
 * 3. Return ONLY transactions for that user
 * 
 * Key: WHERE user_id = ? ensures data separation
 */
app.get('/api/income', authenticateToken, async (req, res) => {
  try {
    // Get user ID from JWT token (attached by middleware)
    const userId = req.user.id;
    
    const conn = await pool.getConnection();
    
    // Query only transactions for THIS user
    const [rows] = await conn.query(
      'SELECT * FROM income WHERE user_id = ?',
      [userId]
    );
    
    conn.release();
    
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Create Transaction
 * POST /api/income
 * 
 * Headers required:
 * Authorization: Bearer <token>
 * Content-Type: application/json
 * 
 * Request body:
 * {
 *   "amount": 5000,
 *   "source": "Salary",
 *   "date": "2024-03-05"
 * }
 * 
 * Data Separation: user_id is automatically added from token
 * User cannot add transactions for other users
 */
app.post('/api/income', authenticateToken, async (req, res) => {
  try {
    // Extract user ID from JWT (req.user set by middleware)
    const userId = req.user.id;
    const { amount, source, date } = req.body;
    
    if (!amount || !source || !date) {
      return res.status(400).json({ 
        error: 'Amount, source, and date are required' 
      });
    }
    
    const conn = await pool.getConnection();
    
    // Insert transaction - ALWAYS include user_id
    const [result] = await conn.query(
      'INSERT INTO income (user_id, amount, source, date) VALUES (?, ?, ?, ?)',
      [userId, amount, source, date]
    );
    
    conn.release();
    
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update Transaction
 * PUT /api/income/:id
 * 
 * Headers required:
 * Authorization: Bearer <token>
 * 
 * Request body:
 * {
 *   "amount": 5500,
 *   "source": "Bonus"
 * }
 * 
 * Data Separation: Transaction is updated ONLY if both:
 * 1. id matches the transaction
 * 2. user_id matches the logged-in user
 * 
 * This prevents users from updating other users' transactions
 */
app.put('/api/income/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const transactionId = req.params.id;
    const { amount, source, date } = req.body;
    
    const conn = await pool.getConnection();
    
    // Update ONLY if both id and user_id match
    const [result] = await conn.query(
      'UPDATE income SET amount = ?, source = ?, date = ? WHERE id = ? AND user_id = ?',
      [amount, source, date, transactionId, userId]
    );
    
    conn.release();
    
    // If no rows affected, transaction doesn't exist OR belongs to different user
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Transaction not found or unauthorized' 
      });
    }
    
    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Delete Transaction
 * DELETE /api/income/:id
 * 
 * Headers required:
 * Authorization: Bearer <token>
 * 
 * Data Separation: Transaction is deleted ONLY if both:
 * 1. id matches the transaction
 * 2. user_id matches the logged-in user
 */
app.delete('/api/income/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const transactionId = req.params.id;
    
    const conn = await pool.getConnection();
    
    // Delete ONLY if both id and user_id match
    const [result] = await conn.query(
      'DELETE FROM income WHERE id = ? AND user_id = ?',
      [transactionId, userId]
    );
    
    conn.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        error: 'Transaction not found or unauthorized' 
      });
    }
    
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 6. USER PROFILE ROUTE (Example)
// ============================================

/**
 * Get User Profile
 * GET /api/profile
 * 
 * Headers required:
 * Authorization: Bearer <token>
 * 
 * Returns only the profile of the logged-in user
 */
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const conn = await pool.getConnection();
    
    // Get only the current user's profile
    const [[user]] = await conn.query(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [userId]
    );
    
    conn.release();
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 7. KEY SECURITY PRINCIPLES
// ============================================

/**
 * 1. PASSWORD HASHING
 *    - Use bcryptjs.hash() to hash passwords before storing
 *    - Use bcryptjs.compare() to verify passwords
 *    - NEVER store plain text passwords
 * 
 * 2. JWT TOKEN VERIFICATION
 *    - Tokens must be verified with jwt.verify()
 *    - Use same JWT_SECRET for signing and verifying
 *    - Store JWT_SECRET in environment variables (.env)
 *    - Never expose JWT_SECRET in code or logs
 * 
 * 3. USER DATA ISOLATION
 *    - ALWAYS include WHERE user_id = ? in queries
 *    - User can only access their own data
 *    - User cannot modify WHERE clause to access others' data
 *    - Use database foreign keys for referential integrity
 * 
 * 4. TOKEN HANDLING (CLIENT SIDE)
 *    - Store token in localStorage (or secure httpOnly cookie)
 *    - Send token in Authorization: Bearer <token> header
 *    - Include token in all API requests
 *    - Remove token on logout
 * 
 * 5. TOKEN EXPIRATION
 *    - Set reasonable expiration time (7 days, 24 hours, etc.)
 *    - Require re-login after expiration
 *    - Implement token refresh mechanism for long sessions
 * 
 * 6. HTTPS
 *    - Always use HTTPS in production
 *    - Never send tokens over HTTP
 *    - Set secure flag on cookies if using httpOnly
 */

// ============================================
// 8. FRONTEND IMPLEMENTATION
// ============================================

/**
 * Login (JavaScript):
 * 
 * const response = await fetch('/auth/login', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ username: 'john_doe', password: 'pass123' })
 * });
 * const data = await response.json();
 * localStorage.setItem('token', data.token);
 * 
 * 
 * Making Protected Requests (JavaScript):
 * 
 * const token = localStorage.getItem('token');
 * const response = await fetch('/api/income', {
 *   headers: {
 *     'Authorization': `Bearer ${token}`,
 *     'Content-Type': 'application/json'
 *   }
 * });
 * 
 * 
 * Logout (JavaScript):
 * 
 * localStorage.removeItem('token');
 * window.location.href = '/login';
 */

// ============================================
// 9. COMMON ISSUES AND SOLUTIONS
// ============================================

/**
 * ISSUE: "Access token required" error
 * SOLUTION: Check that Authorization header is being sent with Bearer token
 * 
 * ISSUE: "Invalid or expired token" error
 * SOLUTION: Token may have expired, user needs to login again
 * 
 * ISSUE: User can see other users' data
 * SOLUTION: Ensure WHERE user_id = ? is in all queries
 * 
 * ISSUE: Token verification fails with wrong secret
 * SOLUTION: Ensure JWT_SECRET in .env matches between sign and verify
 * 
 * ISSUE: 500 error "Cannot read property 'id' of undefined"
 * SOLUTION: authenticateToken middleware not attached to route or token not verified
 */

module.exports = {
  authenticateToken
};
