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
  tbody.innerHTML = '';
  
  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No income entries found</td></tr>';
    return;
  }
  
  let totalAmount = 0;
  entries.forEach(entry => {
    totalAmount += entry.amount;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.id}</td>
      <td>${formatCurrency(entry.amount)}</td>
      <td>${entry.source}</td>
      <td>${entry.date}</td>
      <td><button class="delete-btn" data-type="income" data-id="${entry.id}">Delete</button></td>
    `;
    tbody.appendChild(row);
  });
  
  // Add sum row
  const sumRow = document.createElement('tr');
  sumRow.classList.add('sum-row');
  sumRow.innerHTML = `
    <td colspan="2" style="text-align: right; font-weight: bold;">Total Income:</td>
    <td colspan="3" style="font-weight: bold; color: #66ff66;">${formatCurrency(totalAmount)}</td>
  `;
  tbody.appendChild(sumRow);
  
  attachDeleteListeners();
}

// Display expenses table
function displayExpensesTable(entries) {
  const tbody = document.querySelector('#expenses-table tbody');
  tbody.innerHTML = '';
  
  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No expense entries found</td></tr>';
    return;
  }
  
  let totalAmount = 0;
  entries.forEach(entry => {
    totalAmount += entry.amount;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.id}</td>
      <td>${formatCurrency(entry.amount)}</td>
      <td>${entry.category}</td>
      <td>${entry.date}</td>
      <td><button class="delete-btn" data-type="expenses" data-id="${entry.id}">Delete</button></td>
    `;
    tbody.appendChild(row);
  });
  
  // Add sum row
  const sumRow = document.createElement('tr');
  sumRow.classList.add('sum-row');
  sumRow.innerHTML = `
    <td colspan="2" style="text-align: right; font-weight: bold;">Total Expenses:</td>
    <td colspan="3" style="font-weight: bold; color: #ff6666;">${formatCurrency(totalAmount)}</td>
  `;
  tbody.appendChild(sumRow);
  
  attachDeleteListeners();
}

// Display debts table
function displayDebtsTable(entries) {
  const tbody = document.querySelector('#debts-table tbody');
  tbody.innerHTML = '';
  
  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No debt entries found</td></tr>';
    return;
  }
  
  let totalAmount = 0;
  entries.forEach(entry => {
    totalAmount += entry.amount;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.id}</td>
      <td>${formatCurrency(entry.amount)}</td>
      <td>${entry.creditor}</td>
      <td>${entry.due_date}</td>
      <td><button class="delete-btn" data-type="debts" data-id="${entry.id}">Delete</button></td>
    `;
    tbody.appendChild(row);
  });
  
  // Add sum row
  const sumRow = document.createElement('tr');
  sumRow.classList.add('sum-row');
  sumRow.innerHTML = `
    <td colspan="2" style="text-align: right; font-weight: bold;">Total Debts:</td>
    <td colspan="3" style="font-weight: bold; color: #66b2ff;">${formatCurrency(totalAmount)}</td>
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
