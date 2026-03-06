// Filter and sorting functionality
let allEntries = [];

// Load and filter entries based on page
async function loadFilteredEntries() {
  const pathname = window.location.pathname;
  let type = '';

  if (pathname.includes('income.html')) {
    type = 'income';
  } else if (pathname.includes('expenses.html')) {
    type = 'expenses';
  } else if (pathname.includes('debts.html')) {
    type = 'debts';
  } else {
    return;
  }

  try {
    const res = await fetch(`/api/${type}`, {
      headers: getAuthHeader()
    });

    if (!res.ok) throw new Error('Failed to load entries');

    allEntries = await res.json();
    applyFiltersAndSort();
  } catch (e) {
    console.error(`Failed to load ${type}`, e);
  }
}

// Apply search and sort filters
function applyFiltersAndSort() {
  const searchInput = document.getElementById('filter-search');
  const sortSelect = document.getElementById('filter-sort');

  if (!searchInput || !sortSelect) return;

  let filtered = [...allEntries];

  // Search filter
  const searchTerm = searchInput.value.toLowerCase();
  if (searchTerm) {
    filtered = filtered.filter(entry => {
      const source = entry.source ? entry.source.toLowerCase() : '';
      const category = entry.category ? entry.category.toLowerCase() : '';
      const creditor = entry.creditor ? entry.creditor.toLowerCase() : '';

      return source.includes(searchTerm) || category.includes(searchTerm) || creditor.includes(searchTerm);
    });
  }

  // Sort
  const sortValue = sortSelect.value;
  if (sortValue === 'date-desc') {
    filtered.sort((a, b) => new Date(b.date || b.due_date) - new Date(a.date || a.due_date));
  } else if (sortValue === 'date-asc') {
    filtered.sort((a, b) => new Date(a.date || a.due_date) - new Date(b.date || b.due_date));
  } else if (sortValue === 'amount-desc') {
    filtered.sort((a, b) => b.amount - a.amount);
  } else if (sortValue === 'amount-asc') {
    filtered.sort((a, b) => a.amount - b.amount);
  }

  // Display filtered entries
  const pathname = window.location.pathname;
  if (pathname.includes('income.html')) {
    displayIncomeTable(filtered);
  } else if (pathname.includes('expenses.html')) {
    displayExpensesTable(filtered);
  } else if (pathname.includes('debts.html')) {
    displayDebtsTable(filtered);
  }
}

// Display income table
function displayIncomeTable(entries) {
  const tbody = document.querySelector('#income-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #a0aab2;">No income entries found</td></tr>';
    return;
  }

  let totalAmount = 0;
  entries.forEach(entry => {
    totalAmount += entry.amount;
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid #f2f2f2';

    row.innerHTML = `
      <td style="padding: 12px 10px; color: #a0aab2;">#${entry.id}</td>
      <td style="padding: 12px 10px;" class="text-green"><strong>+${formatCurrency(entry.amount)}</strong></td>
      <td style="padding: 12px 10px;">
          <div class="tx-name" style="font-weight: 600; color: #1a1a1a;">${entry.source}</div>
          <div class="tx-sub" style="font-size: 11px; color: #a0aab2;">Deposit</div>
      </td>
      <td style="padding: 12px 10px; color: #6a746e;">${new Date(entry.date).toISOString().split('T')[0]}</td>
      <td style="padding: 12px 10px;">
          <button class="delete-btn" style="background:#fdf0f0; color:#d14b4b; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600;" data-type="income" data-id="${entry.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Add sum row
  const sumRow = document.createElement('tr');
  sumRow.classList.add('sum-row');
  sumRow.innerHTML = `
    <td colspan="2" style="text-align: right; font-weight: bold; padding: 15px 10px;">Total Income:</td>
    <td colspan="3" style="font-weight: bold; padding: 15px 10px; color: #2b4c3e;">${formatCurrency(totalAmount)}</td>
  `;
  tbody.appendChild(sumRow);

  attachDeleteListeners();
}

// Display expenses table
function displayExpensesTable(entries) {
  const tbody = document.querySelector('#expenses-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #a0aab2;">No expense entries found</td></tr>';
    return;
  }

  let totalAmount = 0;
  entries.forEach(entry => {
    totalAmount += entry.amount;
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid #f2f2f2';

    row.innerHTML = `
      <td style="padding: 12px 10px; color: #a0aab2;">#${entry.id}</td>
      <td style="padding: 12px 10px;" class="text-red"><strong>-${formatCurrency(entry.amount)}</strong></td>
      <td style="padding: 12px 10px;">
          <div class="tx-name" style="font-weight: 600; color: #1a1a1a;">${entry.category}</div>
          <div class="tx-sub" style="font-size: 11px; color: #a0aab2;">Payment</div>
      </td>
      <td style="padding: 12px 10px; color: #6a746e;">${new Date(entry.date).toISOString().split('T')[0]}</td>
      <td style="padding: 12px 10px;">
          <button class="delete-btn" style="background:#fdf0f0; color:#d14b4b; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600;" data-type="expenses" data-id="${entry.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Add sum row
  const sumRow = document.createElement('tr');
  sumRow.classList.add('sum-row');
  sumRow.innerHTML = `
    <td colspan="2" style="text-align: right; font-weight: bold; padding: 15px 10px;">Total Expenses:</td>
    <td colspan="3" style="font-weight: bold; padding: 15px 10px; color: #d14b4b;">${formatCurrency(totalAmount)}</td>
  `;
  tbody.appendChild(sumRow);

  attachDeleteListeners();
}

// Display debts table
function displayDebtsTable(entries) {
  const tbody = document.querySelector('#debts-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #a0aab2;">No debt entries found</td></tr>';
    return;
  }

  let totalAmount = 0;
  entries.forEach(entry => {
    totalAmount += entry.amount;
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid #f2f2f2';

    row.innerHTML = `
      <td style="padding: 12px 10px; color: #a0aab2;">#${entry.id}</td>
      <td style="padding: 12px 10px;" class="text-red"><strong>-${formatCurrency(entry.amount)}</strong></td>
      <td style="padding: 12px 10px;">
          <div class="tx-name" style="font-weight: 600; color: #1a1a1a;">${entry.creditor}</div>
          <div class="tx-sub" style="font-size: 11px; color: #a0aab2;">Liability</div>
      </td>
      <td style="padding: 12px 10px; color: #6a746e;">${new Date(entry.due_date).toISOString().split('T')[0]}</td>
      <td style="padding: 12px 10px;">
          <button class="delete-btn" style="background:#fdf0f0; color:#d14b4b; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600;" data-type="debts" data-id="${entry.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Add sum row
  const sumRow = document.createElement('tr');
  sumRow.classList.add('sum-row');
  sumRow.innerHTML = `
    <td colspan="2" style="text-align: right; font-weight: bold; padding: 15px 10px;">Total Debts:</td>
    <td colspan="3" style="font-weight: bold; padding: 15px 10px; color: #d14b4b;">${formatCurrency(totalAmount)}</td>
  `;
  tbody.appendChild(sumRow);

  attachDeleteListeners();
}

// Attach delete button listeners
function attachDeleteListeners() {
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const type = btn.getAttribute('data-type');
      const id = btn.getAttribute('data-id');
      await deleteEntry(type, id);
      // Reload entries after deletion
      await loadFilteredEntries();
    });
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadFilteredEntries();

  // Attach filter listeners
  const searchInput = document.getElementById('filter-search');
  const sortSelect = document.getElementById('filter-sort');

  if (searchInput) {
    searchInput.addEventListener('input', applyFiltersAndSort);
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', applyFiltersAndSort);
  }
});
