// ── State ──────────────────────────────────────────────────
let transactions = JSON.parse(localStorage.getItem('void_transactions') || '[]');
let budgets = JSON.parse(localStorage.getItem('void_budgets') || '{}');
let currentType = 'expense';

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const dateEl = document.getElementById('today-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }).toUpperCase();
  }

  const txDateInput = document.getElementById('tx-date');
  if (txDateInput) txDateInput.value = new Date().toISOString().split('T')[0];

  renderAll();
  populateFilterCategories();
});

// ── Navigation ─────────────────────────────────────────────
function showSection(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
  const section = document.getElementById(id);
  if (section) section.classList.add('active');
  if (el) el.classList.add('active');
  renderAll();
}

// ── Type Toggle ────────────────────────────────────────────
function setType(type, btn) {
  currentType = type;
  document.querySelectorAll('.toggle').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Add Transaction ────────────────────────────────────────
function addTransaction(e) {
  e.preventDefault();
  const desc = document.getElementById('tx-desc').value.trim();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const category = document.getElementById('tx-category').value;
  const date = document.getElementById('tx-date').value;

  if (!desc || !amount || !date) return;

  const tx = {
    id: Date.now(),
    type: currentType,
    desc,
    amount,
    category,
    date
  };

  transactions.unshift(tx);
  save();
  renderAll();
  populateFilterCategories();
  e.target.reset();
  document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
}

function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  renderAll();
}

// ── Save Budget ────────────────────────────────────────────
function saveBudget(e) {
  e.preventDefault();
  const cat = document.getElementById('budget-category').value;
  const amt = parseFloat(document.getElementById('budget-amount').value);
  if (!cat || !amt) return;
  budgets[cat] = amt;
  save();
  renderAll();
  e.target.reset();
}

function deleteBudget(cat) {
  delete budgets[cat];
  save();
  renderAll();
}

// ── Persist ────────────────────────────────────────────────
function save() {
  localStorage.setItem('void_transactions', JSON.stringify(transactions));
  localStorage.setItem('void_budgets', JSON.stringify(budgets));
}

// ── Calculations ───────────────────────────────────────────
function getMonthTxs() {
  const now = new Date();
  return transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

function calcStats() {
  const monthTxs = getMonthTxs();
  const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const allIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const allExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = allIncome - allExpenses;
  const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;
  return { income, expenses, balance, savingsRate };
}

function getCategoryTotals() {
  const monthTxs = getMonthTxs().filter(t => t.type === 'expense');
  const totals = {};
  monthTxs.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });
  return totals;
}

// ── Render All ─────────────────────────────────────────────
function renderAll() {
  renderStats();
  renderCategoryChart();
  renderRecentTransactions();
  renderBudgetProgress();
  renderBudgetList();
  renderTransactions();
}

