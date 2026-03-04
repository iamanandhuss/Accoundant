// public/app.js
// Frontend logic for Personal Finance Tracker
// Fetches data from the Express API, updates dashboard cards,
// handles entry form submissions, and renders a simple bar chart.

const apiBase = '/api';

// Utility to format numbers as currency
function formatCurrency(value) {
    return `₹${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Update dashboard values
async function updateDashboard() {
    try {
        const res = await fetch(`${apiBase}/summary`);
        const data = await res.json();
        document.querySelector('#total-income .value').textContent = formatCurrency(data.income || 0);
        document.querySelector('#total-expenses .value').textContent = formatCurrency(data.expenses || 0);
        document.querySelector('#total-debts .value').textContent = formatCurrency(data.debts || 0);
        document.getElementById('net-balance-value').textContent = formatCurrency(data.net || 0);
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
            const res = await fetch(`${apiBase}/${type}`);
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
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No entries yet</td></tr>';
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
            `;
        } else if (type === 'expenses') {
            row.innerHTML = `
                <td>${entry.id}</td>
                <td>${formatCurrency(entry.amount)}</td>
                <td>${entry.category}</td>
                <td>${entry.date}</td>
            `;
        } else if (type === 'debts') {
            row.innerHTML = `
                <td>${entry.id}</td>
                <td>${formatCurrency(entry.amount)}</td>
                <td>${entry.creditor}</td>
                <td>${entry.due_date}</td>
            `;
        }
        tbody.appendChild(row);
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to add entry');
        // Clear form
        document.getElementById('amount').value = '';
        document.getElementById('detail').value = '';
        document.getElementById('date').value = '';
        // Refresh dashboard and entries table
        await updateDashboard();
    } catch (e) {
        console.error(e);
        alert('Could not add entry');
    }
}

// Initialise
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('entry-form').addEventListener('submit', handleFormSubmit);
    updateDashboard();
});
