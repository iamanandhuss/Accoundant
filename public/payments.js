document.addEventListener('DOMContentLoaded', () => {
    // Rely on app.js checkAuth. But if token exists, load data.
    const token = localStorage.getItem('token');
    if (token) {
        loadCardsAndTransactions();
    }

    // Set greeting
    const userString = localStorage.getItem('user');
    if (userString) {
        try {
            const user = JSON.parse(userString);
            document.getElementById('user-greeting').textContent = user.username;
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
    }
});

let cardsData = [];
let transactionsData = [];
let selectedCardId = null;

async function loadCardsAndTransactions() {
    const token = localStorage.getItem('token');

    try {
        // Fetch cards
        const cardsRes = await fetch('/api/cards', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!cardsRes.ok) throw new Error('Failed to fetch cards');
        cardsData = await cardsRes.json();

        // Fetch transactions
        const txRes = await fetch('/api/card_transactions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!txRes.ok) throw new Error('Failed to fetch transactions');
        transactionsData = await txRes.json();

        renderCards();

        // If a card was selected, re-render its details
        if (selectedCardId) {
            selectCard(selectedCardId);
        }

    } catch (err) {
        console.error(err);
        alert('Error loading cards data');
    }
}

function renderCards() {
    const container = document.getElementById('cards-container');
    container.innerHTML = '';

    if (cardsData.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; color: #6a746e;">No cards added yet. Click "+ Add New Card" to get started.</p>';
        return;
    }

    cardsData.forEach(card => {
        const cardTx = transactionsData.filter(tx => tx.cardId === card.id);
        const totalSpent = cardTx.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

        // Styling based on realistic card gradients
        const gradientClass = `bg-gradient-${(card.id % 4) + 1}`;

        const cardEl = document.createElement('div');
        cardEl.className = `card-item ${selectedCardId === card.id ? 'selected' : ''}`;
        cardEl.onclick = () => selectCard(card.id);

        // Format the card number for display (e.g. 1265 7860 4097 4509)
        // Since we only have last 4, we'll pad the rest with dots or a placeholder, or just show last 4
        // The image shows a full 16 digit number. We'll show **** **** **** and the last 4.
        const displayNumber = `**** **** **** ${card.lastFourDigits}`;

        // Format expiry date (MM/YY) from repaymentDueDate or just use a placeholder
        const expiryDate = new Date(card.repaymentDueDate);
        const expiryStr = `${String(expiryDate.getMonth() + 1).padStart(2, '0')}/${String(expiryDate.getFullYear()).slice(-2)}`;

        cardEl.innerHTML = `
            <div class="realistic-card ${gradientClass}">
                <div class="card-top">
                    <div class="chip"></div>
                    <div class="brand">VISA</div>
                </div>
                <div class="card-number">${displayNumber}</div>
                <div class="card-bottom">
                    <div class="card-holder">
                        <div class="label">Card Holder</div>
                        <div class="name">${card.cardName}</div>
                    </div>
                    <div class="card-expiry">
                        <div class="valid-thru">VALID<br>THRU</div>
                        <div class="date">${expiryStr}</div>
                    </div>
                </div>
            </div>
        `;

        container.appendChild(cardEl);
    });
}

function selectCard(id) {
    selectedCardId = id;
    renderCards(); // update selected visual state

    const card = cardsData.find(c => c.id === id);
    if (!card) return;

    const detailsView = document.getElementById('card-details-view');
    detailsView.style.display = 'block';

    document.getElementById('detail-card-name').textContent = card.cardName;
    document.getElementById('detail-card-bank').textContent = `${card.bankName} ending in ${card.lastFourDigits}`;

    const cardTx = transactionsData.filter(tx => tx.cardId === card.id);
    const totalSpent = cardTx.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    const remaining = parseFloat(card.cardLimit) - totalSpent;

    document.getElementById('detail-total-spent').textContent = `$${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    document.getElementById('detail-remaining-credit').textContent = `$${remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    // Render transactions
    const txList = document.getElementById('card-transactions-list');
    txList.innerHTML = '';

    if (cardTx.length === 0) {
        txList.innerHTML = '<p style="color: #6a746e;">No transactions logged for this card.</p>';
    } else {
        // Sort by date desc
        cardTx.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));

        cardTx.forEach(tx => {
            const dateStr = new Date(tx.transactionDate).toLocaleDateString();
            const txEl = document.createElement('div');
            txEl.className = 'transaction-item';
            txEl.innerHTML = `
                <div class="tx-info">
                    <h4>${tx.description}</h4>
                    <p>${tx.category} • ${dateStr}</p>
                </div>
                <div class="tx-amount">
                    $${parseFloat(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
            `;
            txList.appendChild(txEl);
        });
    }
}

// Modals
function openAddCardModal() {
    document.getElementById('addCardModal').style.display = 'flex';
}

function closeAddCardModal() {
    document.getElementById('addCardModal').style.display = 'none';
    document.getElementById('add-card-form').reset();
}

function openAddTransactionModal() {
    if (!selectedCardId) {
        alert("Please select a card first.");
        return;
    }
    document.getElementById('tx-card-id').value = selectedCardId;
    document.getElementById('txDate').valueAsDate = new Date(); // default to today
    document.getElementById('addTransactionModal').style.display = 'flex';
}

function closeAddTransactionModal() {
    document.getElementById('addTransactionModal').style.display = 'none';
    document.getElementById('add-tx-form').reset();
}

function openDeleteCardModal() {
    if (!selectedCardId) {
        alert("Please select a card first.");
        return;
    }
    document.getElementById('deleteCardModal').style.display = 'flex';
}

function closeDeleteCardModal() {
    document.getElementById('deleteCardModal').style.display = 'none';
    if (document.getElementById('delete-card-form')) {
        document.getElementById('delete-card-form').reset();
    }
}

// Form Handlers
document.getElementById('add-card-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    const cardData = {
        cardName: document.getElementById('cardName').value,
        bankName: document.getElementById('bankName').value,
        lastFourDigits: document.getElementById('lastFourDigits').value,
        cardLimit: parseFloat(document.getElementById('cardLimit').value),
        repaymentDueDate: document.getElementById('repaymentDueDate').value
    };

    try {
        const res = await fetch('/api/cards', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(cardData)
        });

        if (!res.ok) throw new Error('Failed to add card');

        loadCardsAndTransactions();
        closeAddCardModal();
    } catch (err) {
        console.error(err);
        alert('Error adding card');
    }
});

document.getElementById('add-tx-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    const txData = {
        cardId: parseInt(document.getElementById('tx-card-id').value),
        amount: parseFloat(document.getElementById('txAmount').value),
        description: document.getElementById('txDescription').value,
        category: document.getElementById('txCategory').value,
        transactionDate: document.getElementById('txDate').value
    };

    try {
        const res = await fetch('/api/card_transactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(txData)
        });

        if (!res.ok) throw new Error('Failed to log transaction');

        closeAddTransactionModal();
        loadCardsAndTransactions();
    } catch (err) {
        console.error(err);
        alert('Error logging transaction');
    }
});

const deleteCardForm = document.getElementById('delete-card-form');
if (deleteCardForm) {
    deleteCardForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const password = document.getElementById('deleteCardPassword').value;

        try {
            const res = await fetch(`/api/cards/${selectedCardId}/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ password })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to delete card');
            }

            // Success message
            const detailsView = document.getElementById('card-details-view');
            if (detailsView) detailsView.style.display = 'none';

            closeDeleteCardModal();
            selectedCardId = null;
            loadCardsAndTransactions();

            // Show brief success alert
            alert('Card permanently deleted.');
        } catch (err) {
            console.error(err);
            alert(err.message);
        }
    });
}
