const form = document.getElementById('transaction-form');
const accountIdInput = document.getElementById('account-id');
const amountInput = document.getElementById('amount');
const transactionsContainer = document.getElementById('transactions');
const errorMessage = document.getElementById('error-message');

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function clearError() {
  errorMessage.hidden = true;
  errorMessage.textContent = '';
}

function renderTransaction(transaction, balance) {
  const item = document.createElement('div');
  item.className = 'transaction';
  item.dataset.type = 'transaction';
  item.dataset.accountId = transaction.account_id;
  item.dataset.amount = String(transaction.amount);
  item.dataset.balance = String(balance);

  item.innerHTML = `
    <div class="transaction-row">
      <strong>Account:</strong>
      <span>${transaction.account_id}</span>
    </div>
    <div class="transaction-row">
      <strong>Amount:</strong>
      <span>${transaction.amount}</span>
    </div>
    <div class="transaction-row">
      <strong>Balance:</strong>
      <span>${balance}</span>
    </div>
  `;

  transactionsContainer.prepend(item);
}

async function submitTransaction(event) {
  event.preventDefault();
  clearError();

  const accountId = accountIdInput.value.trim();
  const amount = Number(amountInput.value);

  try {
    const transactionResponse = await fetch('http://localhost:8080/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_id: accountId,
        amount,
      }),
    });

    if (!transactionResponse.ok) {
      throw new Error('Unable to create transaction');
    }

    const transaction = await transactionResponse.json();

    const accountResponse = await fetch(`http://localhost:8080/accounts/${transaction.account_id}`);
    if (!accountResponse.ok) {
      throw new Error('Unable to load account balance');
    }

    const account = await accountResponse.json();
    renderTransaction(transaction, account.balance);

    form.reset();
  } catch (error) {
    showError(error.message);
  }
}

form.addEventListener('submit', submitTransaction);
