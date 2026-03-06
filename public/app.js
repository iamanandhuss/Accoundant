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

        // Update 4 main cards
        const incomeEl = document.querySelector('#total-income .value');
        if (incomeEl) incomeEl.textContent = formatCurrency(data.income || 0);
        const incomeSub = document.querySelector('#total-income .subtitle');
        const incomeBadge = document.querySelector('#total-income .badge');
        if (incomeSub) { incomeSub.textContent = 'Lifetime total'; incomeSub.style.color = '#a0aab2'; }
        if (incomeBadge) { incomeBadge.textContent = 'Total'; }

        const expEl = document.querySelector('#total-expenses .value');
        if (expEl) expEl.textContent = formatCurrency(data.expenses || 0);
        const expSub = document.querySelector('#total-expenses .subtitle');
        const expBadge = document.querySelector('#total-expenses .badge');
        if (expSub) { expSub.textContent = 'Lifetime total'; expSub.style.color = '#a0aab2'; }
        if (expBadge) { expBadge.textContent = 'Total'; }

        const debtEl = document.querySelector('#total-debts .value');
        if (debtEl) debtEl.textContent = formatCurrency(data.debts || 0);
        const debtSub = document.querySelector('#total-debts .subtitle');
        const debtBadge = document.querySelector('#total-debts .badge');
        if (debtSub) { debtSub.textContent = data.debts > 0 ? 'Active debits' : 'Clear'; debtSub.style.color = '#a0aab2'; }
        if (debtBadge) { debtBadge.textContent = data.debts > 0 ? 'Active' : 'Zero'; debtBadge.className = data.debts > 0 ? 'badge red' : 'badge green'; }

        // Update balance display with status color
        const balanceElement = document.getElementById('net-balance-value');
        if (balanceElement) {
            balanceElement.textContent = formatCurrency(data.net || 0);
        }

        const cardBalanceElementTotal = document.getElementById('card-balance-total');
        if (cardBalanceElementTotal) {
            cardBalanceElementTotal.textContent = formatCurrency(data.net || 0);
        }

        const chartBalanceValue = document.getElementById('chart-balance-value');
        if (chartBalanceValue) {
            chartBalanceValue.textContent = formatCurrency(data.net || 0);
        }

        // Store balance globally for form validation
        window.currentBalance = data.balance || 0;

        renderChart(data);
        await loadAndDisplayEntries();
        await loadRecentTransactions();
        await loadExpenseBreakdown();
        updateSavingPlans(data.net || 0);
    } catch (e) {
        console.error('Failed to load summary', e);
    }
}

// Fetch and display dynamic expense breakdown and goals
async function loadExpenseBreakdown() {
    const listEl = document.querySelector('.expense-list');
    const chartEl = document.querySelector('.circle-chart');
    if (!listEl || !chartEl) return;

    try {
        const res = await fetch(`${apiBase}/expenses`, { headers: getAuthHeader() });
        const expenses = await res.json();

        let total = 0;
        const categoryMap = {};
        expenses.forEach(e => {
            total += e.amount;
            categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
        });

        const sortedCats = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
        const colors = ['#1a3224', '#8de392', '#eef2f0', '#ffcc00', '#ff6666'];

        listEl.innerHTML = '';
        if (total === 0) {
            listEl.innerHTML = '<li><div style="color:#a0aab2">No expenses yet</div></li>';
            chartEl.style.background = '#eef2f0';
            chartEl.style.border = 'none';
            return;
        }

        let conicStops = [];
        let currentPercent = 0;

        sortedCats.slice(0, 4).forEach((cat, index) => {
            const [name, amount] = cat;
            const percent = Math.round((amount / total) * 100);
            const color = colors[index % colors.length];

            const li = document.createElement('li');
            li.innerHTML = `<div><span style="color:${color}; margin-right:5px;">■</span> ${name}</div><span>${percent}%</span>`;
            listEl.appendChild(li);

            conicStops.push(`${color} ${currentPercent}% ${currentPercent + percent}%`);
            currentPercent += percent;
        });

        // Add others if any
        if (sortedCats.length > 4) {
            const othersAmount = sortedCats.slice(4).reduce((sum, cat) => sum + cat[1], 0);
            const percent = Math.round((othersAmount / total) * 100);
            const color = colors[4];
            const li = document.createElement('li');
            li.innerHTML = `<div><span style="color:${color}; margin-right:5px;">■</span> Others</div><span>${percent}%</span>`;
            listEl.appendChild(li);
            conicStops.push(`${color} ${currentPercent}% ${currentPercent + percent}%`);
        }

        chartEl.style.border = 'none';
        chartEl.style.background = `conic-gradient(${conicStops.join(', ')})`;

        if (!document.getElementById('donut-hole')) {
            const hole = document.createElement('div');
            hole.id = 'donut-hole';
            hole.style.width = '100px';
            hole.style.height = '100px';
            hole.style.background = 'white';
            hole.style.borderRadius = '50%';
            hole.style.position = 'absolute';
            hole.style.top = '20px';
            hole.style.left = '20px';
            chartEl.appendChild(hole);

            const style = document.createElement('style');
            style.textContent = '.circle-chart::after { display: none !important; }';
            document.head.appendChild(style);
        }

    } catch (e) {
        console.error('Failed to load expense breakdown', e);
    }
}

