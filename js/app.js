/* app.js
   UI + page controllers (vanilla JS)
   - Common components: toast, modal, table rendering, CSV export
   - Per-page init based on body[data-page]
*/

(function(){
  'use strict';

  // ---------- Common utilities ----------

  const $ = (sel, root=document)=>root.querySelector(sel);
  const $$ = (sel, root=document)=>Array.from(root.querySelectorAll(sel));

  function escapeHtml(str){
    return String(str ?? '').replace(/[&<>"']/g, (c)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function parseMoney(val){
    const n = Number(val);
    if(!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }

  function formatMoney(amount){
    const state = CBTStorage.getState();
    const currency = state.settings?.currency || 'GHS';
    const locale = state.settings?.currencyLocale || 'en-GH';
    try{
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(amount || 0));
    }catch{
      return `${currency} ${Number(amount || 0).toFixed(2)}`;
    }
  }

  function todayISO(){
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60 * 1000;
    const local = new Date(d.getTime() - tzOffset);
    return local.toISOString().slice(0,10);
  }

  function dateToMs(iso){
    if(!iso) return 0;
    return new Date(iso + 'T00:00:00').getTime();
  }

  function startOfWeekISO(){
    const d = new Date();
    const day = d.getDay(); // 0 Sun
    const diff = (day === 0 ? -6 : 1 - day); // Monday start
    d.setDate(d.getDate() + diff);
    const tzOffset = d.getTimezoneOffset() * 60 * 1000;
    const local = new Date(d.getTime() - tzOffset);
    return local.toISOString().slice(0,10);
  }

  function startOfMonthISO(){
    const d = new Date();
    d.setDate(1);
    const tzOffset = d.getTimezoneOffset() * 60 * 1000;
    const local = new Date(d.getTime() - tzOffset);
    return local.toISOString().slice(0,10);
  }

  function endOfMonthISO(){
    const d = new Date();
    d.setMonth(d.getMonth()+1, 0);
    const tzOffset = d.getTimezoneOffset() * 60 * 1000;
    const local = new Date(d.getTime() - tzOffset);
    return local.toISOString().slice(0,10);
  }

  function withinRange(recDateISO, fromISO, toISO){
    const t = dateToMs(recDateISO);
    const from = fromISO ? dateToMs(fromISO) : -Infinity;
    const to = toISO ? dateToMs(toISO) : Infinity;
    return t >= from && t <= to;
  }

  function monthKeyFromISO(iso){
    if(!iso) return '';
    return iso.slice(0,7); // YYYY-MM
  }

  function downloadText(filename, text){
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function toCsv(rows){
    const esc = (v)=>{
      const s = String(v ?? '');
      if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    };
    return rows.map(r=>r.map(esc).join(',')).join('\n');
  }

  // ---------- UI components ----------

  function toast(title, msg){
    const root = $('#toastRoot');
    if(!root) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="title">${escapeHtml(title)}</div><div class="msg">${escapeHtml(msg)}</div>`;
    root.appendChild(el);
    setTimeout(()=>{ el.style.opacity = '0'; el.style.transition = 'opacity .25s ease'; }, 3200);
    setTimeout(()=>{ el.remove(); }, 3600);
  }

  function setHelp(name, message){
    const el = document.querySelector(`[data-help="${name}"]`);
    if(el) el.textContent = message || '';
  }

  function clearAllHelps(form){
    $$('[data-help]', form || document).forEach(el=>el.textContent='');
  }

  function confirmModal({ title, message, confirmText='Confirm', danger=false }){
    return new Promise((resolve)=>{
      const root = $('#modalRoot');
      if(!root){ resolve(false); return; }

      root.classList.add('open');
      root.setAttribute('aria-hidden','false');
      root.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
          <h3>${escapeHtml(title)}</h3>
          <div class="muted">${escapeHtml(message)}</div>
          <div class="hr"></div>
          <div class="row end">
            <button class="btn" data-action="cancel" type="button">Cancel</button>
            <button class="btn ${danger ? 'danger' : 'primary'}" data-action="ok" type="button">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      `;

      const close = (val)=>{
        root.classList.remove('open');
        root.setAttribute('aria-hidden','true');
        root.innerHTML = '';
        resolve(val);
      };

      root.addEventListener('click', (e)=>{
        if(e.target === root) close(false);
      }, { once: true });

      root.querySelector('[data-action="cancel"]').addEventListener('click', ()=>close(false), { once: true });
      root.querySelector('[data-action="ok"]').addEventListener('click', ()=>close(true), { once: true });
    });
  }

  function renderTable(container, columns, rows, rowActions){
    // columns: [{key,label,render?}]
    const th = columns.map(c=>`<th>${escapeHtml(c.label)}</th>`).join('');
    const actionTh = rowActions ? '<th>Actions</th>' : '';

    const body = rows.map(r=>{
      const tds = columns.map(c=>{
        const val = c.render ? c.render(r) : r[c.key];
        return `<td>${val}</td>`;
      }).join('');

      const actions = rowActions ? `
        <td>
          <div class="row">
            <button class="btn" type="button" data-action="edit" data-id="${escapeHtml(r.id)}">Edit</button>
            <button class="btn danger" type="button" data-action="delete" data-id="${escapeHtml(r.id)}">Delete</button>
          </div>
        </td>
      ` : '';

      return `<tr>${tds}${actions}</tr>`;
    }).join('');

    container.innerHTML = `
      <table class="table">
        <thead><tr>${th}${actionTh}</tr></thead>
        <tbody>${body || `<tr><td colspan="${columns.length + (rowActions?1:0)}" class="muted">No records found.</td></tr>`}</tbody>
      </table>
    `;

    if(rowActions){
      container.onclick = (e)=>{
        const btn = e.target.closest('button[data-action]');
        if(!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        rowActions(action, id);
      };
    }
  }

  function applyDarkModeFromSettings(){
    const state = CBTStorage.getState();
    document.body.classList.toggle('dark', !!state.settings?.darkMode);
  }

  function toggleDarkMode(){
    CBTStorage.update((s)=>{
      s.settings.darkMode = !s.settings.darkMode;
      return s;
    });
    applyDarkModeFromSettings();
  }

  function wireShellButtons(){
    const sidebar = $('#sidebar');
    const menuBtn = $('#menuBtn');
    
    if(menuBtn && sidebar){
      // Create backdrop if not exists
      let backdrop = $('.sidebar-backdrop');
      if(!backdrop){
        backdrop = document.createElement('div');
        backdrop.className = 'sidebar-backdrop';
        document.body.appendChild(backdrop);
      }

      const toggle = ()=>{
        const isOpen = sidebar.classList.toggle('open');
        backdrop.classList.toggle('open', isOpen);
      };

      const close = ()=>{
        sidebar.classList.remove('open');
        backdrop.classList.remove('open');
      };

      menuBtn.addEventListener('click', toggle);
      backdrop.addEventListener('click', close);
    }

    const logoutBtn = $('#logoutBtn');
    if(logoutBtn){
      logoutBtn.addEventListener('click', async ()=>{
        const ok = await confirmModal({ title:'Logout', message:'Are you sure you want to logout?', confirmText:'Logout' });
        if(!ok) return;
        CBTAuth.logout();
        window.location.replace('login.html');
      });
    }

    const darkBtn = $('#darkModeToggle');
    if(darkBtn){
      darkBtn.addEventListener('click', ()=>{
        toggleDarkMode();
        toast('Theme', document.body.classList.contains('dark') ? 'Dark mode enabled.' : 'Dark mode disabled.');
      });
    }
  }

  // ---------- Data helpers ----------

  function getIncomeCategories(){
    return CBTStorage.getState().categories?.income || CBTStorage.DEFAULTS.categories.income;
  }

  function getExpenseCategories(){
    return CBTStorage.getState().categories?.expense || CBTStorage.DEFAULTS.categories.expense;
  }

  function sumBy(arr, pred){
    return arr.reduce((acc, r)=> acc + (pred(r) || 0), 0);
  }

  function groupSum(arr, keyFn, amountFn){
    const out = new Map();
    for(const r of arr){
      const k = keyFn(r);
      const v = amountFn(r);
      out.set(k, (out.get(k) || 0) + v);
    }
    return out;
  }

  function getBalances(){
    const state = CBTStorage.getState();
    let cash = Number(state.settings?.openingCash || 0);
    let bank = Number(state.settings?.openingBank || 0);

    // Incomes
    for(const r of (state.incomes || [])){
      const amt = Number(r.amount || 0);
      if(r.method === 'Cash') cash += amt;
      else bank += amt; // Mobile Money, Bank Transfer -> Bank
    }

    // Expenses
    for(const r of (state.expenses || [])){
      const amt = Number(r.amount || 0);
      if(r.method === 'Cash') cash -= amt;
      else bank -= amt;
    }

    // Payouts
    for(const r of (state.payouts || [])){
      const amt = Number(r.amount || 0);
      if(r.method === 'Cash') cash -= amt;
      else bank -= amt;
    }

    // Transfers
    for(const r of (state.transfers || [])){
      const amt = Number(r.amount || 0);
      if(r.type === 'deposit'){
        // Cash -> Bank
        cash -= amt;
        bank += amt;
      } else if(r.type === 'withdrawal'){
        // Bank -> Cash
        bank -= amt;
        cash += amt;
      }
    }

    return { cash, bank };
  }

  // ---------- Page controllers ----------

  async function initIndex(){
    await CBTAuth.ensureDefaultAdmin();
    applyDarkModeFromSettings();

    const user = CBTAuth.getCurrentUser();
    if(user){
      window.location.replace('dashboard.html');
    }else{
      window.location.replace('login.html');
    }
  }

  async function initLogin(){
    await CBTAuth.ensureDefaultAdmin();
    applyDarkModeFromSettings();

    const user = CBTAuth.getCurrentUser();
    if(user){
      window.location.replace('dashboard.html');
      return;
    }

    const form = $('#loginForm');
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      clearAllHelps(form);

      const username = $('#username').value.trim();
      const password = $('#password').value;

      let ok = true;
      if(!username){ setHelp('username','Username is required.'); ok = false; }
      if(!password){ setHelp('password','Password is required.'); ok = false; }
      if(!ok) return;

      try{
        await CBTAuth.login(username, password);
        toast('Welcome', 'Login successful.');
        window.location.replace('dashboard.html');
      }catch(err){
        toast('Login failed', err.message || 'Unable to login.');
      }
    });
  }

  function rangePreset(preset){
    if(preset === 'today'){
      const t = todayISO();
      return { from: t, to: t };
    }
    if(preset === 'week'){
      return { from: startOfWeekISO(), to: todayISO() };
    }
    // default: month
    return { from: startOfMonthISO(), to: endOfMonthISO() };
  }

  function initDashboard(){
    const user = CBTAuth.requireAuth();
    if(!user) return;
    CBTAuth.startActivityWatch();
    applyDarkModeFromSettings();
    wireShellButtons();

    // Show balances
    const balances = getBalances();
    const grid = $('.grid.cards-3');
    if(grid){
      let balanceRow = $('#balanceRow');
      if(!balanceRow){
        balanceRow = document.createElement('section');
        balanceRow.id = 'balanceRow';
        balanceRow.className = 'grid cards-2';
        balanceRow.style.marginBottom = '14px';
        balanceRow.innerHTML = `
          <div class="card" style="background:var(--surface-2)">
            <div class="card-label">Cash at Hand</div>
            <div class="card-value" id="cashBalance">…</div>
          </div>
          <div class="card" style="background:var(--surface-2)">
            <div class="card-label">Cash at Bank</div>
            <div class="card-value" id="bankBalance">…</div>
          </div>
        `;
        grid.before(balanceRow);
      }
      $('#cashBalance').textContent = formatMoney(balances.cash);
      $('#bankBalance').textContent = formatMoney(balances.bank);
    }

    let activeRange = rangePreset('month');
    const customWrap = $('#customRange');

    const setSegActive = (val)=>{
      $$('button.seg').forEach(b=> b.classList.toggle('active', b.dataset.range === val));
    };

    $$('.segmented .seg').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const r = btn.dataset.range;
        setSegActive(r);
        if(r === 'custom'){
          customWrap.hidden = false;
          return;
        }
        customWrap.hidden = true;
        activeRange = rangePreset(r);
        render();
      });
    });

    $('#applyCustomRange').addEventListener('click', ()=>{
      const from = $('#fromDate').value;
      const to = $('#toDate').value;
      activeRange = { from: from || null, to: to || null };
      render();
    });

    let chart = null;

    function render(){
      const state = CBTStorage.getState();
      const incomes = (state.incomes || []).filter(r=>withinRange(r.date, activeRange.from, activeRange.to));
      const expenses = (state.expenses || []).filter(r=>withinRange(r.date, activeRange.from, activeRange.to));
      const payouts = (state.payouts || []).filter(r=>withinRange(r.date, activeRange.from, activeRange.to));

      const totalIncome = sumBy(incomes, r=>Number(r.amount)||0);
      const totalExpense = sumBy(expenses, r=>Number(r.amount)||0);
      const net = totalIncome - totalExpense;

      $('#totalIncome').textContent = formatMoney(totalIncome);
      $('#totalExpenses').textContent = formatMoney(totalExpense);
      $('#netBalance').textContent = formatMoney(net);
      $('#incomeCount').textContent = `${incomes.length} income record(s)`;
      $('#expenseCount').textContent = `${expenses.length} expense record(s)`;
      $('#netHint').innerHTML = net < 0 ? `<span class="badge negative">Deficit</span>` : `<span class="badge positive">Surplus</span>`;

      // Breakdown by income category
      const byCat = groupSum(incomes, r=>r.category || 'Uncategorized', r=>Number(r.amount)||0);
      const labels = Array.from(byCat.keys());
      const values = labels.map(l=> byCat.get(l));

      const breakdown = $('#categoryBreakdown');
      breakdown.innerHTML = labels.length ? labels.map((l)=>{
        return `
          <div class="list-row">
            <div>${escapeHtml(l)}</div>
            <div><strong>${escapeHtml(formatMoney(byCat.get(l)))}</strong></div>
          </div>
        `;
      }).join('') : `<div class="muted">No income records in this range.</div>`;

      if(window.Chart){
        const ctx = $('#categoryChart');
        const data = {
          labels,
          datasets: [{
            label: 'Income',
            data: values,
            borderWidth: 1
          }]
        };
        const options = {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { callback: (v)=> v } } }
        };
        if(chart){
          chart.data = data;
          chart.options = options;
          chart.update();
        }else{
          chart = new Chart(ctx, { type:'bar', data, options });
        }
      }

      // Recent transactions (income, expense, payouts)
      const tx = [];
      incomes.forEach(r=>tx.push({ type:'Income', date:r.date, ref:r.id, who:r.recordedBy || '', category:r.category || '', amount:+r.amount, method:r.method || '' }));
      expenses.forEach(r=>tx.push({ type:'Expense', date:r.date, ref:r.id, who:r.paidTo || '', category:r.category || '', amount:-Math.abs(+r.amount), method:r.method || '' }));
      payouts.forEach(r=>tx.push({ type:'Payout', date:r.date, ref:r.id, who:r.leaderName || '', category:r.role || '', amount:-Math.abs(+r.amount), method:r.method || '' }));

      tx.sort((a,b)=> (b.date.localeCompare(a.date)) || (b.ref.localeCompare(a.ref)));
      const recent = tx.slice(0,10);

      const container = $('#recentTransactions');
      renderTable(container,
        [
          { key:'date', label:'Date', render:(r)=>escapeHtml(r.date) },
          { key:'type', label:'Type', render:(r)=>`<span class="badge">${escapeHtml(r.type)}</span>` },
          { key:'category', label:'Category/Role', render:(r)=>escapeHtml(r.category) },
          { key:'who', label:'Paid/Recorded To', render:(r)=>escapeHtml(r.who) },
          { key:'amount', label:'Amount', render:(r)=>{
              const cls = r.amount < 0 ? 'negative' : 'positive';
              return `<span class="badge ${cls}">${escapeHtml(formatMoney(r.amount))}</span>`;
            }
          },
          { key:'method', label:'Method', render:(r)=>escapeHtml(r.method) }
        ],
        recent,
        null
      );
    }

    render();
  }

  function initBanking(){
    const user = CBTAuth.requireAuth();
    if(!user) return;
    CBTAuth.startActivityWatch();
    applyDarkModeFromSettings();
    wireShellButtons();

    $('#transferDate').value = todayISO();

    function renderBalances(){
      const bal = getBalances();
      $('#cashBalance').textContent = formatMoney(bal.cash);
      $('#bankBalance').textContent = formatMoney(bal.bank);
    }

    function renderTransfers(){
      const state = CBTStorage.getState();
      const rows = (state.transfers || []).sort((a,b)=>b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

      renderTable($('#transferTable'),
        [
          { key:'date', label:'Date', render:(r)=>escapeHtml(r.date) },
          { key:'type', label:'Type', render:(r)=> r.type === 'deposit' ? 'Cash to Bank' : 'Bank to Cash' },
          { key:'amount', label:'Amount', render:(r)=>`<strong>${escapeHtml(formatMoney(r.amount))}</strong>` },
          { key:'notes', label:'Notes', render:(r)=>escapeHtml(r.notes||'') },
          { key:'recordedBy', label:'By', render:(r)=>escapeHtml(r.recordedBy) }
        ],
        rows,
        async (action, id)=>{
          if(action === 'delete'){
            const ok = await confirmModal({ title:'Delete Transfer', message:'Are you sure? This will revert the balance change.', confirmText:'Delete', danger:true });
            if(!ok) return;
            CBTStorage.update((s)=>{ s.transfers = s.transfers.filter(t=>t.id!==id); return s; });
            CBTStorage.pushAudit('transfer_delete', { id }, user.username);
            renderTransfers();
            renderBalances();
            toast('Deleted', 'Transfer record removed.');
          }
        }
      );
    }

    $('#bankingForm').addEventListener('submit', (e)=>{
      e.preventDefault();
      clearAllHelps($('#bankingForm'));

      const type = $('#transferType').value;
      const amount = parseMoney($('#transferAmount').value);
      const date = $('#transferDate').value;
      const notes = $('#transferNotes').value.trim();

      let ok = true;
      if(!type){ setHelp('transferType','Select transfer type.'); ok=false; }
      if(amount <= 0){ setHelp('transferAmount','Amount must be greater than 0.'); ok=false; }
      if(!date){ setHelp('transferDate','Date is required.'); ok=false; }

      if(!ok) return;

      const record = {
        id: CBTStorage.makeId('TRF'),
        date,
        type,
        amount,
        notes,
        recordedBy: user.username,
        createdAt: new Date().toISOString()
      };

      CBTStorage.update((s)=>{
        s.transfers = s.transfers || [];
        s.transfers.unshift(record);
        return s;
      });

      CBTStorage.pushAudit('transfer_create', { type, amount }, user.username);
      toast('Success', 'Transfer recorded.');
      $('#bankingForm').reset();
      $('#transferDate').value = todayISO();
      renderTransfers();
      renderBalances();
    });

    renderBalances();
    renderTransfers();
  }

  function initIncome(){
    const user = CBTAuth.requireAuth();
    if(!user) return;
    CBTAuth.startActivityWatch();
    applyDarkModeFromSettings();
    wireShellButtons();

    // Populate categories
    const catSel = $('#incomeCategory');
    const cats = getIncomeCategories();
    catSel.innerHTML = `<option value="">Select…</option>` + cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('');

    const filterSel = $('#incomeFilterCategory');
    filterSel.innerHTML = `<option value="">All categories</option>` + cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('');

    // Default date
    $('#incomeDate').value = todayISO();

    let activeRange = rangePreset('month');

    const setRangeUI = (range)=>{
      const wrap = $('#incomeCustomRange');
      wrap.hidden = (range !== 'custom');
      $$('.toolbar .seg').forEach(b=> b.classList.toggle('active', b.dataset.range === range));
    };

    $$('.toolbar .segmented .seg').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const r = btn.dataset.range;
        setRangeUI(r);
        if(r === 'custom') return;
        activeRange = rangePreset(r);
        render();
      });
    });

    $('#incomeApplyRange').addEventListener('click', ()=>{
      activeRange = { from: $('#incomeFrom').value || null, to: $('#incomeTo').value || null };
      render();
    });

    function getFiltered(){
      const state = CBTStorage.getState();
      const q = ($('#incomeSearch').value || '').toLowerCase();
      const cat = $('#incomeFilterCategory').value;

      return (state.incomes || [])
        .filter(r=>withinRange(r.date, activeRange.from, activeRange.to))
        .filter(r=>!cat || r.category === cat)
        .filter(r=>{
          if(!q) return true;
          const hay = `${r.id} ${r.date} ${r.serviceType} ${r.category} ${r.method} ${r.notes||''} ${r.recordedBy||''}`.toLowerCase();
          return hay.includes(q);
        })
        .sort((a,b)=> (b.date.localeCompare(a.date)) || (b.id.localeCompare(a.id)));
    }

    function renderTotals(rows){
      const totals = groupSum(rows, r=>r.category || 'Uncategorized', r=>Number(r.amount)||0);
      const keys = Array.from(totals.keys()).sort();

      $('#incomeTotals').innerHTML = keys.length ? keys.map(k=>{
        return `
          <div class="list-row">
            <div>${escapeHtml(k)}</div>
            <div><strong>${escapeHtml(formatMoney(totals.get(k)))}</strong></div>
          </div>
        `;
      }).join('') : `<div class="muted">No income records.</div>`;
    }

    function render(){
      const rows = getFiltered();
      renderTotals(rows);

      const container = $('#incomeTable');
      renderTable(container,
        [
          { key:'date', label:'Date', render:(r)=>escapeHtml(r.date) },
          { key:'serviceType', label:'Service', render:(r)=>escapeHtml(r.serviceType) },
          { key:'category', label:'Category', render:(r)=>escapeHtml(r.category) },
          { key:'amount', label:'Amount', render:(r)=>`<strong>${escapeHtml(formatMoney(r.amount))}</strong>` },
          { key:'method', label:'Method', render:(r)=>escapeHtml(r.method) },
          { key:'recordedBy', label:'Recorded by', render:(r)=>escapeHtml(r.recordedBy) },
          { key:'notes', label:'Notes', render:(r)=>escapeHtml(r.notes||'') }
        ],
        rows,
        async (action, id)=>{
          if(action === 'edit') return startEdit(id);
          if(action === 'delete') return deleteIncome(id);
        }
      );
    }

    function resetForm(){
      $('#incomeId').value = '';
      $('#incomeForm').reset();
      $('#incomeDate').value = todayISO();
      $('#incomeSaveBtn').textContent = 'Save Income';
      $('#incomeCancelEdit').hidden = true;
      clearAllHelps($('#incomeForm'));
    }

    function startEdit(id){
      const state = CBTStorage.getState();
      const rec = (state.incomes || []).find(r=>r.id === id);
      if(!rec) return;
      $('#incomeId').value = rec.id;
      $('#incomeDate').value = rec.date;
      $('#serviceType').value = rec.serviceType;
      $('#incomeCategory').value = rec.category;
      $('#incomeAmount').value = rec.amount;
      $('#incomeMethod').value = rec.method;
      $('#incomeNotes').value = rec.notes || '';
      $('#incomeRecordedBy').value = rec.recordedBy || '';
      $('#incomeSaveBtn').textContent = 'Update Income';
      $('#incomeCancelEdit').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function deleteIncome(id){
      const ok = await confirmModal({ title:'Delete income record', message:'This will permanently remove the selected income entry.', confirmText:'Delete', danger:true });
      if(!ok) return;

      CBTStorage.update((s)=>{
        s.incomes = (s.incomes || []).filter(r=>r.id !== id);
        return s;
      });
      CBTStorage.pushAudit('income_delete', { id }, user.username);
      toast('Deleted', 'Income record removed.');
      render();
    }

    $('#incomeCancelEdit').addEventListener('click', resetForm);

    $('#incomeForm').addEventListener('submit', (e)=>{
      e.preventDefault();
      clearAllHelps($('#incomeForm'));

      const id = $('#incomeId').value.trim();
      const date = $('#incomeDate').value;
      const serviceType = $('#serviceType').value;
      const category = $('#incomeCategory').value;
      const amount = parseMoney($('#incomeAmount').value);
      const method = $('#incomeMethod').value;
      const notes = $('#incomeNotes').value.trim();
      const recordedBy = $('#incomeRecordedBy').value.trim();

      let ok = true;
      if(!date){ setHelp('incomeDate','Date is required.'); ok=false; }
      if(!serviceType){ setHelp('serviceType','Select service type.'); ok=false; }
      if(!category){ setHelp('incomeCategory','Select income category.'); ok=false; }
      if(amount <= 0){ setHelp('incomeAmount','Amount must be greater than 0.'); ok=false; }
      if(!method){ setHelp('incomeMethod','Select payment method.'); ok=false; }
      if(!recordedBy){ setHelp('incomeRecordedBy','Recorded by is required.'); ok=false; }
      if(!ok) return;

      const record = {
        id: id || CBTStorage.makeId('INC'),
        date,
        serviceType,
        category,
        amount,
        method,
        notes,
        recordedBy,
        updatedAt: new Date().toISOString(),
        createdAt: id ? undefined : new Date().toISOString()
      };

      CBTStorage.update((s)=>{
        s.incomes = s.incomes || [];
        const idx = s.incomes.findIndex(r=>r.id === record.id);
        if(idx >= 0) s.incomes[idx] = { ...s.incomes[idx], ...record };
        else s.incomes.unshift(record);
        return s;
      });

      CBTStorage.pushAudit(id ? 'income_update' : 'income_create', { id: record.id, amount: record.amount, category: record.category }, user.username);
      toast('Saved', id ? 'Income updated.' : 'Income recorded.');
      resetForm();
      render();
    });

    const rerender = ()=>render();
    $('#incomeSearch').addEventListener('input', rerender);
    $('#incomeFilterCategory').addEventListener('change', rerender);

    $('#incomeExportCsv').addEventListener('click', ()=>{
      const rows = getFiltered();
      const csv = toCsv([
        ['ID','Date','Service Type','Category','Amount','Payment Method','Notes','Recorded By'],
        ...rows.map(r=>[r.id,r.date,r.serviceType,r.category,r.amount,r.method,r.notes||'',r.recordedBy||''])
      ]);
      downloadText(`cbt-income-${todayISO()}.csv`, csv);
      toast('Exported', 'Income CSV downloaded.');
    });

    setRangeUI('month');
    render();
  }

  async function fileToBase64(file){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=>resolve(String(reader.result));
      reader.onerror = ()=>reject(new Error('Unable to read file.'));
      reader.readAsDataURL(file);
    });
  }

  function initExpenses(){
    const user = CBTAuth.requireAuth();
    if(!user) return;
    CBTAuth.startActivityWatch();
    applyDarkModeFromSettings();
    wireShellButtons();

    const cats = getExpenseCategories();
    $('#expenseCategory').innerHTML = `<option value="">Select…</option>` + cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('');

    const filterSel = $('#expenseFilterCategory');
    filterSel.innerHTML = `<option value="">All categories</option>` + cats.map(c=>`<option>${escapeHtml(c)}</option>`).join('');

    $('#expenseDate').value = todayISO();

    let receiptBase64 = null;

    $('#expenseReceipt').addEventListener('change', async (e)=>{
      const file = e.target.files && e.target.files[0];
      if(!file){
        receiptBase64 = null;
        $('#receiptPreview').hidden = true;
        $('#receiptPreview').innerHTML = '';
        return;
      }
      // Basic size guard (keeps LocalStorage stable)
      if(file.size > 500_000){
        toast('Receipt too large', 'Please use a smaller file (max ~500KB).');
        e.target.value = '';
        return;
      }
      receiptBase64 = await fileToBase64(file);
      const preview = $('#receiptPreview');
      preview.hidden = false;

      if(file.type.startsWith('image/')){
        preview.innerHTML = `<img class="receipt-img" alt="Receipt preview" src="${receiptBase64}" />`;
      }else{
        preview.innerHTML = `<div class="muted">Receipt attached: ${escapeHtml(file.name)}</div>`;
      }
    });

    let activeRange = rangePreset('month');

    const setRangeUI = (range)=>{
      const wrap = $('#expenseCustomRange');
      wrap.hidden = (range !== 'custom');
      $$('.toolbar .seg').forEach(b=> b.classList.toggle('active', b.dataset.range === range));
    };

    $$('.toolbar .segmented .seg').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const r = btn.dataset.range;
        setRangeUI(r);
        if(r === 'custom') return;
        activeRange = rangePreset(r);
        render();
      });
    });

    $('#expenseApplyRange').addEventListener('click', ()=>{
      activeRange = { from: $('#expenseFrom').value || null, to: $('#expenseTo').value || null };
      render();
    });

    function getFiltered(){
      const state = CBTStorage.getState();
      const q = ($('#expenseSearch').value || '').toLowerCase();
      const cat = $('#expenseFilterCategory').value;

      return (state.expenses || [])
        .filter(r=>withinRange(r.date, activeRange.from, activeRange.to))
        .filter(r=>!cat || r.category === cat)
        .filter(r=>{
          if(!q) return true;
          const hay = `${r.id} ${r.date} ${r.category} ${r.paidTo} ${r.method} ${r.description} ${r.approvedBy}`.toLowerCase();
          return hay.includes(q);
        })
        .sort((a,b)=> (b.date.localeCompare(a.date)) || (b.id.localeCompare(a.id)));
    }

    function renderMonthlyTotals(rows){
      const byMonth = groupSum(rows, r=>monthKeyFromISO(r.date), r=>Number(r.amount)||0);
      const keys = Array.from(byMonth.keys()).sort().reverse();
      $('#expenseMonthlyTotals').innerHTML = keys.length ? keys.map(m=>{
        return `
          <div class="list-row">
            <div>${escapeHtml(m)}</div>
            <div><strong>${escapeHtml(formatMoney(byMonth.get(m)))}</strong></div>
          </div>
        `;
      }).join('') : `<div class="muted">No expenses in this range.</div>`;
    }

    function renderBudgetComparison(){
      const state = CBTStorage.getState();
      const monthKey = monthKeyFromISO(todayISO());
      const budget = state.budgets?.[monthKey] || {};

      const expensesThisMonth = (state.expenses || []).filter(r=>monthKeyFromISO(r.date) === monthKey);
      const actualByCat = groupSum(expensesThisMonth, r=>r.category || 'Uncategorized', r=>Number(r.amount)||0);

      const allCats = Array.from(new Set([...getExpenseCategories(), ...Object.keys(budget), ...Array.from(actualByCat.keys())]));
      allCats.sort();

      const rows = allCats.map(cat=>{
        const bud = Number(budget[cat] || 0);
        const act = Number(actualByCat.get(cat) || 0);
        const diff = bud - act;
        const overspend = act > bud && bud > 0;
        return {
          cat,
          bud,
          act,
          diff,
          overspend
        };
      });

      const container = $('#budgetComparison');
      renderTable(container,
        [
          { key:'cat', label:'Category', render:(r)=>escapeHtml(r.cat) },
          { key:'bud', label:'Budget', render:(r)=>escapeHtml(formatMoney(r.bud)) },
          { key:'act', label:'Actual', render:(r)=>escapeHtml(formatMoney(r.act)) },
          { key:'diff', label:'Remaining', render:(r)=>{
              const cls = r.overspend ? 'negative' : 'positive';
              return `<span class="badge ${cls}">${escapeHtml(formatMoney(r.diff))}</span>`;
            }
          }
        ],
        rows,
        null
      );
    }

    function render(){
      const rows = getFiltered();
      renderMonthlyTotals(rows);
      renderBudgetComparison();

      const container = $('#expenseTable');
      renderTable(container,
        [
          { key:'date', label:'Date', render:(r)=>escapeHtml(r.date) },
          { key:'category', label:'Category', render:(r)=>escapeHtml(r.category) },
          { key:'amount', label:'Amount', render:(r)=>`<strong>${escapeHtml(formatMoney(r.amount))}</strong>` },
          { key:'paidTo', label:'Paid To', render:(r)=>escapeHtml(r.paidTo) },
          { key:'method', label:'Method', render:(r)=>escapeHtml(r.method) },
          { key:'approvedBy', label:'Approved By', render:(r)=>escapeHtml(r.approvedBy) },
          { key:'description', label:'Description', render:(r)=>escapeHtml(r.description) },
          { key:'receipt', label:'Receipt', render:(r)=> r.receiptBase64 ? `<a href="${r.receiptBase64}" target="_blank" rel="noopener">View</a>` : '<span class="muted">—</span>' }
        ],
        rows,
        async (action, id)=>{
          if(action === 'edit') return startEdit(id);
          if(action === 'delete') return deleteExpense(id);
        }
      );
    }

    function resetForm(){
      $('#expenseId').value = '';
      $('#expenseForm').reset();
      $('#expenseDate').value = todayISO();
      $('#expenseSaveBtn').textContent = 'Save Expense';
      $('#expenseCancelEdit').hidden = true;
      receiptBase64 = null;
      $('#expenseReceipt').value = '';
      $('#receiptPreview').hidden = true;
      $('#receiptPreview').innerHTML = '';
      clearAllHelps($('#expenseForm'));
    }

    function startEdit(id){
      const state = CBTStorage.getState();
      const rec = (state.expenses || []).find(r=>r.id === id);
      if(!rec) return;

      $('#expenseId').value = rec.id;
      $('#expenseDate').value = rec.date;
      $('#expenseCategory').value = rec.category;
      $('#expenseAmount').value = rec.amount;
      $('#expensePaidTo').value = rec.paidTo;
      $('#expenseMethod').value = rec.method;
      $('#expenseDescription').value = rec.description;
      $('#expenseApprovedBy').value = rec.approvedBy;

      receiptBase64 = rec.receiptBase64 || null;
      if(receiptBase64){
        const preview = $('#receiptPreview');
        preview.hidden = false;
        preview.innerHTML = `<a href="${receiptBase64}" target="_blank" rel="noopener">View existing receipt</a>`;
      }else{
        $('#receiptPreview').hidden = true;
        $('#receiptPreview').innerHTML = '';
      }

      $('#expenseSaveBtn').textContent = 'Update Expense';
      $('#expenseCancelEdit').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function deleteExpense(id){
      const ok = await confirmModal({ title:'Delete expense record', message:'This will permanently remove the selected expense entry.', confirmText:'Delete', danger:true });
      if(!ok) return;

      CBTStorage.update((s)=>{
        s.expenses = (s.expenses || []).filter(r=>r.id !== id);
        return s;
      });
      CBTStorage.pushAudit('expense_delete', { id }, user.username);
      toast('Deleted', 'Expense record removed.');
      render();
    }

    $('#expenseCancelEdit').addEventListener('click', resetForm);

    $('#expenseForm').addEventListener('submit', (e)=>{
      e.preventDefault();
      clearAllHelps($('#expenseForm'));

      const id = $('#expenseId').value.trim();
      const date = $('#expenseDate').value;
      const category = $('#expenseCategory').value;
      const amount = parseMoney($('#expenseAmount').value);
      const paidTo = $('#expensePaidTo').value.trim();
      const method = $('#expenseMethod').value;
      const description = $('#expenseDescription').value.trim();
      const approvedBy = $('#expenseApprovedBy').value.trim();

      let ok = true;
      if(!date){ setHelp('expenseDate','Date is required.'); ok=false; }
      if(!category){ setHelp('expenseCategory','Select expense category.'); ok=false; }
      if(amount <= 0){ setHelp('expenseAmount','Amount must be greater than 0.'); ok=false; }
      if(!paidTo){ setHelp('expensePaidTo','Paid To is required.'); ok=false; }
      if(!method){ setHelp('expenseMethod','Select payment method.'); ok=false; }
      if(!description){ setHelp('expenseDescription','Description is required.'); ok=false; }
      if(!approvedBy){ setHelp('expenseApprovedBy','Approved By is required.'); ok=false; }
      if(!ok) return;

      const record = {
        id: id || CBTStorage.makeId('EXP'),
        date,
        category,
        amount,
        paidTo,
        method,
        description,
        approvedBy,
        receiptBase64: receiptBase64,
        updatedAt: new Date().toISOString(),
        createdAt: id ? undefined : new Date().toISOString()
      };

      CBTStorage.update((s)=>{
        s.expenses = s.expenses || [];
        const idx = s.expenses.findIndex(r=>r.id === record.id);
        if(idx >= 0) s.expenses[idx] = { ...s.expenses[idx], ...record };
        else s.expenses.unshift(record);
        return s;
      });

      CBTStorage.pushAudit(id ? 'expense_update' : 'expense_create', { id: record.id, amount: record.amount, category: record.category }, user.username);
      toast('Saved', id ? 'Expense updated.' : 'Expense recorded.');
      resetForm();
      render();
    });

    const rerender = ()=>render();
    $('#expenseSearch').addEventListener('input', rerender);
    $('#expenseFilterCategory').addEventListener('change', rerender);

    $('#expenseExportCsv').addEventListener('click', ()=>{
      const rows = getFiltered();
      const csv = toCsv([
        ['ID','Date','Category','Amount','Paid To','Payment Method','Description','Approved By','Receipt Attached'],
        ...rows.map(r=>[r.id,r.date,r.category,r.amount,r.paidTo,r.method,r.description,r.approvedBy,r.receiptBase64?'Yes':'No'])
      ]);
      downloadText(`cbt-expenses-${todayISO()}.csv`, csv);
      toast('Exported', 'Expenses CSV downloaded.');
    });

    setRangeUI('month');
    render();
  }

  function initPayouts(){
    const user = CBTAuth.requireAuth();
    if(!user) return;
    CBTAuth.startActivityWatch();
    applyDarkModeFromSettings();
    wireShellButtons();

    $('#payoutDate').value = todayISO();

    let activeRange = rangePreset('month');

    const setRangeUI = (range)=>{
      const wrap = $('#payoutCustomRange');
      wrap.hidden = (range !== 'custom');
      $$('.toolbar .seg').forEach(b=> b.classList.toggle('active', b.dataset.range === range));
    };

    $$('.toolbar .segmented .seg').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const r = btn.dataset.range;
        setRangeUI(r);
        if(r === 'custom') return;
        activeRange = rangePreset(r);
        render();
      });
    });

    $('#payoutApplyRange').addEventListener('click', ()=>{
      activeRange = { from: $('#payoutFrom').value || null, to: $('#payoutTo').value || null };
      render();
    });

    function getFiltered(){
      const state = CBTStorage.getState();
      const q = ($('#payoutSearch').value || '').toLowerCase();

      return (state.payouts || [])
        .filter(r=>withinRange(r.date, activeRange.from, activeRange.to))
        .filter(r=>{
          if(!q) return true;
          const hay = `${r.id} ${r.date} ${r.leaderName} ${r.role} ${r.reason} ${r.method} ${r.approvedBy}`.toLowerCase();
          return hay.includes(q);
        })
        .sort((a,b)=> (b.date.localeCompare(a.date)) || (b.id.localeCompare(a.id)));
    }

    function renderMonthlySummary(){
      const state = CBTStorage.getState();
      const monthKey = monthKeyFromISO(todayISO());
      const rows = (state.payouts || []).filter(r=>monthKeyFromISO(r.date) === monthKey);

      const sums = new Map();
      for(const r of rows){
        const k = `${r.leaderName}||${r.role}`;
        sums.set(k, (sums.get(k) || 0) + Number(r.amount || 0));
      }

      const out = Array.from(sums.entries()).map(([k,total])=>{
        const [leaderName, role] = k.split('||');
        return { leaderName, role, total };
      }).sort((a,b)=>b.total-a.total);

      renderTable($('#payoutMonthlySummary'),
        [
          { key:'leaderName', label:'Leader', render:(r)=>escapeHtml(r.leaderName) },
          { key:'role', label:'Role', render:(r)=>escapeHtml(r.role) },
          { key:'total', label:'Total (this month)', render:(r)=>`<strong>${escapeHtml(formatMoney(r.total))}</strong>` }
        ],
        out,
        null
      );
    }

    function render(){
      renderMonthlySummary();
      const rows = getFiltered();

      renderTable($('#payoutTable'),
        [
          { key:'date', label:'Date', render:(r)=>escapeHtml(r.date) },
          { key:'leaderName', label:'Leader', render:(r)=>escapeHtml(r.leaderName) },
          { key:'role', label:'Role', render:(r)=>escapeHtml(r.role) },
          { key:'amount', label:'Amount', render:(r)=>`<strong>${escapeHtml(formatMoney(r.amount))}</strong>` },
          { key:'method', label:'Method', render:(r)=>escapeHtml(r.method) },
          { key:'approvedBy', label:'Approved By', render:(r)=>escapeHtml(r.approvedBy) },
          { key:'reason', label:'Reason', render:(r)=>escapeHtml(r.reason) }
        ],
        rows,
        async (action, id)=>{
          if(action === 'edit') return startEdit(id);
          if(action === 'delete') return deletePayout(id);
        }
      );
    }

    function resetForm(){
      $('#payoutId').value='';
      $('#payoutForm').reset();
      $('#payoutDate').value = todayISO();
      $('#payoutSaveBtn').textContent='Save Payout';
      $('#payoutCancelEdit').hidden = true;
      clearAllHelps($('#payoutForm'));
    }

    function startEdit(id){
      const state = CBTStorage.getState();
      const rec = (state.payouts || []).find(r=>r.id === id);
      if(!rec) return;

      $('#payoutId').value = rec.id;
      $('#payoutDate').value = rec.date;
      $('#leaderName').value = rec.leaderName;
      $('#leaderRole').value = rec.role;
      $('#payoutAmount').value = rec.amount;
      $('#payoutReason').value = rec.reason;
      $('#payoutMethod').value = rec.method;
      $('#payoutApprovedBy').value = rec.approvedBy;
      $('#payoutSaveBtn').textContent='Update Payout';
      $('#payoutCancelEdit').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function deletePayout(id){
      const ok = await confirmModal({ title:'Delete payout record', message:'This will permanently remove the selected payout entry.', confirmText:'Delete', danger:true });
      if(!ok) return;

      CBTStorage.update((s)=>{
        s.payouts = (s.payouts || []).filter(r=>r.id !== id);
        return s;
      });
      CBTStorage.pushAudit('payout_delete', { id }, user.username);
      toast('Deleted', 'Payout record removed.');
      render();
    }

    $('#payoutCancelEdit').addEventListener('click', resetForm);

    $('#payoutForm').addEventListener('submit', (e)=>{
      e.preventDefault();
      clearAllHelps($('#payoutForm'));

      const id = $('#payoutId').value.trim();
      const date = $('#payoutDate').value;
      const leaderName = $('#leaderName').value.trim();
      const role = $('#leaderRole').value;
      const amount = parseMoney($('#payoutAmount').value);
      const reason = $('#payoutReason').value.trim();
      const method = $('#payoutMethod').value;
      const approvedBy = $('#payoutApprovedBy').value.trim();

      let ok = true;
      if(!date){ setHelp('payoutDate','Date is required.'); ok=false; }
      if(!role){ setHelp('leaderRole','Select a role.'); ok=false; }
      if(!leaderName){ setHelp('leaderName','Leader name is required.'); ok=false; }
      if(amount <= 0){ setHelp('payoutAmount','Amount must be greater than 0.'); ok=false; }
      if(!reason){ setHelp('payoutReason','Reason is required.'); ok=false; }
      if(!method){ setHelp('payoutMethod','Select payment method.'); ok=false; }
      if(!approvedBy){ setHelp('payoutApprovedBy','Approved By is required.'); ok=false; }
      if(!ok) return;

      const record = {
        id: id || CBTStorage.makeId('PAY'),
        date,
        leaderName,
        role,
        amount,
        reason,
        method,
        approvedBy,
        updatedAt: new Date().toISOString(),
        createdAt: id ? undefined : new Date().toISOString()
      };

      CBTStorage.update((s)=>{
        s.payouts = s.payouts || [];
        const idx = s.payouts.findIndex(r=>r.id === record.id);
        if(idx >= 0) s.payouts[idx] = { ...s.payouts[idx], ...record };
        else s.payouts.unshift(record);
        return s;
      });

      CBTStorage.pushAudit(id ? 'payout_update' : 'payout_create', { id: record.id, amount: record.amount, role: record.role }, user.username);
      toast('Saved', id ? 'Payout updated.' : 'Payout recorded.');
      resetForm();
      render();
    });

    $('#payoutSearch').addEventListener('input', ()=>render());

    $('#payoutExportCsv').addEventListener('click', ()=>{
      const rows = getFiltered();
      const csv = toCsv([
        ['ID','Date','Leader Name','Role','Amount','Reason','Payment Method','Approved By'],
        ...rows.map(r=>[r.id,r.date,r.leaderName,r.role,r.amount,r.reason,r.method,r.approvedBy])
      ]);
      downloadText(`cbt-payouts-${todayISO()}.csv`, csv);
      toast('Exported', 'Payouts CSV downloaded.');
    });

    $('#payoutPrintSummary').addEventListener('click', ()=>{
      // Print current page; CSS hides nav/toolbars
      window.print();
    });

    setRangeUI('month');
    render();
  }

  function initReports(){
    const user = CBTAuth.requireAuth();
    if(!user) return;
    CBTAuth.startActivityWatch();
    applyDarkModeFromSettings();
    wireShellButtons();

    // Default: this month
    $('#reportFrom').value = startOfMonthISO();
    $('#reportTo').value = endOfMonthISO();

    let lastCsv = null;

    function getRange(){
      return { from: $('#reportFrom').value || null, to: $('#reportTo').value || null };
    }

    function filterRange(arr, range){
      return (arr || []).filter(r=>withinRange(r.date, range.from, range.to));
    }

    function reportMeta(type, range){
      const titleMap = {
        monthlyStatement: 'Monthly financial statement',
        incomeStatement: 'Income statement',
        expenseReport: 'Expense report',
        categoryBreakdown: 'Category breakdown',
        leaderPayouts: 'Leader payout report'
      };
      const title = titleMap[type] || 'Report';
      const when = `${range.from || '…'} to ${range.to || '…'}`;
      return { title, when };
    }

    function renderReport(){
      const state = CBTStorage.getState();
      const type = $('#reportType').value;
      const range = getRange();
      const meta = reportMeta(type, range);

      const incomes = filterRange(state.incomes, range);
      const expenses = filterRange(state.expenses, range);
      const payouts = filterRange(state.payouts, range);

      const totalIncome = sumBy(incomes, r=>Number(r.amount)||0);
      const totalExpense = sumBy(expenses, r=>Number(r.amount)||0);
      const totalPayouts = sumBy(payouts, r=>Number(r.amount)||0);
      const net = totalIncome - totalExpense - totalPayouts;

      const out = $('#reportOutput');
      out.innerHTML = `
        <h3>${escapeHtml(meta.title)}</h3>
        <div class="meta">Date range: <strong>${escapeHtml(meta.when)}</strong></div>
      `;

      if(type === 'monthlyStatement'){
        out.innerHTML += `
          <div class="list">
            <div class="list-row"><div>Total income</div><div><strong>${escapeHtml(formatMoney(totalIncome))}</strong></div></div>
            <div class="list-row"><div>Total expenses</div><div><strong>${escapeHtml(formatMoney(totalExpense))}</strong></div></div>
            <div class="list-row"><div>Total payouts</div><div><strong>${escapeHtml(formatMoney(totalPayouts))}</strong></div></div>
            <div class="list-row"><div>Net balance</div><div><span class="badge ${net<0?'negative':'positive'}">${escapeHtml(formatMoney(net))}</span></div></div>
          </div>
        `;

        lastCsv = [
          ['Metric','Amount'],
          ['Total income', totalIncome],
          ['Total expenses', totalExpense],
          ['Total payouts', totalPayouts],
          ['Net balance', net]
        ];
        return;
      }

      if(type === 'incomeStatement'){
        const byCat = groupSum(incomes, r=>r.category||'Uncategorized', r=>Number(r.amount)||0);
        const keys = Array.from(byCat.keys()).sort();
        out.innerHTML += keys.length ? `
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Category</th><th>Total</th></tr></thead>
              <tbody>
                ${keys.map(k=>`<tr><td>${escapeHtml(k)}</td><td><strong>${escapeHtml(formatMoney(byCat.get(k)))}</strong></td></tr>`).join('')}
                <tr><td><strong>Grand Total</strong></td><td><strong>${escapeHtml(formatMoney(totalIncome))}</strong></td></tr>
              </tbody>
            </table>
          </div>
        ` : `<div class="muted">No income in this range.</div>`;

        lastCsv = [
          ['Category','Total'],
          ...keys.map(k=>[k, byCat.get(k)]),
          ['Grand Total', totalIncome]
        ];
        return;
      }

      if(type === 'expenseReport'){
        const byCat = groupSum(expenses, r=>r.category||'Uncategorized', r=>Number(r.amount)||0);
        const keys = Array.from(byCat.keys()).sort();
        out.innerHTML += keys.length ? `
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Category</th><th>Total</th></tr></thead>
              <tbody>
                ${keys.map(k=>`<tr><td>${escapeHtml(k)}</td><td><strong>${escapeHtml(formatMoney(byCat.get(k)))}</strong></td></tr>`).join('')}
                <tr><td><strong>Grand Total</strong></td><td><strong>${escapeHtml(formatMoney(totalExpense))}</strong></td></tr>
              </tbody>
            </table>
          </div>
        ` : `<div class="muted">No expenses in this range.</div>`;

        lastCsv = [
          ['Category','Total'],
          ...keys.map(k=>[k, byCat.get(k)]),
          ['Grand Total', totalExpense]
        ];
        return;
      }

      if(type === 'categoryBreakdown'){
        const incomeByCat = groupSum(incomes, r=>r.category||'Uncategorized', r=>Number(r.amount)||0);
        const expenseByCat = groupSum(expenses, r=>r.category||'Uncategorized', r=>Number(r.amount)||0);
        const all = new Set([...incomeByCat.keys(), ...expenseByCat.keys()]);
        const keys = Array.from(all).sort();

        out.innerHTML += keys.length ? `
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Category</th><th>Income</th><th>Expenses</th></tr></thead>
              <tbody>
                ${keys.map(k=>`<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(formatMoney(incomeByCat.get(k)||0))}</td><td>${escapeHtml(formatMoney(expenseByCat.get(k)||0))}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        ` : `<div class="muted">No data in this range.</div>`;

        lastCsv = [
          ['Category','Income','Expenses'],
          ...keys.map(k=>[k, incomeByCat.get(k)||0, expenseByCat.get(k)||0])
        ];
        return;
      }

      if(type === 'leaderPayouts'){
        const sums = new Map();
        for(const r of payouts){
          const k = `${r.leaderName}||${r.role}`;
          sums.set(k, (sums.get(k)||0) + Number(r.amount||0));
        }
        const rows = Array.from(sums.entries()).map(([k,total])=>{
          const [leaderName, role] = k.split('||');
          return { leaderName, role, total };
        }).sort((a,b)=>b.total-a.total);

        out.innerHTML += rows.length ? `
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Leader</th><th>Role</th><th>Total</th></tr></thead>
              <tbody>
                ${rows.map(r=>`<tr><td>${escapeHtml(r.leaderName)}</td><td>${escapeHtml(r.role)}</td><td><strong>${escapeHtml(formatMoney(r.total))}</strong></td></tr>`).join('')}
                <tr><td colspan="2"><strong>Grand Total</strong></td><td><strong>${escapeHtml(formatMoney(totalPayouts))}</strong></td></tr>
              </tbody>
            </table>
          </div>
        ` : `<div class="muted">No payouts in this range.</div>`;

        lastCsv = [
          ['Leader Name','Role','Total'],
          ...rows.map(r=>[r.leaderName, r.role, r.total]),
          ['Grand Total','', totalPayouts]
        ];
        return;
      }

      lastCsv = null;
    }

    $('#runReport').addEventListener('click', ()=>{
      renderReport();
      toast('Report', 'Report generated.');
    });

    $('#exportReportCsv').addEventListener('click', ()=>{
      if(!lastCsv){
        toast('Nothing to export', 'Run a report first.');
        return;
      }
      const csv = toCsv(lastCsv);
      downloadText(`cbt-report-${$('#reportType').value}-${todayISO()}.csv`, csv);
      toast('Exported', 'Report CSV downloaded.');
    });

    $('#printReport').addEventListener('click', ()=>{
      if(!$('#reportOutput').textContent.trim()) renderReport();
      window.print();
    });

    renderReport();
  }

  function initSettings(){
    const user = CBTAuth.requireAuth();
    if(!user) return;
    CBTAuth.startActivityWatch();
    applyDarkModeFromSettings();
    wireShellButtons();

    // Idle timeout
    const state = CBTStorage.getState();
    $('#idleMinutes').value = String(state.settings?.idleLogoutMinutes ?? 10);

    // Opening balances
    $('#openingCash').value = String(state.settings?.openingCash || 0);
    $('#openingBank').value = String(state.settings?.openingBank || 0);

    $('#timeoutForm').addEventListener('submit', (e)=>{
      e.preventDefault();
      const mins = Number($('#idleMinutes').value);
      if(!Number.isFinite(mins) || mins < 1){
        toast('Invalid value', 'Idle logout minutes must be at least 1.');
        return;
      }
      CBTStorage.update((s)=>{
        s.settings.idleLogoutMinutes = Math.floor(mins);
        return s;
      });
      CBTStorage.pushAudit('settings_update', { idleLogoutMinutes: mins }, user.username);
      toast('Saved', 'Inactivity timeout updated.');
    });

    $('#balanceForm').addEventListener('submit', (e)=>{
      e.preventDefault();
      const cash = Number($('#openingCash').value);
      const bank = Number($('#openingBank').value);
      CBTStorage.update((s)=>{
        s.settings.openingCash = cash;
        s.settings.openingBank = bank;
        return s;
      });
      CBTStorage.pushAudit('balance_update', { cash, bank }, user.username);
      toast('Saved', 'Opening balances updated.');
    });

    // Change password
    $('#passwordForm').addEventListener('submit', async (e)=>{
      e.preventDefault();
      clearAllHelps($('#passwordForm'));

      const oldPw = $('#oldPassword').value;
      const newPw = $('#newPassword').value;
      const confirm = $('#confirmPassword').value;

      let ok = true;
      if(!oldPw){ setHelp('oldPassword','Current password is required.'); ok=false; }
      if(!newPw || newPw.length < 6){ setHelp('newPassword','New password must be at least 6 characters.'); ok=false; }
      if(newPw !== confirm){ setHelp('confirmPassword','Passwords do not match.'); ok=false; }
      if(!ok) return;

      try{
        await CBTAuth.changePassword(user.username, oldPw, newPw);
        $('#passwordForm').reset();
        toast('Updated', 'Password updated successfully.');
      }catch(err){
        toast('Failed', err.message || 'Unable to change password.');
      }
    });

    // Categories
    const st = CBTStorage.getState();
    $('#incomeCategories').value = (st.categories?.income || []).join('\n');
    $('#expenseCategories').value = (st.categories?.expense || []).join('\n');

    $('#saveCategories').addEventListener('click', ()=>{
      const income = $('#incomeCategories').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      const expense = $('#expenseCategories').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      if(income.length === 0 || expense.length === 0){
        toast('Invalid categories', 'Income and expense categories must not be empty.');
        return;
      }
      CBTStorage.update((s)=>{
        s.categories.income = income;
        s.categories.expense = expense;
        return s;
      });
      CBTStorage.pushAudit('categories_update', { incomeCount: income.length, expenseCount: expense.length }, user.username);
      toast('Saved', 'Categories updated.');
    });

    // Budget planning
    const monthInput = $('#budgetMonth');
    if(monthInput){
      monthInput.value = todayISO().slice(0,7);
    }

    const renderBudgetEditorNoInline = ()=>{
      const state = CBTStorage.getState();
      const monthKey = (monthInput?.value || todayISO().slice(0,7));
      const budget = state.budgets?.[monthKey] || {};
      const cats = getExpenseCategories();

      const rows = cats.map(cat=>{
        const val = Number(budget[cat] || 0);
        return `
          <tr>
            <td>${escapeHtml(cat)}</td>
            <td>
              <input class="input money-input" type="number" inputmode="decimal" min="0" step="0.01"
                data-budget-cat="${escapeHtml(cat)}" value="${escapeHtml(String(val || ''))}" placeholder="0.00" />
            </td>
          </tr>
        `;
      }).join('');

      $('#budgetEditor').innerHTML = `
        <table class="table">
          <thead><tr><th>Expense Category</th><th>Monthly Budget</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="2" class="muted">No categories found.</td></tr>`}</tbody>
        </table>
      `;
    };

    renderBudgetEditorNoInline();
    monthInput?.addEventListener('change', renderBudgetEditorNoInline);

    $('#saveBudget')?.addEventListener('click', ()=>{
      const monthKey = (monthInput?.value || todayISO().slice(0,7));
      const inputs = $$('input[data-budget-cat]');
      const budget = {};
      for(const inp of inputs){
        const cat = inp.getAttribute('data-budget-cat');
        const val = parseMoney(inp.value);
        if(val > 0) budget[cat] = val;
      }

      CBTStorage.update((s)=>{
        s.budgets = s.budgets || {};
        s.budgets[monthKey] = budget;
        return s;
      });
      CBTStorage.pushAudit('budget_save', { month: monthKey, categories: Object.keys(budget).length }, user.username);
      toast('Saved', `Budget saved for ${monthKey}.`);
    });

    $('#clearBudget')?.addEventListener('click', async ()=>{
      const monthKey = (monthInput?.value || todayISO().slice(0,7));
      const ok = await confirmModal({
        title: 'Clear monthly budget',
        message: `This will remove the saved budget for ${monthKey}. Continue?`,
        confirmText: 'Clear',
        danger: true
      });
      if(!ok) return;

      CBTStorage.update((s)=>{
        s.budgets = s.budgets || {};
        delete s.budgets[monthKey];
        return s;
      });
      CBTStorage.pushAudit('budget_clear', { month: monthKey }, user.username);
      renderBudgetEditorNoInline();
      toast('Cleared', `Budget cleared for ${monthKey}.`);
    });

    // Export JSON backup
    $('#exportJson').addEventListener('click', ()=>{
      const blob = CBTStorage.exportAll();
      downloadText(`cbt-backup-${todayISO()}.json`, JSON.stringify(blob, null, 2));
      toast('Backup', 'JSON backup downloaded.');
    });

    // Import JSON backup
    $('#importJson').addEventListener('change', async (e)=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;

      const ok = await confirmModal({
        title:'Import backup',
        message:'Import will overwrite current data. Continue?',
        confirmText:'Import',
        danger:true
      });
      if(!ok){ e.target.value=''; return; }

      const text = await file.text();
      try{
        const obj = JSON.parse(text);
        CBTStorage.importAll(obj);
        CBTStorage.pushAudit('backup_import', { fileName: file.name }, user.username);
        toast('Imported', 'Backup imported successfully.');
        setTimeout(()=>window.location.reload(), 600);
      }catch(err){
        toast('Import failed', err.message || 'Invalid JSON file.');
        e.target.value='';
      }
    });

    // Clear all data
    $('#clearAllData').addEventListener('click', async ()=>{
      const ok = await confirmModal({
        title:'Clear all data',
        message:'This will permanently remove all incomes, expenses, payouts, budgets, and settings on this browser. This cannot be undone.',
        confirmText:'Clear all',
        danger:true
      });
      if(!ok) return;

      CBTStorage.clearAll();
      toast('Cleared', 'All data removed.');
      window.location.replace('login.html');
    });

    // Export audit CSV
    $('#exportAudit').addEventListener('click', ()=>{
      const state = CBTStorage.getState();
      const rows = (state.audit || []);
      const csv = toCsv([
        ['ID','At','Actor','Action','Details'],
        ...rows.map(r=>[r.id,r.at,r.actor,r.action, JSON.stringify(r.details||{})])
      ]);
      downloadText(`cbt-audit-${todayISO()}.csv`, csv);
      toast('Exported', 'Audit CSV downloaded.');
    });
  }

  // ---------- Boot ----------

  document.addEventListener('DOMContentLoaded', async ()=>{
    const page = document.body?.dataset?.page || '';

    // Ensure defaults exist for all pages
    await CBTAuth.ensureDefaultAdmin();
    applyDarkModeFromSettings();

    const routes = {
      index: initIndex,
      login: initLogin,
      dashboard: initDashboard,
      income: initIncome,
      expenses: initExpenses,
      payouts: initPayouts,
      reports: initReports,
      settings: initSettings,
      banking: initBanking
    };

    const fn = routes[page];
    if(typeof fn === 'function') fn();
  });

  // Expose minimal helpers for debugging
  window.CBTApp = {
    formatMoney,
    toast,
    getBalances
  };
})();