// ── Stats ──────────────────────────────────────────────────
function renderStats() {
  const { income, expenses, balance, savingsRate } = calcStats();
  const fmt = n => '$' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const balanceEl = document.getElementById('stat-balance');
  if (balanceEl) {
    balanceEl.textContent = (balance < 0 ? '-' : '') + fmt(balance);
    balanceEl.className = 'stat-value' + (balance < 0 ? ' red' : '');
  }
  setText('stat-income', fmt(income));
  setText('stat-expenses', fmt(expenses));
  setText('stat-savings', savingsRate + '%');
  setText('stat-balance-sub', transactions.length + ' total transactions');
  setText('stat-income-sub', getMonthTxs().filter(t => t.type === 'income').length + ' this month');
  setText('stat-expenses-sub', getMonthTxs().filter(t => t.type === 'expense').length + ' this month');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Category Chart ─────────────────────────────────────────
function renderCategoryChart() {
  const el = document.getElementById('category-chart');
  if (!el) return;
  const totals = getCategoryTotals();
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;

  if (sorted.length === 0) {
    el.innerHTML = '<div class="empty-state">// NO DATA YET</div>';
    return;
  }

  el.innerHTML = sorted.map(([cat, amt]) => `
    <div class="cat-row">
      <div class="cat-info">
        <span class="cat-name">${cat}</span>
        <span class="cat-amt">$${amt.toFixed(2)}</span>
      </div>
      <div class="cat-bar-bg">
        <div class="cat-bar" style="width:${(amt / max * 100).toFixed(1)}%"></div>
      </div>
    </div>
  `).join('');
}

// ── Recent Transactions ────────────────────────────────────
function renderRecentTransactions() {
  const el = document.getElementById('recent-list');
  if (!el) return;
  const recent = transactions.slice(0, 6);
  renderTxList(el, recent, false);
}

// ── Budget Progress ────────────────────────────────────────
function renderBudgetProgress() {
  const el = document.getElementById('budget-progress');
  if (!el) return;
  const catTotals = getCategoryTotals();
  const entries = Object.entries(budgets);

  if (entries.length === 0) {
    el.innerHTML = '<div class="empty-state">// SET BUDGETS TO TRACK PROGRESS</div>';
    return;
  }

  el.innerHTML = entries.map(([cat, limit]) => {
    const spent = catTotals[cat] || 0;
    const pct = Math.min((spent / limit) * 100, 100).toFixed(1);
    const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
    return `
      <div class="budget-row">
        <div class="budget-info">
          <span class="budget-cat">${cat}</span>
          <span class="budget-nums">$${spent.toFixed(2)} / $${limit.toFixed(2)}</span>
        </div>
        <div class="budget-bar-bg">
          <div class="budget-bar ${cls}" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Budget List ────────────────────────────────────────────
function renderBudgetList() {
  const el = document.getElementById('budget-list');
  if (!el) return;
  const entries = Object.entries(budgets);

  if (entries.length === 0) {
    el.innerHTML = '<div class="empty-state">// NO BUDGETS SET</div>';
    return;
  }

  el.innerHTML = entries.map(([cat, amt]) => `
    <div class="budget-item">
      <span>${cat}</span>
      <span>$${amt.toFixed(2)}/mo</span>
      <button class="budget-item-del" onclick="deleteBudget('${cat}')">×</button>
    </div>
  `).join('');
}

// ── All Transactions ───────────────────────────────────────
function renderTransactions() {
  const el = document.getElementById('all-tx-list');
  if (!el) return;

  const typeFilter = document.getElementById('filter-type')?.value || 'all';
  const catFilter = document.getElementById('filter-category')?.value || 'all';

  let filtered = transactions;
  if (typeFilter !== 'all') filtered = filtered.filter(t => t.type === typeFilter);
  if (catFilter !== 'all') filtered = filtered.filter(t => t.category === catFilter);

  renderTxList(el, filtered, true);
}

function renderTxList(el, txs, showDelete) {
  if (txs.length === 0) {
    el.innerHTML = '<div class="empty-state">// NO TRANSACTIONS</div>';
    return;
  }

  el.innerHTML = txs.map(t => `
    <div class="tx-item">
      <div class="tx-dot ${t.type}"></div>
      <div class="tx-info">
        <div class="tx-desc">${escHtml(t.desc)}</div>
        <div class="tx-meta">${t.category} · ${formatDate(t.date)}</div>
      </div>
      <span class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}$${t.amount.toFixed(2)}</span>
      ${showDelete ? `<button class="tx-delete" onclick="deleteTransaction(${t.id})" title="Delete">×</button>` : ''}
    </div>
  `).join('');
}

// ── Filter Categories ──────────────────────────────────────
function populateFilterCategories() {
  const sel = document.getElementById('filter-category');
  if (!sel) return;
  const cats = [...new Set(transactions.map(t => t.category))].sort();
  const current = sel.value;
  sel.innerHTML = '<option value="all">All Categories</option>' +
    cats.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
}

// ── Helpers ────────────────────────────────────────────────
function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
