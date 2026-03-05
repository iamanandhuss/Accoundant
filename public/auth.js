// Auth page logic
const apiBase = '/api';

// Switch between login and signup forms
function switchForm() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  
  if (loginForm.style.display === 'none') {
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
  } else {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
  }
  
  clearError();
}

// Show error message
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  console.error('Auth error:', message);
}

// Clear error message
function clearError() {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = '';
  errorDiv.style.display = 'none';
}

// Handle login
async function handleLogin(event) {
  event.preventDefault();
  clearError();
  
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  
  if (!username || !password) {
    showError('Please enter both username and password');
    return;
  }
  
  try {
    const res = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      showError(errorData.error || 'Login failed');
      return;
    }
    
    const data = await res.json();
    // Store token in localStorage
    localStorage.setItem('token', data.token);
    // Redirect to dashboard
    window.location.href = '/dashboard.html';
  } catch (e) {
    console.error(e);
    showError('An error occurred during login');
  }
}

// Handle signup
async function handleSignup(event) {
  event.preventDefault();
  clearError();
  
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value.trim();
  const confirmPassword = document.getElementById('signup-confirm-password').value.trim();
  
  if (!username || !email || !password || !confirmPassword) {
    showError('Please fill in all fields');
    return;
  }
  
  if (password !== confirmPassword) {
    showError('Passwords do not match');
    return;
  }
  
  if (password.length < 6) {
    showError('Password must be at least 6 characters');
    return;
  }
  
  try {
    const res = await fetch(`${apiBase}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      showError(errorData.error || 'Sign up failed');
      return;
    }
    
    showError('Account created successfully! Please login.');
    // Clear form
    document.getElementById('signup-input').reset();
    // Switch to login form
    setTimeout(() => switchForm(), 2000);
  } catch (e) {
    console.error(e);
    showError('An error occurred during sign up');
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-input').addEventListener('submit', handleLogin);
  document.getElementById('signup-input').addEventListener('submit', handleSignup);
  
  // Check if already logged in
  const token = localStorage.getItem('token');
  if (token) {
    window.location.href = '/dashboard.html';
  }
});
