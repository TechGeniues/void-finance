let txs = JSON.parse(localStorage.getItem('void_txs') || '[]');
let budgets = JSON.parse(localStorage.getItem('void_budgets') || '{}');
let txType = 'expense';

const fmt = n => '$' + Math.abs(n).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2});

document.addEventListener('DOMContentLoaded', () => {
  const d = document.getElementById('today-date');
  if(d) d.textContent = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).toUpperCase();
  const td = document.getElementById('tx-date');
  if(td) td.value = new Date().toISOString().split('T')[0];
  renderAll();
  fillCatFilter();
});

function go(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const p = document.getElementById(id);
  if(p) p.classList.add('active');
  if(btn) btn.classList.add('active');
  renderAll();
}

function setTxType(type, btn) {
  txType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function addTx(e) {
  e.preventDefault();
  const desc = document.getElementById('tx-desc').value.trim();
  const amt = parseFloat(document.getElementById('tx-amt').value);
  const cat = document.getElementById('tx-cat').value;
  const date = document.getElementById('tx-date').value;
  if(!desc || !amt || !date) return;
  txs.unshift({id:Date.now(), type:txType, desc, amount:amt, category:cat, date});
  persist();
  renderAll();
  fillCatFilter();
  e.target.reset();
  document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
  const fb = document.getElementById('tx-feedback');
  if(fb){
    fb.className='feedback ok';
    fb.textContent = '✓ Transaction added';
    setTimeout(()=>{fb.className='feedback'},2000);
  }
}

function deleteTx(id) {
  txs = txs.filter(t => t.id !== id);
  persist();
  renderAll();
}

function saveBudget(e) {
  e.preventDefault();
  const cat = document.getElementById('b-cat').value;
  const amt = parseFloat(document.getElementById('b-amt').value);
  if(!cat || !amt) return;
  budgets[cat] = amt;
  persist();
  renderAll();
  e.target.reset();
}

function deleteBudget(cat) {
  delete budgets[cat];
  persist();
  renderAll();
}

function persist() {
  localStorage.setItem('void_txs', JSON.stringify(txs));
  localStorage.setItem('void_budgets', JSON.stringify(budgets));
}

function monthTxs() {
  const now = new Date();
  return txs.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

function stats() {
  const mt = monthTxs();
  const income = mt.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense = mt.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const allIn = txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const allEx = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const savings = income > 0 ? Math.round(((income-expense)/income)*100) : 0;
  return {income, expense, balance: allIn-allEx, savings, mt};
}

function catTotals(type='expense') {
  const mt = monthTxs().filter(t=>t.type===type);
  const tot = {};
  mt.forEach(t => { tot[t.category] = (tot[t.category]||0)+t.amount; });
  return Object.entries(tot).sort((a,b)=>b[1]-a[1]);
}

function renderAll() {
  renderKPIs();
  renderCatBars();
  renderRecent();
  renderBudgetBars();
  renderBudgetList();
  renderTxPage();
  renderAddGlance();
}

function renderKPIs() {
  const {income,expense,balance,savings,mt} = stats();
  setText('kpi-balance', (balance<0?'-':'')+fmt(balance));
  const el = document.getElementById('kpi-balance');
  if(el) el.className = 'kpi-val' + (balance < 0 ? ' red' : '');
  setText('kpi-income', fmt(income));
  setText('kpi-expense', fmt(expense));
  setText('kpi-savings', savings+'%');
  setText('kpi-bal-sub', txs.length+' total transactions');
  setText('kpi-inc-sub', mt.filter(t=>t.type==='income').length+' entries');
  setText('kpi-exp-sub', mt.filter(t=>t.type==='expense').length+' entries');
}

function setText(id, v) { const e=document.getElementById(id); if(e) e.textContent=v; }

function renderCatBars() {
  const el = document.getElementById('cat-bars');
  if(!el) return;
  const cats = catTotals('expense');
  if(!cats.length){el.innerHTML='<div class="empty">// NO EXPENSE DATA YET</div>';return;}
  const max = cats[0][1];
  el.innerHTML = cats.map(([cat,amt])=>`
    <div class="bar-row">
      <div class="bar-meta">
        <span class="bar-name">${cat}</span>
        <span class="bar-amt">${fmt(amt)}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${(amt/max*100).toFixed(1)}%"></div></div>
    </div>
  `).join('');
}

function renderRecent() {
  const el = document.getElementById('recent-list');
  if(!el) return;
  renderTxList(el, txs.slice(0,7), false);
}

function renderBudgetBars() {
  const el = document.getElementById('budget-bars');
  if(!el) return;
  const entries = Object.entries(budgets);
  if(!entries.length){el.innerHTML='<div class="empty">// SET BUDGETS TO SEE HEALTH</div>';return;}
  const spent = {};
  monthTxs().filter(t=>t.type==='expense').forEach(t=>{ spent[t.category]=(spent[t.category]||0)+t.amount; });
  el.innerHTML = entries.map(([cat,limit])=>{
    const s = spent[cat]||0;
    const pct = Math.min((s/limit)*100,100);
    const cls = pct>=100?'over':pct>=80?'warn':'ok';
    return `
      <div class="bh-card">
        <div class="bh-top">
          <span class="bh-cat">${cat}</span>
          <span class="bh-pct ${cls}">${Math.round(pct)}%</span>
        </div>
        <div class="bh-track"><div class="bh-bar ${cls}" style="width:${pct.toFixed(1)}%"></div></div>
        <div class="bh-nums">${fmt(s)} of ${fmt(limit)}</div>
      </div>
    `;
  }).join('');
}

function renderBudgetList() {
  const el = document.getElementById('b-list');
  if(!el) return;
  const entries = Object.entries(budgets);
  if(!entries.length){el.innerHTML='<div class="empty">// NO BUDGETS SET</div>';return;}
  el.innerHTML = entries.map(([cat,amt])=>`
    <div class="b-item">
      <span>${cat}</span>
      <span>${fmt(amt)}/mo</span>
      <button class="b-item-del" onclick="deleteBudget('${cat}')">×</button>
    </div>
  `).join('');
}

function renderTxPage() {
  const el = document.getElementById('all-tx');
  if(!el) return;
  const tf = document.getElementById('f-type')?.value||'all';
  const cf = document.getElementById('f-cat')?.value||'all';
  let filtered = txs;
  if(tf!=='all') filtered = filtered.filter(t=>t.type===tf);
  if(cf!=='all') filtered = filtered.filter(t=>t.category===cf);
  renderTxList(el, filtered, true);
}

function renderTxList(el, list, showDel) {
  if(!list.length){el.innerHTML='<div class="empty">// NO TRANSACTIONS</div>';return;}
  el.innerHTML = list.map(t=>`
    <div class="tx-item">
      <div class="tx-dot ${t.type}"></div>
      <div class="tx-info">
        <div class="tx-desc">${esc(t.desc)}</div>
        <div class="tx-meta">${t.category} · ${fmtDate(t.date)}</div>
      </div>
      <div class="tx-right">
        <span class="tx-amt ${t.type}">${t.type==='income'?'+':'-'}${fmt(t.amount)}</span>
        ${showDel?`<button class="tx-del" onclick="deleteTx(${t.id})" title="Delete">×</button>`:''}
      </div>
    </div>
  `).join('');
}

function renderAddGlance() {
  const el = document.getElementById('add-glance');
  if(!el) return;
  const {income,expense,balance,savings} = stats();
  el.innerHTML = `
    <div class="glance-row"><span class="glance-lbl">Income this month</span><span class="glance-val green">${fmt(income)}</span></div>
    <div class="glance-row"><span class="glance-lbl">Expenses this month</span><span class="glance-val red">${fmt(expense)}</span></div>
    <div class="glance-row"><span class="glance-lbl">Net this month</span><span class="glance-val ${income-expense<0?'red':'green'}">${income-expense<0?'-':''}${fmt(income-expense)}</span></div>
    <div class="glance-row"><span class="glance-lbl">Total balance</span><span class="glance-val ${balance<0?'red':''}">${balance<0?'-':''}${fmt(balance)}</span></div>
    <div class="glance-row"><span class="glance-lbl">Savings rate</span><span class="glance-val">${savings}%</span></div>
    <div class="glance-row"><span class="glance-lbl">Total transactions</span><span class="glance-val">${txs.length}</span></div>
  `;
}

function fillCatFilter() {
  const sel = document.getElementById('f-cat');
  if(!sel) return;
  const cats = [...new Set(txs.map(t=>t.category))].sort();
  const cur = sel.value;
  sel.innerHTML = '<option value="all">All categories</option>' +
    cats.map(c=>`<option value="${c}"${c===cur?' selected':''}>${c}</option>`).join('');
}

function fmtDate(s) {
  return new Date(s+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
