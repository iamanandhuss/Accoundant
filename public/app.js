// public/app.js
// Frontend logic for Personal Finance Tracker
// Fetches data from the Express API, updates dashboard cards,
// handles entry form submissions, and renders a simple bar chart.

const apiBase = '/api';

// Check if user is logged in
function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/';
    return false;
  }
  return token;
}

// Get authorization header
function getAuthHeader() {
  const token = checkAuth();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

// Logout function
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('token');
    window.location.href = '/';
  }
}

// Utility to format numbers as currency
function formatCurrency(value) {
    return `₹${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Update dashboard values
async function updateDashboard() {
    try {
        const res = await fetch(`${apiBase}/summary`, {
            headers: getAuthHeader()
        });
        const data = await res.json();
        document.querySelector('#total-income .value').textContent = formatCurrency(data.income || 0);
        document.querySelector('#total-expenses .value').textContent = formatCurrency(data.expenses || 0);
        document.querySelector('#total-debts .value').textContent = formatCurrency(data.debts || 0);
        
        // Update balance display with status color
        const balanceElement = document.getElementById('net-balance-value');
        balanceElement.textContent = formatCurrency(data.net || 0);
        
        // Set balance status color and message
        const balanceCard = document.getElementById('net-balance');
        if (balanceCard) {
            if (data.balance < 0) {
                balanceCard.classList.add('negative-balance');
                balanceCard.classList.remove('positive-balance');
            } else {
                balanceCard.classList.add('positive-balance');
                balanceCard.classList.remove('negative-balance');
            }
        }
        
        // Store balance globally for form validation
        window.currentBalance = data.balance || 0;
        
        renderChart(data);
        await loadAndDisplayEntries();
    } catch (e) {
        console.error('Failed to load summary', e);
    }
}

// Load and display all entries in tables
async function loadAndDisplayEntries() {
    const types = ['income', 'expenses', 'debts'];
    for (const type of types) {
        try {
            const res = await fetch(`${apiBase}/${type}`, {
                headers: getAuthHeader()
            });
            const entries = await res.json();
            displayEntriesInTable(type, entries);
        } catch (e) {
            console.error(`Failed to load ${type}`, e);
        }
    }
}

// Display entries in the corresponding table
function displayEntriesInTable(type, entries) {
    const tableId = `${type}-table`;
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = '';

    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No entries yet</td></tr>';
        return;
    }

    entries.forEach(entry => {
        const row = document.createElement('tr');
        if (type === 'income') {
            row.innerHTML = `
                <td>${entry.id}</td>
                <td>${formatCurrency(entry.amount)}</td>
                <td>${entry.source}</td>
                <td>${entry.date}</td>
                <td><button class="delete-btn" data-type="${type}" data-id="${entry.id}">Delete</button></td>
            `;
        } else if (type === 'expenses') {
            row.innerHTML = `
                <td>${entry.id}</td>
                <td>${formatCurrency(entry.amount)}</td>
                <td>${entry.category}</td>
                <td>${entry.date}</td>
                <td><button class="delete-btn" data-type="${type}" data-id="${entry.id}">Delete</button></td>
            `;
        } else if (type === 'debts') {
            row.innerHTML = `
                <td>${entry.id}</td>
                <td>${formatCurrency(entry.amount)}</td>
                <td>${entry.creditor}</td>
                <td>${entry.due_date}</td>
                <td><button class="delete-btn" data-type="${type}" data-id="${entry.id}">Delete</button></td>
            `;
        }
        tbody.appendChild(row);
    });

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const type = btn.getAttribute('data-type');
            const id = btn.getAttribute('data-id');
            await deleteEntry(type, id);
        });
    });
}

// Render a simple bar chart using Canvas
function renderChart({ income = 0, expenses = 0, debts = 0 }) {
    const canvas = document.getElementById('summary-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const values = [income, expenses, debts];
    const labels = ['Income', 'Expenses', 'Debts'];
    const colors = ['#ffcc00', '#ff6666', '#66b2ff'];
    const maxVal = Math.max(...values, 1);
    const barWidth = (width - 40) / values.length;

    values.forEach((val, i) => {
        const barHeight = (val / maxVal) * (height - 40);
        const x = 20 + i * barWidth;
        const y = height - barHeight - 20;
        ctx.fillStyle = colors[i];
        ctx.fillRect(x, y, barWidth - 20, barHeight);
        // Label
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labels[i], x + barWidth / 2 - 10, height - 5);
        // Value
        ctx.fillText(formatCurrency(val), x + barWidth / 2 - 10, y - 5);
    });
}

// Handle form submission
async function handleFormSubmit(event) {
    event.preventDefault();
    const type = document.getElementById('entry-type').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const detail = document.getElementById('detail').value.trim();
    const date = document.getElementById('date').value;
    if (isNaN(amount) || !detail || !date) return;

    // Check if trying to add expense with insufficient balance
    if (type === 'expenses' && window.currentBalance !== undefined) {
        const newBalance = window.currentBalance - amount;
        if (newBalance < 0) {
            alert(`⚠️ Insufficient Balance!\n\nCurrent Balance: ${formatCurrency(window.currentBalance)}\nExpense Amount: ${formatCurrency(amount)}\nResulting Balance: ${formatCurrency(newBalance)}\n\nYou cannot add expenses when your balance would go negative.`);
            return;
        }
    }

    const payload = {};
    if (type === 'income') {
        payload.amount = amount;
        payload.source = detail;
        payload.date = date;
    } else if (type === 'expenses') {
        payload.amount = amount;
        payload.category = detail;
        payload.date = date;
    } else if (type === 'debts') {
        payload.amount = amount;
        payload.creditor = detail;
        payload.due_date = date;
    }

    try {
        const res = await fetch(`${apiBase}/${type}`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: JSON.stringify(payload)
        });
        
        const responseData = await res.json();
        
        if (!res.ok) {
            throw new Error(responseData.error || `Failed to add entry: ${res.status}`);
        }
        
        // Show success message if on add-entry page
        const successDiv = document.getElementById('success-message');
        if (successDiv) {
            successDiv.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} entry added successfully!`;
            successDiv.style.display = 'block';
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 3000);
        }
        
        // Clear form
        document.getElementById('amount').value = '';
        document.getElementById('detail').value = '';
        document.getElementById('date').value = '';
        
        // Refresh dashboard if on dashboard page
        if (window.location.pathname.includes('dashboard.html')) {
            await updateDashboard();
        }
    } catch (e) {
        console.error('Entry submission error:', e);
        alert('Could not add entry: ' + e.message);
    }
}

// Delete entry
async function deleteEntry(type, id) {
    if (!confirm(`Are you sure you want to delete this ${type} entry?`)) {
        return;
    }

    try {
        const res = await fetch(`${apiBase}/${type}/${id}`, {
            method: 'DELETE',
            headers: getAuthHeader()
        });
        if (!res.ok) throw new Error('Failed to delete entry');
        // Refresh dashboard and entries table
        await updateDashboard();
    } catch (e) {
        console.error(e);
        alert('Could not delete entry');
    }
}

// Initialise
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    const pathname = window.location.pathname;
    
    // All pages have the form handler if form exists
    const entryForm = document.getElementById('entry-form');
    if (entryForm) {
        entryForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Dashboard page
    if (pathname.includes('dashboard.html') || pathname === '/dashboard.html') {
        updateDashboard();
    }
    
    // Entries page
    if (pathname.includes('entries.html')) {
        loadAndDisplayEntries();
    }
});
