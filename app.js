/* ============================= API HELPERS ============================= */
async function api(path, opts) {
  opts = opts || {};
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  const res = await fetch('/api' + path, Object.assign({}, opts, { headers }));
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}
const authHeader = () => (authToken ? { 'x-auth-token': authToken } : {});
const getManagerState = () => api('/state', { headers: authHeader() });
const getPromoterState = (location) => api('/promoter-state?location=' + encodeURIComponent(location));

/* ============================= UTIL ============================= */
function esc(s){ return (s===undefined||s===null?'':String(s)).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function todayStr(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function dateStrOfTs(ts){ const d=new Date(ts); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function isToday(ts){ return todayStr() === dateStrOfTs(ts); }
function isOnDate(ts, dateStr){ return dateStrOfTs(ts) === dateStr; }
function fmtTime(ts){ return new Date(ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }
function timeAgo(ts){
  const diff = Date.now()-ts; const m = Math.floor(diff/60000);
  if(m<1) return 'just now'; if(m<60) return m+'m ago';
  const h=Math.floor(m/60); return h+'h '+(m%60)+'m ago';
}
function durationStr(a,b){
  const mins = Math.max(0, Math.round((b-a)/60000));
  const h = Math.floor(mins/60), m = mins%60;
  return (h ? h+'h ' : '') + m + 'm';
}
function locCode(loc, locations){ return 'LOC-'+String(locations.indexOf(loc)+1).padStart(2,'0'); }
function showToast(msg){
  const el = document.createElement('div'); el.className='toast'; el.textContent=msg;
  document.getElementById('toastRoot').appendChild(el);
  setTimeout(()=>el.remove(), 2400);
}

/* ============================= SESSION (in-memory only) ============================= */
let session = null; // {name, location}
let currentTab = 'hourly';
let hourlyLow = null;
let invLow = null;

/* ============================= MANAGER AUTH (in-memory only) ============================= */
let authToken = null;
let authUsername = null;

/* ============================= MANAGER REPORT DATE FILTERS (in-memory only) ============================= */
let attendanceDate = todayStr();
let salesDate = todayStr();

/* ============================= CLOCK ============================= */
setInterval(()=>{ document.getElementById('clock').textContent = new Date().toLocaleTimeString(); }, 1000);

/* ============================= ROLE TOGGLE ============================= */
document.getElementById('roleBtnManager').onclick = ()=> switchRole('manager');
document.getElementById('roleBtnPromoter').onclick = ()=> switchRole('promoter');
function switchRole(role){
  document.getElementById('roleBtnManager').classList.toggle('active', role==='manager');
  document.getElementById('roleBtnPromoter').classList.toggle('active', role==='promoter');
  document.getElementById('managerView').classList.toggle('hidden', role!=='manager');
  document.getElementById('promoterView').classList.toggle('hidden', role!=='promoter');
  if(role==='manager') renderManager();
}

/* ============================= MANAGER LOGIN ============================= */
function showManagerLogin(){
  document.getElementById('managerDashboardContent').classList.add('hidden');
  document.getElementById('managerLoginPanel').classList.remove('hidden');
  document.getElementById('syncLabel').textContent = 'Sign-in required';
}
document.getElementById('mgrLoginBtn').onclick = async ()=>{
  const username = document.getElementById('mgrUsername').value.trim();
  const password = document.getElementById('mgrPassword').value;
  const errEl = document.getElementById('mgrLoginError');
  errEl.classList.add('hidden');
  if(!username || !password){
    errEl.textContent = 'Enter both username and password.';
    errEl.classList.remove('hidden');
    return;
  }
  try{
    const data = await api('/login', { method:'POST', body: JSON.stringify({ username, password }) });
    authToken = data.token; authUsername = data.username;
    document.getElementById('mgrUsername').value=''; document.getElementById('mgrPassword').value='';
    renderManager();
  }catch(e){
    errEl.textContent = e.message || 'Login failed.';
    errEl.classList.remove('hidden');
  }
};
document.getElementById('mgrPassword').addEventListener('keydown', e=>{
  if(e.key==='Enter') document.getElementById('mgrLoginBtn').click();
});
document.getElementById('logoutBtn').onclick = async ()=>{
  try{ await api('/logout', { method:'POST', headers: authHeader() }); }catch(e){}
  authToken = null; authUsername = null;
  renderManager();
};

/* ============================= MANAGER TABS (Overview / Attendance / Sales Report) ============================= */
document.querySelectorAll('#mgrTabs .tab-btn').forEach(btn=>{
  btn.onclick = ()=>{
    document.querySelectorAll('#mgrTabs .tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    ['overview','attendance','sales'].forEach(t=>document.getElementById('mgrtab-'+t).classList.add('hidden'));
    document.getElementById('mgrtab-'+btn.dataset.mgrtab).classList.remove('hidden');
  };
});

/* ============================= MANAGER: REPORT DATE PICKERS (Attendance / Sales) ============================= */
(function initReportDatePickers(){
  const attnPicker = document.getElementById('attendanceDatePicker');
  const attnTodayBtn = document.getElementById('attendanceTodayBtn');
  if(attnPicker){
    attnPicker.max = todayStr();
    attnPicker.value = attendanceDate;
    attnPicker.addEventListener('change', e=>{
      attendanceDate = e.target.value || todayStr();
      renderManager();
    });
  }
  if(attnTodayBtn){
    attnTodayBtn.onclick = ()=>{
      attendanceDate = todayStr();
      if(attnPicker) attnPicker.value = attendanceDate;
      renderManager();
    };
  }

  const salesPicker = document.getElementById('salesDatePicker');
  const salesTodayBtn = document.getElementById('salesTodayBtn');
  if(salesPicker){
    salesPicker.max = todayStr();
    salesPicker.value = salesDate;
    salesPicker.addEventListener('change', e=>{
      salesDate = e.target.value || todayStr();
      renderManager();
    });
  }
  if(salesTodayBtn){
    salesTodayBtn.onclick = ()=>{
      salesDate = todayStr();
      if(salesPicker) salesPicker.value = salesDate;
      renderManager();
    };
  }
})();

/* ============================= MANAGER RENDER ============================= */
let managerFilter = 'all';
let managerSearch = '';

document.getElementById('searchInput').addEventListener('input', e=>{ managerSearch = e.target.value.toLowerCase(); renderManager(); });
document.getElementById('filterSelect').addEventListener('change', e=>{ managerFilter = e.target.value; renderManager(); });
document.getElementById('refreshBtn').onclick = renderManager;
document.getElementById('addLocationBtn').onclick = async ()=>{
  const name = prompt('New location name:');
  if(!name) return;
  const postcode = prompt('Postcode for this location (optional):') || '';
  await api('/locations', { method:'POST', body: JSON.stringify({ name: name.trim(), postcode: postcode.trim() }) });
  showToast('Location added: '+name.trim());
  renderManager();
};
document.getElementById('resetBtn').onclick = async ()=>{
  if(!confirm('This clears all check-ins, updates, and reports on the server. Continue?')) return;
  await api('/reset', { method:'POST', headers: authHeader() });
  showToast('Demo data reset');
  renderManager();
};

async function renderManager(){
  if(!authToken){ showManagerLogin(); return; }

  document.getElementById('syncLabel').textContent = 'Syncing…';
  let state;
  try{ state = await getManagerState(); }
  catch(e){
    if(String(e.message||'').toLowerCase().includes('unauthorized')){
      authToken = null; authUsername = null;
      showManagerLogin();
      return;
    }
    document.getElementById('syncLabel').textContent = 'Offline';
    return;
  }
  document.getElementById('managerLoginPanel').classList.add('hidden');
  document.getElementById('managerDashboardContent').classList.remove('hidden');
  document.getElementById('syncLabel').textContent = 'Live';
  document.getElementById('mgrWhoami').textContent = authUsername ? ('Signed in as '+authUsername) : '';

  const today = todayStr();
  const locations = state.locations;
  const postcodes = state.postcodes || {};
  document.getElementById('locCount').textContent = locations.length;

  let checkedIn=0, totalFootfall=0, totalItemsSold=0, lowStockCount=0, issueCount=0;
  const rows = locations.map(loc=>{
    const d = state.data[loc] || { checkin:null, attendance:[], hourlyUpdates:[], inventoryReports:[], eod:null };
    // A promoter is "checked in today" once d.checkin.date === today. That same
    // record (name + ts) sticks around after checkout — only checkedOutTs gets
    // set — so we can tell apart three states: never checked in today, still
    // checked in, and checked in earlier but already checked out.
    const hasCheckinToday = !!(d.checkin && d.checkin.date === today);
    const isCheckedIn = hasCheckinToday && !d.checkin.checkedOutTs;
    const isCheckedOut = hasCheckinToday && !!d.checkin.checkedOutTs;
    const promoterName = hasCheckinToday ? d.checkin.name : null;
    const todaysHourly = (d.hourlyUpdates||[]).filter(u=>isToday(u.ts));
    const todaysInv = (d.inventoryReports||[]).filter(u=>isToday(u.ts));
    let footfall=0, itemsSoldQty=0, hasIssue=false, lowStock=false;
    // "itemsSoldQty" = total quantity of items sold today (not a dollar/amount figure)
    todaysHourly.forEach(u=>{
      footfall+=Number(u.footfall||0);
      (u.itemsSold||[]).forEach(it=>{ itemsSoldQty += Number(it.qty||0); });
      if(u.issues && u.issues.trim()) hasIssue=true;
      if(u.lowStock) lowStock=true;
    });
    todaysInv.forEach(u=>{ if(u.lowStockAlert) lowStock=true; });
    if(d.eod && d.eod.date===today){ if(d.eod.feedback && d.eod.feedback.trim()) hasIssue=true; }
    totalFootfall+=footfall; totalItemsSold+=itemsSoldQty;
    if(lowStock) lowStockCount++;
    if(hasIssue) issueCount++;
    const lastEvents = [...todaysHourly.map(u=>u.ts), ...todaysInv.map(u=>u.ts)];
    const lastTs = lastEvents.length ? Math.max(...lastEvents) : (hasCheckinToday ? d.checkin.ts : null);
    return {loc, d, isCheckedIn, isCheckedOut, hasCheckinToday, promoterName, footfall, itemsSoldQty, hasIssue, lowStock, lastTs, eodDone: d.eod && d.eod.date===today, postcode: postcodes[loc] || '—'};
  });

  const kpis = [
    {label:'Locations Active', value: checkedIn+'/'+locations.length, color:'var(--primary)'},
    {label:'Checked In', value: checkedIn, color:'var(--good)'},
    {label:'Footfall Today', value: totalFootfall, color:'var(--primary)'},
    {label:'Items Sold Today', value: totalItemsSold.toLocaleString(), color:'var(--good)'},
    {label:'Low / Out of Stock', value: lowStockCount, color:'var(--warn)'},
    {label:'Open Issues', value: issueCount, color:'var(--danger)'}
  ];
  // checkedIn was accumulated as a closure variable above via the map — recompute
  // cleanly here so the KPI is correct regardless of map execution order.
  checkedIn = rows.filter(r=>r.isCheckedIn).length;
  kpis[0].value = checkedIn+'/'+locations.length;
  kpis[1].value = checkedIn;

  renderAlertsBanner(rows);

  document.getElementById('kpiStrip').innerHTML = kpis.map(k=>`
    <div class="kpi" style="--kpi-color:${k.color}">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
    </div>`).join('');

  let filtered = rows.filter(r=>{
    if(managerSearch && !r.loc.toLowerCase().includes(managerSearch) && !String(r.postcode).toLowerCase().includes(managerSearch)) return false;
    if(managerFilter==='in' && !r.isCheckedIn) return false;
    if(managerFilter==='out' && r.isCheckedIn) return false;
    if(managerFilter==='low' && !r.lowStock) return false;
    if(managerFilter==='issue' && !r.hasIssue) return false;
    return true;
  });

  document.getElementById('cardsGrid').innerHTML = filtered.map(r=>{
    const stamp = r.isCheckedIn
      ? `<div class="stamp good">Checked In</div>`
      : (r.isCheckedOut ? `<div class="stamp out">Checked Out</div>` : `<div class="stamp pending">Awaiting</div>`);
    const badges = [];
    if(r.lowStock) badges.push(`<span class="badge low">⚠ Low Stock</span>`);
    if(r.hasIssue) badges.push(`<span class="badge issue">⚠ Issue Reported</span>`);
    if(r.eodDone) badges.push(`<span class="badge ok">EOD Filed</span>`);
    if(!badges.length) badges.push(`<span class="badge neutral">Nominal</span>`);
    return `
    <div class="ticket" data-loc="${esc(r.loc)}">
      <div class="ticket-top">
        <div><div class="ticket-code">${locCode(r.loc, locations)}</div><div class="ticket-name">${esc(r.loc)}</div></div>
        ${stamp}
      </div>
      <div class="ticket-row"><span>Postcode</span><b>${esc(r.postcode)}</b></div>
      <div class="ticket-row"><span>Promoter</span><b>${r.promoterName ? esc(r.promoterName) : '—'}</b></div>
      <div class="ticket-row"><span>Last update</span><b>${r.lastTs ? timeAgo(r.lastTs) : '—'}</b></div>
      <hr class="ticket-divider">
      <div class="ticket-row"><span>Footfall today</span><b>${r.footfall}</b></div>
      <div class="ticket-row"><span>Items sold today</span><b>${r.itemsSoldQty.toLocaleString()}</b></div>
      <div class="badge-row">${badges.join('')}</div>
    </div>`;
  }).join('') || `<p class="empty-note">No locations match this filter.</p>`;

  document.querySelectorAll('.ticket').forEach(el=>{
    el.onclick = ()=> openLocationDetail(el.dataset.loc);
  });

  renderAttendanceTable(state);
  renderSalesReport(state);
}

/* ============================= MANAGER: PROMINENT ALERTS BANNER ============================= */
function renderAlertsBanner(rows){
  const el = document.getElementById('alertsBanner');
  if(!el) return;
  const alerts = [];
  rows.forEach(r=>{
    if(r.lowStock) alerts.push({loc:r.loc, level:'danger', text:'Low / out of stock'});
    if(r.hasIssue) alerts.push({loc:r.loc, level:'warn', text:'Issue reported'});
  });
  if(!alerts.length){ el.innerHTML=''; return; }
  el.innerHTML = alerts.map(a=>`
    <div class="alert-banner-item ${a.level}">
      <span class="a-icon">${a.level==='danger' ? '🔴' : '⚠️'}</span>
      <span><b>${esc(a.loc)}</b> — ${esc(a.text)}</span>
    </div>`).join('');
}

function renderAttendanceTable(state){
  const selDate = attendanceDate;
  const records = [];
  state.locations.forEach(loc=>{
    const d = state.data[loc] || {};
    (d.attendance||[]).filter(a=>a.date===selDate).forEach(a=>{
      records.push({ loc, name:a.name, checkinTs:a.checkinTs, checkoutTs:a.checkoutTs, date:a.date });
    });
  });
  records.sort((a,b)=>b.checkinTs-a.checkinTs);
  document.getElementById('attendanceTable').innerHTML = records.length ? `
    <table class="report-table">
      <thead><tr><th>Date</th><th>Location</th><th>Promoter</th><th>Checked in</th><th>Checked out</th><th>Duration</th></tr></thead>
      <tbody>
        ${records.map(r=>`
          <tr>
            <td>${esc(r.date)}</td>
            <td>${esc(r.loc)}</td>
            <td>${esc(r.name)}</td>
            <td>${fmtTime(r.checkinTs)}</td>
            <td>${r.checkoutTs ? fmtTime(r.checkoutTs) : '—'}</td>
            <td>${r.checkoutTs ? durationStr(r.checkinTs, r.checkoutTs) : 'Still in'}</td>
          </tr>`).join('')}
      </tbody>
    </table>` : `<p class="empty-note">No attendance recorded for ${esc(selDate)}.</p>`;
}

function renderSalesReport(state){
  const selDate = salesDate;
  const itemTotals = {};
  const log = [];
  state.locations.forEach(loc=>{
    const d = state.data[loc] || {};
    (d.hourlyUpdates||[]).filter(u=>isOnDate(u.ts, selDate)).forEach(u=>{
      // "items sold" here = total quantity of items sold in this update
      const qtySold = (u.itemsSold||[]).reduce((s,it)=>s+Number(it.qty||0),0);
      log.push({ loc, promoter:u.promoter, ts:u.ts, footfall:u.footfall||0, itemsSoldQty: qtySold, itemsSold:u.itemsSold||[] });
      (u.itemsSold||[]).forEach(it=>{
        if(!it.item || !String(it.item).trim()) return;
        const key = String(it.item).trim();
        itemTotals[key] = (itemTotals[key]||0) + Number(it.qty||0);
      });
    });
  });
  log.sort((a,b)=>b.ts-a.ts);
  const items = Object.entries(itemTotals).sort((a,b)=>b[1]-a[1]);

  document.getElementById('salesSummary').innerHTML = items.length ? `
    <h4 style="margin-top:0;">Items sold — ${esc(selDate)}</h4>
    <table class="report-table">
      <thead><tr><th>Item</th><th>Qty sold</th></tr></thead>
      <tbody>${items.map(([item,qty])=>`<tr><td>${esc(item)}</td><td>${qty}</td></tr>`).join('')}</tbody>
    </table>` : `<p class="empty-note">No items logged as sold on ${esc(selDate)}.</p>`;

  document.getElementById('salesLog').innerHTML = log.length ? `
    <h4>Sales log — ${esc(selDate)}</h4>
    <table class="report-table">
      <thead><tr><th>Location</th><th>Promoter</th><th>Time</th><th>Footfall</th><th>Items Sold</th><th>Breakdown</th></tr></thead>
      <tbody>
        ${log.map(r=>`
          <tr>
            <td>${esc(r.loc)}</td>
            <td>${esc(r.promoter)}</td>
            <td>${fmtTime(r.ts)}</td>
            <td>${r.footfall}</td>
            <td>${r.itemsSoldQty.toLocaleString()}</td>
            <td>${(r.itemsSold||[]).filter(it=>it.item && String(it.item).trim()).map(it=>esc(it.item)+' ×'+esc(it.qty)).join(', ') || '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>` : `<p class="empty-note">No hourly sales logged on ${esc(selDate)}.</p>`;
}

async function openLocationDetail(loc){
  const state = await getManagerState();
  const d = state.data[loc] || { checkin:null, attendance:[], hourlyUpdates:[], inventoryReports:[], eod:null };
  const postcode = (state.postcodes || {})[loc];
  const today = todayStr();
  const events = [];
  (d.hourlyUpdates||[]).filter(u=>isToday(u.ts)).forEach(u=> events.push({ts:u.ts, type:'Hourly Update', body:
    `<b>Footfall:</b> ${u.footfall||0} &nbsp; <b>Items Sold:</b> ${(u.itemsSold||[]).reduce((s,it)=>s+Number(it.qty||0),0)}${u.lowStock?' &nbsp; <b>⚠ Low stock flagged</b>':''}<br>${u.activity?esc(u.activity)+'<br>':''}${(u.itemsSold&&u.itemsSold.length)?'<b>Items sold:</b> '+u.itemsSold.filter(it=>it.item&&String(it.item).trim()).map(it=>esc(it.item)+' ×'+esc(it.qty)).join(', ')+'<br>':''}${u.issues?'<b>Issue:</b> '+esc(u.issues)+'<br>':''}${u.comments?esc(u.comments):''}`
  }));
  (d.inventoryReports||[]).filter(u=>isToday(u.ts)).forEach(u=> events.push({ts:u.ts, type:'Inventory Report', body:
    `${(u.stock||[]).map(s=>esc(s.item)+': '+esc(s.qty)).join(', ')||'No stock items listed'}<br>${u.missing?'<b>Missing:</b> '+esc(u.missing)+'<br>':''}${u.oos?'<b>Out of stock:</b> '+esc(u.oos)+'<br>':''}${u.lowStockAlert?'<b>⚠ Low stock alert raised</b>':''}`
  }));
  (d.attendance||[]).filter(a=>a.date===today).forEach(a=>{
    events.push({ts:a.checkinTs, type:'Check-in', body:`${esc(a.name)} checked in.`});
    if(a.checkoutTs) events.push({ts:a.checkoutTs, type:'Check-out', body:`${esc(a.name)} checked out (${durationStr(a.checkinTs,a.checkoutTs)} on shift).`});
  });
  if(d.eod && d.eod.date===today) events.push({ts:d.eod.ts, type:'End of Day Report', body:
    `<b>Total sales:</b> ${d.eod.sales||0} &nbsp; <b>Samples left:</b> ${d.eod.samples||0}<br>${d.eod.inventory?'<b>Remaining inventory:</b> '+esc(d.eod.inventory)+'<br>':''}${d.eod.flavours?'<b>Remaining flavours:</b> '+esc(d.eod.flavours)+'<br>':''}${d.eod.summary?'<b>Summary:</b> '+esc(d.eod.summary)+'<br>':''}${d.eod.feedback?'<b>Feedback:</b> '+esc(d.eod.feedback):''}`
  });
  events.sort((a,b)=>b.ts-a.ts);

  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay" id="overlay">
      <div class="modal">
        <div class="modal-header">
          <div>
            <h2>${esc(loc)}</h2>
            ${postcode ? `<p class="sub" style="margin:2px 0 0;">Postcode: ${esc(postcode)}</p>` : ''}
          </div>
          <button class="modal-close" id="closeModal">&times;</button>
        </div>
        <div class="modal-body">
          ${events.length ? events.map(e=>`
            <div class="timeline-item">
              <div class="t-head"><span class="t-type">${e.type}</span><span>${fmtTime(e.ts)}</span></div>
              <div class="t-body">${e.body}</div>
            </div>`).join('') : '<p class="empty-note">No activity logged yet today.</p>'}
        </div>
      </div>
    </div>`;
  document.getElementById('closeModal').onclick = ()=> document.getElementById('modalRoot').innerHTML='';
  document.getElementById('overlay').onclick = (e)=>{ if(e.target.id==='overlay') document.getElementById('modalRoot').innerHTML=''; };
}

/* ============================= PROMOTER: SETUP ============================= */
async function populateLocationSelect(){
  const locations = await api('/locations');
  const sel = document.getElementById('setupLocation');
  sel.innerHTML = locations.length
    ? locations.map(l=>`<option value="${esc(l)}">${esc(l)}</option>`).join('')
    : `<option value="">— No locations yet, add one below —</option>`;
}
document.getElementById('startShiftBtn').onclick = async ()=>{
  const name = document.getElementById('setupName').value.trim();
  const newLoc = document.getElementById('setupNewLocation').value.trim();
  const newPostcode = document.getElementById('setupPostcode').value.trim();
  let loc = newLoc || document.getElementById('setupLocation').value;
  if(!name){ alert('Please enter your name.'); return; }
  if(!loc){ alert('Please select or enter a location.'); return; }
  if(newLoc){
    await api('/locations', { method:'POST', body: JSON.stringify({ name: newLoc, postcode: newPostcode }) });
  }
  session = { name, location: loc };
  document.getElementById('promoterSetup').classList.add('hidden');
  document.getElementById('promoterMain').classList.remove('hidden');
  document.getElementById('sessName').textContent = name;
  document.getElementById('sessLoc').textContent = loc.toUpperCase();
  renderStockRows(1);
  renderItemsSoldRows(1);
  await renderCheckinBox();
  renderMyLog();
};
document.getElementById('endSessionBtn').onclick = ()=>{
  session = null;
  document.getElementById('promoterMain').classList.add('hidden');
  document.getElementById('promoterSetup').classList.remove('hidden');
  document.getElementById('setupName').value='';
  document.getElementById('setupNewLocation').value='';
  document.getElementById('setupPostcode').value='';
};

/* ============================= PROMOTER: CHECK-IN / CHECK-OUT ============================= */
/* Shows the FULL history of today's sessions for this promoter (not just the
   most recent one), so checking in a second time no longer hides the first
   check-in/check-out times. */
async function renderCheckinBox(){
  const state = await getPromoterState(session.location);
  const d = state.data;
  const today = todayStr();
  const box = document.getElementById('checkinBox');

  const mySessions = (d.attendance||[])
    .filter(a=>a.date===today && a.name===session.name)
    .sort((a,b)=>a.checkinTs-b.checkinTs);
  const last = mySessions[mySessions.length-1];
  const currentlyIn = !!(last && !last.checkoutTs);

  const historyHtml = mySessions.length ? `
    <div class="session-history">
      ${mySessions.map((s,i)=>`
        <div class="session-row">
          <span>Session ${i+1}</span>
          <span>${fmtTime(s.checkinTs)} → ${s.checkoutTs ? fmtTime(s.checkoutTs) : 'still in'}</span>
        </div>`).join('')}
    </div>` : '';

  if(currentlyIn){
    box.innerHTML = `<div class="panel" style="padding:16px 22px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><h3 style="margin:0;">✅ Checked in</h3><p class="sub" style="margin:4px 0 0;">at ${fmtTime(last.checkinTs)} as ${esc(session.name)}</p></div>
        <button class="btn btn-outline-danger" id="doCheckoutBtn">Check Out</button>
      </div>
      ${historyHtml}
    </div>`;
    document.getElementById('doCheckoutBtn').onclick = async ()=>{
      await api('/checkout', { method:'POST', body: JSON.stringify({ location: session.location, name: session.name }) });
      showToast('Checked out');
      renderCheckinBox();
    };
  } else if(mySessions.length){
    box.innerHTML = `<div class="panel" style="padding:16px 22px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div><h3 style="margin:0;">Checked out</h3><p class="sub" style="margin:4px 0 0;">Last session: ${fmtTime(last.checkinTs)} → ${fmtTime(last.checkoutTs)}</p></div>
        <button class="btn btn-primary" id="doCheckinBtn">Check In Again</button>
      </div>
      ${historyHtml}
    </div>`;
    document.getElementById('doCheckinBtn').onclick = async ()=>{
      await api('/checkin', { method:'POST', body: JSON.stringify({ location: session.location, name: session.name }) });
      showToast('Checked in — visible on manager dashboard');
      renderCheckinBox();
    };
  } else {
    box.innerHTML = `<div class="panel" style="display:flex;justify-content:space-between;align-items:center;padding:16px 22px;">
      <div><h3 style="margin:0;">You haven't checked in yet</h3><p class="sub" style="margin:4px 0 0;">Tap the button to mark your arrival.</p></div>
      <button class="btn btn-primary" id="doCheckinBtn">Check In Now</button>
    </div>`;
    document.getElementById('doCheckinBtn').onclick = async ()=>{
      await api('/checkin', { method:'POST', body: JSON.stringify({ location: session.location, name: session.name }) });
      showToast('Checked in — visible on manager dashboard');
      renderCheckinBox();
    };
  }
}

/* ============================= PROMOTER: TABS ============================= */
document.querySelectorAll('.tab-btn').forEach(btn=>{
  if(btn.closest('#mgrTabs')) return; // manager tabs handled separately above
  btn.onclick = ()=>{
    document.querySelectorAll('.tabs:not(#mgrTabs) .tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.add('hidden'));
    document.getElementById('tab-'+currentTab).classList.remove('hidden');
    if(currentTab==='log') renderMyLog();
  };
});

function setLow(val){
  hourlyLow = val;
  document.getElementById('h_lowYes').className = val ? 'selected-yes' : '';
  document.getElementById('h_lowNo').className = !val ? 'selected-no' : '';
}
function setInvLow(val){
  invLow = val;
  document.getElementById('i_lowYes').className = val ? 'selected-yes' : '';
  document.getElementById('i_lowNo').className = !val ? 'selected-no' : '';
}

function renderStockRows(n){
  const wrap = document.getElementById('stockRows');
  wrap.innerHTML='';
  for(let i=0;i<n;i++) addStockRow();
}
function addStockRow(prefillName){
  const wrap = document.getElementById('stockRows');
  const row = document.createElement('div');
  row.className='stock-row';
  row.innerHTML = `<input type="text" placeholder="Item / flavour name" class="stock-item" list="presetItems">
    <input type="number" min="0" placeholder="Qty" class="stock-qty">
    <button type="button" class="icon-btn" onclick="this.closest('.stock-row').remove()">✕</button>`;
  wrap.appendChild(row);
  if(prefillName){
    row.querySelector('.stock-item').value = prefillName;
    row.querySelector('.stock-qty').focus();
  }
}
document.getElementById('addStockRowBtn').onclick = ()=>addStockRow();

function renderItemsSoldRows(n){
  const wrap = document.getElementById('itemsSoldRows');
  wrap.innerHTML='';
  for(let i=0;i<n;i++) addItemSoldRow();
}
function addItemSoldRow(prefillName){
  const wrap = document.getElementById('itemsSoldRows');
  const row = document.createElement('div');
  row.className='stock-row';
  row.innerHTML = `<input type="text" placeholder="Item / flavour name" class="itemsold-item" list="presetItems">
    <input type="number" min="0" placeholder="Qty sold" class="itemsold-qty">
    <button type="button" class="icon-btn" onclick="this.closest('.stock-row').remove()">✕</button>`;
  wrap.appendChild(row);
  if(prefillName){
    row.querySelector('.itemsold-item').value = prefillName;
    row.querySelector('.itemsold-qty').focus();
  }
  return row;
}
document.getElementById('addItemSoldRowBtn').onclick = ()=>addItemSoldRow();

/* Quick-add chips: if an empty items-sold row exists, fill it in;
   otherwise add a fresh row prefilled with the tapped item name. */
function quickAddItemSold(name){
  const wrap = document.getElementById('itemsSoldRows');
  const rows = Array.from(wrap.querySelectorAll('.stock-row'));
  const emptyRow = rows.find(r => !r.querySelector('.itemsold-item').value.trim());
  if(emptyRow){
    emptyRow.querySelector('.itemsold-item').value = name;
    emptyRow.querySelector('.itemsold-qty').focus();
  } else {
    addItemSoldRow(name);
  }
}

/* ============================= PROMOTER: SUBMIT HOURLY ============================= */
document.getElementById('submitHourlyBtn').onclick = async ()=>{
  const itemsSold = Array.from(document.querySelectorAll('#itemsSoldRows .stock-row')).map(r=>({
    item: r.querySelector('.itemsold-item').value,
    qty: r.querySelector('.itemsold-qty').value
  })).filter(r=>r.item.trim());
  const payload = {
    location: session.location, promoter: session.name,
    footfall: document.getElementById('h_footfall').value || 0,
    activity: document.getElementById('h_activity').value,
    itemsSold,
    lowStock: !!hourlyLow,
    issues: document.getElementById('h_issues').value,
    comments: document.getElementById('h_comments').value
  };
  await api('/hourly', { method:'POST', body: JSON.stringify(payload) });
  showToast('Hourly update submitted');
  ['h_footfall','h_activity','h_issues','h_comments'].forEach(id=>document.getElementById(id).value='');
  renderItemsSoldRows(1);
  hourlyLow=null; document.getElementById('h_lowYes').className=''; document.getElementById('h_lowNo').className='';
  renderMyLog();
};

/* ============================= PROMOTER: SUBMIT INVENTORY ============================= */
document.getElementById('submitInventoryBtn').onclick = async ()=>{
  const rows = Array.from(document.querySelectorAll('#stockRows .stock-row')).map(r=>({
    item: r.querySelector('.stock-item').value,
    qty: r.querySelector('.stock-qty').value
  })).filter(r=>r.item.trim());
  const payload = {
    location: session.location, promoter: session.name,
    stock: rows,
    missing: document.getElementById('i_missing').value,
    oos: document.getElementById('i_oos').value,
    lowStockAlert: !!invLow
  };
  await api('/inventory', { method:'POST', body: JSON.stringify(payload) });
  showToast('Inventory report submitted');
  document.getElementById('i_missing').value=''; document.getElementById('i_oos').value='';
  renderStockRows(1);
  invLow=null; document.getElementById('i_lowYes').className=''; document.getElementById('i_lowNo').className='';
  renderMyLog();
};

/* ============================= PROMOTER: SUBMIT EOD ============================= */
document.getElementById('submitEodBtn').onclick = async ()=>{
  const payload = {
    location: session.location, promoter: session.name,
    sales: document.getElementById('e_sales').value || 0,
    samples: document.getElementById('e_samples').value || 0,
    inventory: document.getElementById('e_inventory').value,
    flavours: document.getElementById('e_flavours').value,
    summary: document.getElementById('e_summary').value,
    feedback: document.getElementById('e_feedback').value
  };
  await api('/eod', { method:'POST', body: JSON.stringify(payload) });
  showToast('End of Day report submitted');
  renderMyLog();
};

/* ============================= PROMOTER: MY LOG ============================= */
async function renderMyLog(){
  if(!session) return;
  const state = await getPromoterState(session.location);
  const d = state.data;
  const items = [];
  (d.attendance||[]).filter(a=>a.date===todayStr() && a.name===session.name).forEach(a=>{
    items.push({type:'Check-in', ts:a.checkinTs});
    if(a.checkoutTs) items.push({type:'Check-out', ts:a.checkoutTs});
  });
  (d.hourlyUpdates||[]).filter(u=>isToday(u.ts) && u.promoter===session.name).forEach(u=>items.push({type:'Hourly Update', ts:u.ts}));
  (d.inventoryReports||[]).filter(u=>isToday(u.ts) && u.promoter===session.name).forEach(u=>items.push({type:'Inventory Report', ts:u.ts}));
  if(d.eod && d.eod.date===todayStr() && d.eod.promoter===session.name) items.push({type:'End of Day Report', ts:d.eod.ts});
  items.sort((a,b)=>b.ts-a.ts);
  document.getElementById('myLog').innerHTML = items.length ? items.map(i=>`
    <div class="log-item"><span class="l-type">${i.type}</span><span class="l-time">${fmtTime(i.ts)}</span></div>
  `).join('') : '<p class="empty-note">Nothing submitted yet today.</p>';
}

/* ============================= INIT ============================= */
(async function init(){
  await populateLocationSelect();
  renderManager();
  setInterval(()=>{ if(!document.getElementById('managerView').classList.contains('hidden') && authToken) renderManager(); }, 6000);
})();