function updateSavingPlans(netBalance) {
    const plansContainer = document.querySelector('.bottom-section .card:nth-child(2)');
    if (!plansContainer) return;

    plansContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
            <h3>Financial Goals</h3>
        </div>
        <p style="font-size:12px; color:#6a746e;">Net Balance Summary</p>
        <h2 style="font-size:24px; font-weight:800;">${formatCurrency(netBalance)}</h2>
    `;

    const goal1 = 1000;
    const progress1 = Math.min(100, Math.max(0, (netBalance / goal1) * 100));

    const goal2 = 10000;
    const progress2 = Math.min(100, Math.max(0, (netBalance / goal2) * 100));

    plansContainer.innerHTML += `
        <div class="plan-item">
            <p>Starter Emergency Fund</p>
            <div class="progress">
                <div class="progress-bar" style="width:${progress1}%"></div>
            </div>
            <div class="plan-stats"><span>${formatCurrency(netBalance)} / ${formatCurrency(goal1)}</span><span>${Math.round(progress1)}%</span></div>
        </div>
        <div class="plan-item">
            <p>Full Emergency Fund</p>
            <div class="progress">
                <div class="progress-bar light" style="width:${progress2}%"></div>
            </div>
            <div class="plan-stats"><span>${formatCurrency(netBalance)} / ${formatCurrency(goal2)}</span><span>${Math.round(progress2)}%</span></div>
        </div>
    `;
}

// Fetch and display recent transactions unified for the dashboard
async function loadRecentTransactions() {
    const tableBody = document.querySelector('#recent-transactions-table tbody');
    if (!tableBody) return; // Not on dashboard

    try {
        const [incomeRes, expenseRes, debtRes] = await Promise.all([
            fetch(`${apiBase}/income`, { headers: getAuthHeader() }).catch(() => ({ json: () => [] })),
            fetch(`${apiBase}/expenses`, { headers: getAuthHeader() }).catch(() => ({ json: () => [] })),
            fetch(`${apiBase}/debts`, { headers: getAuthHeader() }).catch(() => ({ json: () => [] }))
        ]);

        const incomeData = incomeRes.ok ? await incomeRes.json() : [];
        const expenseData = expenseRes.ok ? await expenseRes.json() : [];
        const debtData = debtRes.ok ? await debtRes.json() : [];

        let allTransactions = [];

        incomeData.forEach(item => {
            allTransactions.push({ type: 'Income', name: item.source || 'Income', subtext: 'Deposit', date: item.date, amount: item.amount, isPositive: true, status: 'Completed', statusClass: 'status-completed' });
        });
        expenseData.forEach(item => {
            allTransactions.push({ type: 'Expense', name: item.category || 'Expense', subtext: 'Payment', date: item.date, amount: item.amount, isPositive: false, status: 'Completed', statusClass: 'status-completed' });
        });
        debtData.forEach(item => {
            allTransactions.push({ type: 'Debt', name: item.creditor || 'Debt', subtext: 'Liability', date: item.due_date, amount: item.amount, isPositive: false, status: 'Pending', statusClass: 'status-pending' });
        });

        // Sort by date descending
        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Take top 5 recent
        allTransactions = allTransactions.slice(0, 5);

        tableBody.innerHTML = '';

        if (allTransactions.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #a0aab2;">No recent transactions</td></tr>';
            return;
        }

        allTransactions.forEach(tx => {
            const row = document.createElement('tr');

            const amountColorClass = tx.isPositive ? 'text-green' : 'text-red';
            const sign = tx.isPositive ? '+' : '-';

            row.innerHTML = `
                <td>
                    <div class="tx-name">${tx.name}</div>
                    <div class="tx-sub">${tx.subtext}</div>
                </td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="display:inline-block; width:24px; height:16px; background:#1a3224; border-radius:3px;"></span>
                        <span style="font-size:11px; color:#a0aab2;">Internal Account</span>
                    </div>
                </td>
                <td>
                    <div style="color: #6a746e;">${new Date(tx.date).toISOString().split('T')[0]}</div>
                </td>
                <td class="${amountColorClass}" style="font-weight:700;">
                    ${sign}${formatCurrency(tx.amount)}
                </td>
                <td>
                    <span class="status-badge ${tx.statusClass}">${tx.status}</span>
                </td>
            `;
            tableBody.appendChild(row);
        });

    } catch (e) {
        console.error('Failed to load recent transactions', e);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #d14b4b;">Error loading data</td></tr>';
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
    if (!tbody) return;
    tbody.innerHTML = '';

    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #a0aab2;">No entries yet</td></tr>';
        return;
    }

    let totalAmount = 0;
    entries.forEach(entry => {
        totalAmount += entry.amount;
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #f2f2f2';

        const amountColorClass = type === 'income' ? 'text-green' : 'text-red';
        const sign = type === 'income' ? '+' : '-';
        const name = entry.source || entry.category || entry.creditor;
        const subtext = type === 'income' ? 'Deposit' : type === 'expenses' ? 'Payment' : 'Liability';
        const dateStr = entry.date || entry.due_date;

        row.innerHTML = `
            <td style="padding: 12px 10px; color: #a0aab2;">#${entry.id}</td>
            <td style="padding: 12px 10px;" class="${amountColorClass}"><strong>${sign}${formatCurrency(entry.amount)}</strong></td>
            <td style="padding: 12px 10px;">
                <div class="tx-name" style="font-weight: 600; color: #1a1a1a;">${name}</div>
                <div class="tx-sub" style="font-size: 11px; color: #a0aab2;">${subtext}</div>
            </td>
            <td style="padding: 12px 10px; color: #6a746e;">${new Date(dateStr).toISOString().split('T')[0]}</td>
            <td style="padding: 12px 10px;">
                <button class="delete-btn" style="background:#fdf0f0; color:#d14b4b; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600;" data-type="${type}" data-id="${entry.id}">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Add sum row
    const sumRow = document.createElement('tr');
    sumRow.classList.add('sum-row');
    const title = type === 'income' ? 'Total Income' : type === 'expenses' ? 'Total Expenses' : 'Total Debts';
    const color = type === 'income' ? '#2b4c3e' : '#d14b4b';
    sumRow.innerHTML = `
        <td colspan="2" style="text-align: right; font-weight: bold; padding: 15px 10px;">${title}:</td>
        <td colspan="3" style="font-weight: bold; padding: 15px 10px; color: ${color};">${formatCurrency(totalAmount)}</td>
    `;
    tbody.appendChild(sumRow);

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const type = btn.getAttribute('data-type');
            const id = btn.getAttribute('data-id');
            await deleteEntry(type, id);

            // Reload if on entries page
            if (window.location.pathname.includes('entries.html')) {
                loadAndDisplayEntries();
            }
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

    // Set greeting if exists
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const greetingEl = document.getElementById('user-greeting');
            if (greetingEl && payload.username) {
                greetingEl.textContent = `Hello, ${payload.username}`;
            }
        } catch (e) { }
    }

    // All pages have the form handler if form exists
    const entryForm = document.getElementById('entry-form');
    if (entryForm) {
        entryForm.addEventListener('submit', handleFormSubmit);
    }

    // Dashboard page
    if (pathname.includes('dashboard.html') || pathname === '/dashboard.html' || pathname === '/') {
        updateDashboard();
    }

    // Entries page
    if (pathname.includes('entries.html')) {
        loadAndDisplayEntries();
    }
});
