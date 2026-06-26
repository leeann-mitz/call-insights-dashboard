/* app.js — main application orchestrator */
const App = (() => {

  const PERIODS = [
    {id:'all_time', label:'All Time'},
    {id:'today',    label:'Today'},
    {id:'yesterday',label:'Yesterday'},
    {id:'this_week',label:'This Week'},
    {id:'last_week',label:'Last Week'},
    {id:'this_month',label:'This Month'},
    {id:'last_month',label:'Last Month'},
  ];

  const OUTCOME_COLORS = {
    'Sale':'#22c55e','Appointment Set':'#3b82f6','Saved':'#a855f7',
    'No Interest':'#dc2626','Refund':'#ea580c','Voicemail':'#B3AAA3',
    'Callback':'#ca8a04','Transferred':'#0891b2','Disconnected':'#6b7280',
  };
  const OUTCOME_BADGE = {
    'Sale':'badge-sale','Appointment Set':'badge-appt','Saved':'badge-saved',
    'No Interest':'badge-no-int','Refund':'badge-refund','Voicemail':'badge-voicemail','Callback':'badge-callback',
  };

  const state = {
    all: [],
    filtered: [],
    prev: [],
    period: 'all_time',
    filters: { lob:'', leader:'', agent:'' },
    sort: { col:'avgQA', dir:'desc' },
  };

  // ── Init ─────────────────────────────────────────────────
  async function init() {
    try {
      const res = await fetch('data/calls.json');
      const d   = await res.json();
      state.all = d.calls || [];
    } catch(e) {
      console.error('Could not load calls.json', e);
      state.all = [];
    }
    bindEvents();
    buildPeriodTabs();
    applyFilters();
  }

  // ── Filter pipeline ──────────────────────────────────────
  function applyFilters() {
    state.filtered = Analytics.filter(state.all, state.period, state.filters);
    const {start:ps, end:pe} = Analytics.getPrevRange(state.period);
    state.prev = ps ? state.all.filter(c => {
      const d = Analytics.parseDate(c.callDate);
      if (d < ps || d > pe) return false;
      if (state.filters.lob    && c.lob        !== state.filters.lob)    return false;
      if (state.filters.leader && c.teamLeader !== state.filters.leader) return false;
      if (state.filters.agent  && c.agent      !== state.filters.agent)  return false;
      return true;
    }) : [];
    render();
  }

  // ── Master render ────────────────────────────────────────
  function render() {
    updatePeriodTabs();
    populateDropdowns();
    renderKPIs();
    renderOutcomes();
    renderSnapshot();
    renderDeclines();
    renderObjections();
    renderRepTable();
    renderWhatsHappening();
    renderTopPerformers();
    renderPhrases();
    renderWoW();
    renderOpportunities();
    renderActions();
    updateSectionNav();
  }

  // ── Period tabs ──────────────────────────────────────────
  function buildPeriodTabs() {
    const counts = Analytics.periodCounts(state.all);
    const wrap = $('#period-tabs');
    if (!wrap) return;
    wrap.innerHTML = PERIODS.map(p =>
      `<button class="period-tab${p.id===state.period?' active':''}" data-period="${p.id}">
        ${p.label}${counts[p.id] !== undefined ? ` <span style="font-size:.62rem;opacity:.6;font-family:var(--mono)">(${counts[p.id]})</span>` : ''}
      </button>`
    ).join('');
    wrap.querySelectorAll('.period-tab').forEach(btn =>
      btn.addEventListener('click', () => { state.period = btn.dataset.period; applyFilters(); })
    );
  }

  function updatePeriodTabs() {
    const counts = Analytics.periodCounts(state.all);
    $('#period-tabs')?.querySelectorAll('.period-tab').forEach(btn => {
      const p = btn.dataset.period;
      btn.classList.toggle('active', p === state.period);
      const span = btn.querySelector('span');
      if (span && counts[p] !== undefined) span.textContent = `(${counts[p]})`;
    });
  }

  // ── Dropdowns ────────────────────────────────────────────
  function populateDropdowns() {
    fillSelect('filter-lob',    Analytics.uniq(state.all,'lob'),        'LOB',         state.filters.lob);
    fillSelect('filter-leader', Analytics.uniq(state.all,'teamLeader'), 'Team Leader', state.filters.leader);
    fillSelect('filter-agent',  Analytics.uniq(state.filtered,'agent'), 'Member',      state.filters.agent);
  }

  function fillSelect(id, vals, label, current) {
    const el = $(`#${id}`); if (!el) return;
    el.innerHTML = `<option value="">All ${label}s</option>` +
      vals.map(v=>`<option value="${esc(v)}"${v===current?' selected':''}>${esc(v)}</option>`).join('');
  }

  // ── 1. KPI Cards ─────────────────────────────────────────
  function renderKPIs() {
    const k    = Analytics.kpis(state.filtered, state.prev.length?state.prev:null);
    const spark = Analytics.sparkData(state.filtered, state.all);

    const cards = [
      { id:'kpi-total',    label:'Total Calls',     value:k.total,                  trend:k.totalTrend,   suffix:'',    mono:true },
      { id:'kpi-connected',label:'Connected',        value:k.connected,              trend:null,           suffix:'',    mono:true },
      { id:'kpi-conv',     label:'Conversion Rate',  value:`${k.convRate}%`,         trend:k.convTrend,    suffix:'',    mono:false },
      { id:'kpi-qa',       label:'Avg QA Score',     value:`${k.avgQA}`,             trend:k.qaTrend,      suffix:'/100',mono:false },
      { id:'kpi-dur',      label:'Avg Duration',     value:k.avgDur,                 trend:k.durTrend,     suffix:'',    mono:true  },
      { id:'kpi-sales',    label:'Sales',             value:k.sales,                  trend:k.salesTrend,   suffix:'',    mono:true  },
      { id:'kpi-appts',    label:'Appointments Set',  value:k.appts,                  trend:k.apptsTrend,   suffix:'',    mono:true  },
      { id:'kpi-decline',  label:'Decline Rate',      value:`${k.declRate}%`,         trend:k.declineTrend, suffix:'',    mono:false, invertGood:true },
    ];

    cards.forEach(c => {
      const el = $(`#${c.id}`); if (!el) return;
      el.querySelector('.kpi-label').textContent = c.label;
      const vEl = el.querySelector('.kpi-value');
      vEl.textContent = c.value;
      if (c.suffix) vEl.innerHTML += `<span style="font-size:.6em;opacity:.5;font-weight:600"> ${c.suffix}</span>`;
      el.querySelector('.kpi-trend').innerHTML = trendHtml(c.trend, c.invertGood);
      el.querySelector('.kpi-compare').textContent = state.prev.length ? 'vs prior period' : '';
      const sparkEl = el.querySelector('.kpi-spark');
      if (sparkEl) sparkEl.innerHTML = makeSpark(spark);
    });
  }

  function makeSpark(data) {
    if (!data || !data.length) return '';
    const max = Math.max(...data, 1);
    const W=72, H=24, pts = data.map((v,i)=>{
      const x = Math.round(i/(data.length-1||1)*W);
      const y = Math.round(H - (v/max)*H);
      return `${x},${y}`;
    }).join(' ');
    return `<svg class="sparkline" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <polyline points="${pts}" fill="none" stroke="var(--orange)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity=".6"/>
    </svg>`;
  }

  // ── 2. Call Outcomes ─────────────────────────────────────
  function renderOutcomes() {
    const el = $('#outcomes-list'); if (!el) return;
    const data = Analytics.outcomes(state.filtered);
    const total = state.filtered.length;
    if (!data.length) { el.innerHTML = `<div class="empty">No call data for this period.</div>`; return; }
    el.innerHTML = data.map(o => `
      <div class="outcome-row">
        <div class="outcome-label">${esc(o.outcome)}</div>
        <div class="outcome-bar-wrap">
          <div class="outcome-bar" style="width:${o.pct}%;background:${OUTCOME_COLORS[o.outcome]||'#ccc'}"></div>
        </div>
        <div class="outcome-count" style="color:${OUTCOME_COLORS[o.outcome]||'var(--text)'}">${o.count}</div>
        <div class="outcome-pct">${o.pct}%</div>
      </div>`).join('');
    const convEl = $('#outcomes-conv');
    if (convEl) {
      const conv = Analytics.kpis(state.filtered).convRate;
      convEl.innerHTML = `<span style="font-size:1.6rem;font-weight:900;letter-spacing:-.04em">${conv}%</span> <span class="t-label" style="display:block;margin-top:2px">Conversion Rate</span>`;
    }
  }

  // ── 3. Call Snapshot ─────────────────────────────────────
  function renderSnapshot() {
    const el = $('#snapshot-body'); if (!el) return;
    el.innerHTML = Insights.callSnapshot(state.filtered, state.prev.length?state.prev:null, state.period);
  }

  // ── 4. Decline Reasons ───────────────────────────────────
  function renderDeclines() {
    const el = $('#decline-list'); if (!el) return;
    const data = Analytics.declineReasons(state.filtered, state.prev.length?state.prev:null);
    if (!data.length) { el.innerHTML = `<div class="empty">No decline data for this period.</div>`; return; }
    el.innerHTML = data.map(d => `
      <div class="decline-row">
        <div class="decline-label">${esc(d.reason)}</div>
        <div class="decline-count">${d.count}</div>
        <div class="decline-pct">${d.pct}%</div>
        <div>${trendHtml(d.trend, true)}</div>
      </div>`).join('');
  }

  // ── 5. Objections ────────────────────────────────────────
  function renderObjections() {
    const el = $('#objections-grid'); if (!el) return;
    const data = Analytics.objections(state.filtered, state.prev.length?state.prev:null);
    if (!data.length) { el.innerHTML = `<div class="empty">No objection data for this period.</div>`; return; }
    el.innerHTML = data.map(o => `
      <div class="objection-card">
        <div class="obj-head">
          <div class="obj-theme">${esc(o.theme)}</div>
          <div class="obj-freq">${o.count}×</div>
        </div>
        <div class="obj-trend">${trendHtml(o.trend, true)} <span class="t-mono" style="font-size:.68rem;color:var(--stone)">vs prior period</span></div>
        <div class="obj-tip">${esc(o.tip)}</div>
      </div>`).join('');
  }

  // ── 6. Rep Performance ───────────────────────────────────
  function renderRepTable() {
    const tbody = $('#rep-tbody'); if (!tbody) return;
    const data = Analytics.repStats(state.filtered);
    if (!data.length) { tbody.innerHTML = `<tr><td colspan="9"><div class="empty">No rep data for this period.</div></td></tr>`; return; }
    const sorted = [...data].sort((a,b) => {
      const av = a[state.sort.col] ?? '', bv = b[state.sort.col] ?? '';
      const dir = state.sort.dir === 'asc' ? 1 : -1;
      return typeof av === 'number' ? (av-bv)*dir : String(av).localeCompare(String(bv))*dir;
    });
    tbody.innerHTML = sorted.map(r => {
      const tierCls = r.avgQA>=80?'rep-green':r.avgQA>=65?'rep-yellow':'rep-red';
      const dotCls  = r.avgQA>=80?'tier-green':r.avgQA>=65?'tier-yellow':'tier-red';
      const qaCls   = r.avgQA>=80?'qa-high':r.avgQA>=65?'qa-mid':'qa-low';
      return `<tr class="${tierCls}" data-agent="${esc(r.agent)}" title="Click to view ${esc(r.agent)}'s calls" style="cursor:pointer">
        <td class="td-rep"><span class="tier-dot ${dotCls}"></span>${esc(r.agent)}</td>
        <td class="td-lob">${esc(r.lob)}</td>
        <td class="td-mono">${r.calls}</td>
        <td class="td-mono">${r.conv}%</td>
        <td class="td-mono ${qaCls}">${r.avgQA}</td>
        <td class="td-mono">${r.sales}</td>
        <td class="td-mono">${r.appts}</td>
        <td class="td-mono">${r.avgDur}</td>
        <td><span class="${r.priorityCls}">${esc(r.priority)}</span></td>
      </tr>`;
    }).join('');
    // Row click → drill-down
    $('#rep-tbody')?.querySelectorAll('tr[data-agent]').forEach(row => {
      row.addEventListener('click', () => openRepModal(row.dataset.agent));
    });
    updateSortHeaders();
  }

  function updateSortHeaders() {
    $$('.rep-th').forEach(th => {
      th.classList.toggle('sorted', th.dataset.col === state.sort.col);
      const arrow = th.dataset.col === state.sort.col ? (state.sort.dir==='asc'?' ↑':' ↓') : '';
      th.querySelector('.th-label').textContent = th.dataset.label + arrow;
    });
  }

  // ── 7. What's Happening ──────────────────────────────────
  function renderWhatsHappening() {
    const el = $('#happening-list'); if (!el) return;
    const items = Insights.whatIsHappening(state.filtered);
    el.innerHTML = items.map(i => `
      <div class="coaching-item">
        <div class="coaching-icon">${i.icon}</div>
        <div class="coaching-body"><h4>${esc(i.title)}</h4><p>${esc(i.text)}</p></div>
      </div>`).join('');
  }

  // ── 8. Top Performers ────────────────────────────────────
  function renderTopPerformers() {
    const el = $('#performers-list'); if (!el) return;
    const items = Insights.topPerformerBehaviors(state.filtered);
    if (!items.length) { el.innerHTML = `<div class="empty">Not enough rep data to compare performance patterns.</div>`; return; }
    el.innerHTML = items.map(i => `
      <div class="coaching-item">
        <div class="coaching-icon">${i.icon}</div>
        <div class="coaching-body"><h4>${esc(i.title)}</h4><p>${esc(i.text)}</p></div>
      </div>`).join('');
  }

  // ── 9. Phrases ───────────────────────────────────────────
  function renderPhrases() {
    const el = $('#phrases-wrap'); if (!el) return;
    const d = Analytics.phrases(state.filtered);
    const commonHtml = d.common.length ? d.common.map(([p,n]) => `
      <div class="phrase-item">
        <div class="phrase-quote">"${esc(p)}"</div>
        <div class="phrase-count">${n}×</div>
      </div>`).join('') : '<div class="empty" style="text-align:left">No phrases recorded this period.</div>';
    const altHtml = d.overused.length ? d.overused.map(p => `
      <div class="phrase-alt">
        <div class="phrase-overused">"${esc(p)}"</div>
        <div class="phrase-better">${d.better[p]||'—'}</div>
      </div>`).join('') : '<p class="t-body">No overused phrases flagged this period.</p>';
    el.innerHTML = `
      <div class="phrase-grid">
        <div class="phrase-col">
          <h4>Most Used Phrases</h4>${commonHtml}
        </div>
        <div class="phrase-col">
          <h4>Suggested Improvements</h4>${altHtml}
        </div>
      </div>`;
  }

  // ── 10. WoW ──────────────────────────────────────────────
  function renderWoW() {
    const el = $('#wow-grid'); if (!el) return;
    const rows = Analytics.wowRows(state.filtered, state.prev.length?state.prev:null);
    const thisLabel = Analytics.getRangeLabel(state.period);
    const {start:ps} = Analytics.getPrevRange(state.period);
    const prevLabel = ps ? `Prior Period` : '—';
    el.innerHTML = rows.map(r => `
      <div class="wow-card">
        <div class="wow-label">${esc(r.label)}</div>
        <div class="wow-row">
          <span class="wow-week">${esc(thisLabel)}</span>
          <span class="wow-val wow-this">${esc(r.cur)}</span>
        </div>
        <div class="wow-row">
          <span class="wow-week">${prevLabel}</span>
          <span class="wow-val wow-last">${esc(r.prev_val)}</span>
        </div>
        <div class="wow-delta">${trendHtml(r.trend, r.invertGood)}</div>
      </div>`).join('');
  }

  // ── 11. Opportunities ────────────────────────────────────
  function renderOpportunities() {
    const el = $('#opp-list'); if (!el) return;
    const data = Insights.topOpportunities(state.filtered, state.prev.length?state.prev:null);
    el.innerHTML = data.map((o,i) => `
      <div class="opp-card">
        <div class="opp-rank ${i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':''}">${i+1}</div>
        <div class="opp-body">
          <h4>${esc(o.title)}</h4>
          <p>${esc(o.why)}</p>
          <div class="action-meta" style="margin-top:8px">
            <span class="opp-impact">📈 ${esc(o.impact)}</span>
          </div>
        </div>
      </div>`).join('');
  }

  // ── 12. Priority Actions ─────────────────────────────────
  function renderActions() {
    const el = $('#actions-wrap'); if (!el) return;
    const d = Insights.priorityActions(state.filtered, state.prev.length?state.prev:null);
    let html = '';
    const levels = [
      {key:'high', label:'High Priority', cls:'priority-high-label', dot:'action-dot-high'},
      {key:'medium',label:'Medium Priority',cls:'priority-med-label', dot:'action-dot-med'},
      {key:'low',  label:'Low Priority',  cls:'priority-low-label',  dot:'action-dot-low'},
    ];
    levels.forEach(lvl => {
      if (!d[lvl.key]?.length) return;
      html += `<div class="action-priority-label ${lvl.cls}">${lvl.label}</div>`;
      html += d[lvl.key].map(a => `
        <div class="action-card">
          <div class="action-dot ${lvl.dot}"></div>
          <div class="action-body">
            <h4>${esc(a.title)}</h4>
            <p class="t-body" style="margin-bottom:4px">${esc(a.why)}</p>
            <div class="action-meta">
              <span class="action-chip"><strong>Impact:</strong> ${esc(a.impact)}</span>
              <span class="action-chip"><strong>Activity:</strong> ${esc(a.activity)}</span>
            </div>
          </div>
        </div>`).join('');
    });
    el.innerHTML = html;
  }

  // ── Section nav active state ─────────────────────────────
  function updateSectionNav() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const id = e.target.id;
        const btn = $(`.snav-item[data-section="${id}"]`);
        if (btn) btn.classList.toggle('active', e.isIntersecting);
      });
    }, { rootMargin:'-40% 0px -55% 0px' });
    $$('.section[id]').forEach(s => observer.observe(s));
  }

  // ── Rep Drill-Down Modal ─────────────────────────────────
  function openRepModal(agentName) {
    const calls  = state.filtered.filter(c => c.agent === agentName);
    const stats  = Analytics.repStats(calls)[0];
    if (!calls.length || !stats) return;

    $('#modal-rep-name').textContent = agentName;
    $('#modal-rep-meta').textContent = `${stats.lob} · ${stats.teamLeader}`;

    const qaCls = stats.avgQA>=80?'qa-high':stats.avgQA>=65?'qa-mid':'qa-low';
    $('#modal-stats').innerHTML = [
      { label:'Calls',       val: stats.calls },
      { label:'Avg QA',      val: `<span class="${qaCls}">${stats.avgQA}/100</span>` },
      { label:'Conversion',  val: `${stats.conv}%` },
      { label:'Sales',       val: stats.sales },
      { label:'Appointments',val: stats.appts },
      { label:'Avg Duration',val: stats.avgDur },
      { label:'Script Adh.', val: stats.avgScript ? `${stats.avgScript}/100` : '—' },
    ].map(s => `
      <div class="modal-stat">
        <div class="modal-stat-label">${s.label}</div>
        <div class="modal-stat-value">${s.val}</div>
      </div>`).join('');

    const sorted = [...calls].sort((a,b) => new Date(b.callDate) - new Date(a.callDate));
    $('#modal-body').innerHTML = sorted.map(c => {
      const oc = OUTCOME_COLORS[c.outcome] || '#7A7068';
      const gaps = (c.scriptGaps||[]).map(g => `<span class="modal-gap-tag">${esc(g)}</span>`).join('');
      const strengths = (c.strengths||[]).slice(0,2).map(s => `<span class="modal-strength-tag">${esc(s)}</span>`).join('');
      const qaStyle = c.qaScore>=80?'color:#22c55e':c.qaScore>=65?'color:#eab308':'color:#ef4444';
      const listenBtn = c.callLink
        ? `<a href="${esc(c.callLink)}" target="_blank" rel="noopener" class="modal-listen-btn">▶ Listen</a>`
        : `<span class="modal-listen-btn modal-listen-disabled" title="No recording link yet — add callLink to calls.json">▶ Listen</span>`;
      return `<div class="modal-call">
        <div class="modal-call-top">
          <div>
            <div class="modal-call-member">${esc(c.member||'Unknown Member')}</div>
            <div class="modal-call-lob">${esc(c.lob)} · ${esc(c.callDate)}</div>
          </div>
          <div style="font-family:var(--mono);font-size:.78rem;font-weight:700;${qaStyle}">${c.qaScore!=null?c.qaScore+'/100':'—'}</div>
          <div style="font-family:var(--mono);font-size:.78rem;color:var(--text-3)">${esc(c.duration||'—')}</div>
          <span class="badge" style="background:${oc}22;color:${oc};border:1px solid ${oc}44">${esc(c.outcome)}</span>
          ${listenBtn}
        </div>
        ${c.summary ? `<div class="modal-call-summary">${esc(c.summary)}</div>` : ''}
        ${strengths||gaps ? `<div class="modal-call-gaps">${strengths}${gaps}</div>` : ''}
      </div>`;
    }).join('');

    $('#rep-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeRepModal() {
    $('#rep-modal').classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Events ───────────────────────────────────────────────
  function bindEvents() {
    $('#filter-lob')?.addEventListener('change', e=>{state.filters.lob=e.target.value;applyFilters();});
    $('#filter-leader')?.addEventListener('change',e=>{state.filters.leader=e.target.value;applyFilters();});
    $('#filter-agent')?.addEventListener('change', e=>{state.filters.agent=e.target.value;applyFilters();});

    // Modal close
    $('#modal-close-btn')?.addEventListener('click', closeRepModal);
    $('#rep-modal')?.addEventListener('click', e => { if (e.target===e.currentTarget) closeRepModal(); });
    document.addEventListener('keydown', e => { if (e.key==='Escape') closeRepModal(); });

    // Sortable table headers
    $$('.rep-th').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (state.sort.col === col) state.sort.dir = state.sort.dir==='asc'?'desc':'asc';
        else { state.sort.col = col; state.sort.dir = 'desc'; }
        renderRepTable();
      });
    });

    // Section nav clicks
    $$('.snav-item[data-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = $(`#${btn.dataset.section}`);
        if (target) target.scrollIntoView({behavior:'smooth'});
      });
    });
  }

  // ── Helpers ──────────────────────────────────────────────
  function esc(s) {
    if (s==null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function trendHtml(pct, invertGood=false) {
    if (pct===null||pct===undefined) return '';
    const good = invertGood ? pct<0 : pct>0;
    const cls  = pct===0?'trend-flat':good?'trend-up':'trend-down';
    const arrow = pct===0?'→':pct>0?'↑':'↓';
    return `<span class="trend ${cls}">${arrow} ${Math.abs(pct)}%</span>`;
  }
  function $(sel) { return document.querySelector(sel); }
  function $$(sel){ return document.querySelectorAll(sel); }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
