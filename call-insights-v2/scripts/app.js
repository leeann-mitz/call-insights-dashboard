/* app.js — main application */

const App = (() => {

  const PERIODS = [
    { id: 'today',        label: 'Today'       },
    { id: 'yesterday',    label: 'Yesterday'   },
    { id: 'this_week',    label: 'This Week'   },
    { id: 'last_week',    label: 'Last Week'   },
    { id: 'this_month',   label: 'This Month'  },
    { id: 'last_month',   label: 'Last Month'  },
    { id: 'last_90_days', label: 'Last 90 Days'},
    { id: 'this_year',    label: 'This Year'   },
    { id: 'all_time',     label: 'All Time'    },
  ];

  const state = {
    calls:    [],
    filtered: [],
    period:   'all_time',
    filters:  { agent:'', lob:'', outcome:'', product:'', minQA:'', keyword:'' },
  };

  /* ── Bootstrap ──────────────────────────────────────────── */
  async function init() {
    try {
      const res  = await fetch('data/calls.json');
      const data = await res.json();
      state.calls = data.calls || [];
    } catch (e) {
      console.error('Failed to load calls.json:', e);
      state.calls = [];
    }
    bindEvents();
    applyFilters();
  }

  /* ── Filter pipeline ────────────────────────────────────── */
  function applyFilters() {
    state.filtered = Analytics.filter(state.calls, state.period, state.filters);
    render();
  }

  /* ── Render ─────────────────────────────────────────────── */
  function render() {
    renderSidebar();
    renderHeader();
    renderKPIs();
    Charts.updateAll(state.filtered, state.period);
    renderInsights();
    renderTable();
    populateDropdowns();
  }

  /* Sidebar — period list + counts */
  function renderSidebar() {
    const counts = Analytics.periodCounts(state.calls);
    const list   = document.getElementById('period-list');
    if (!list) return;

    list.querySelectorAll('.period-item').forEach(li => {
      const p = li.dataset.period;
      li.classList.toggle('active', p === state.period);
      const countEl = li.querySelector('.count');
      if (countEl) countEl.textContent = (counts[p] ?? 0).toLocaleString();
    });

    // Reflect dropdown filters
    ['agent','lob','outcome'].forEach(f => {
      const el = document.getElementById(`filter-${f}`);
      if (el) el.value = state.filters[f];
    });
    const qa = document.getElementById('filter-qa-min');
    if (qa) { qa.value = state.filters.minQA || 0; document.getElementById('qa-min-label').textContent = state.filters.minQA || 0; }
    const kw = document.getElementById('sidebar-keyword');
    if (kw) kw.value = state.filters.keyword;
  }

  function renderHeader() {
    const label = PERIODS.find(p => p.id === state.period)?.label || 'All Time';
    const el = document.getElementById('period-title');
    if (el) el.textContent = label;
    const sub = document.getElementById('period-subtitle');
    if (sub) sub.textContent = `${state.filtered.length.toLocaleString()} call${state.filtered.length !== 1 ? 's' : ''} — Performance Golf Analytics`;
  }

  /* KPI Cards */
  function renderKPIs() {
    const { start } = Analytics.getRange(state.period);
    const prevCalls = start ? Analytics.filter(state.calls, state.period, {...state.filters, _usePrev: true}) : null;
    const { start: ps, end: pe } = Analytics.getPrevRange(state.period);
    const prev = ps ? state.calls.filter(c => {
      const d = new Date(c.callDate.split('-')[0], c.callDate.split('-')[1]-1, c.callDate.split('-')[2]);
      if (d < ps || d > pe) return false;
      if (state.filters.agent && c.agent !== state.filters.agent) return false;
      if (state.filters.lob && c.lob !== state.filters.lob) return false;
      if (state.filters.outcome && c.outcome !== state.filters.outcome) return false;
      return true;
    }) : null;

    const kpi = Analytics.kpis(state.filtered, prev);

    setKPI('kpi-total',   kpi.total.toLocaleString(),   trendHtml(kpi.totalTrend),   'vs prior period');
    setKPI('kpi-qa',      `${kpi.avgQA}/100`,            trendHtml(kpi.avgQATrend),   'QA average');
    setKPI('kpi-close',   `${kpi.closeRate}%`,           trendHtml(kpi.closeRateTrend),'close rate');
    setKPI('kpi-booking', `${kpi.bookRate}%`,            trendHtml(kpi.bookRateTrend), 'booking rate');
    setKPI('kpi-save',    `${kpi.saveRate}%`,            '',                            'retention save rate');
    setKPI('kpi-dur',     kpi.avgDur,                    trendHtml(kpi.avgDurTrend, true), 'avg call duration');
  }

  function setKPI(id, value, trendEl, compare) {
    const card = document.getElementById(id);
    if (!card) return;
    card.querySelector('.kpi-value').textContent = value;
    card.querySelector('.kpi-trend').innerHTML   = trendEl;
    card.querySelector('.kpi-compare').textContent = compare;
  }

  function trendHtml(pct, invertGood = false) {
    if (pct === null || pct === undefined) return '';
    const good = invertGood ? pct < 0 : pct > 0;
    const cls  = pct === 0 ? 'trend-flat' : good ? 'trend-up' : 'trend-down';
    const arrow = pct === 0 ? '→' : pct > 0 ? '↑' : '↓';
    return `<span class="trend ${cls}">${arrow} ${Math.abs(pct)}%</span>`;
  }

  /* AI Insights */
  function renderInsights() {
    const grid = document.getElementById('insights-grid');
    if (!grid) return;
    const items = Analytics.insights(state.filtered);
    grid.innerHTML = items.map(i => `
      <div class="insight-card">
        <div class="insight-icon">${i.icon}</div>
        <div class="insight-body">
          <h4>${esc(i.title)}</h4>
          <p>${esc(i.text)}</p>
        </div>
      </div>`).join('');
  }

  /* Call Table */
  function renderTable() {
    const body = document.getElementById('call-table-body');
    const lbl  = document.getElementById('call-count-label');
    if (!body) return;

    if (lbl) lbl.textContent = `${state.filtered.length.toLocaleString()} call${state.filtered.length !== 1 ? 's' : ''}`;

    if (!state.filtered.length) {
      body.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>No calls match the current filters.</p></div></td></tr>`;
      return;
    }

    const sorted = [...state.filtered].sort((a,b) => b.callDate.localeCompare(a.callDate));
    body.innerHTML = sorted.map((c, i) => `
      <tr data-idx="${i}" class="call-row">
        <td class="td-date">${c.callDate}</td>
        <td class="td-agent">${esc(c.agent || '—')}</td>
        <td class="td-member">${esc(c.member || '—')}</td>
        <td>${esc(c.lob || '—')}</td>
        <td class="td-dur mono">${esc(c.duration || '—')}</td>
        <td class="${qaClass(c.qaScore)} mono">${c.qaScore != null ? c.qaScore : '—'}</td>
        <td><span class="badge ${outcomeBadge(c.outcome)}">${esc(c.outcome || '—')}</span></td>
      </tr>`).join('');

    body.querySelectorAll('.call-row').forEach(row => {
      row.addEventListener('click', () => openModal(sorted[row.dataset.idx]));
    });
  }

  /* Dropdowns */
  function populateDropdowns() {
    const allCalls = state.calls;
    populate('filter-lob',     Analytics.uniq(allCalls, 'lob'),     'LOB');
    populate('filter-agent',   Analytics.uniq(allCalls, 'agent'),   'Agent');
    populate('filter-outcome', Analytics.uniq(allCalls, 'outcome'), 'Outcome');
  }

  function populate(id, vals, label) {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">All ${label}s</option>` +
      vals.map(v => `<option value="${esc(v)}"${v===cur?' selected':''}>${esc(v)}</option>`).join('');
  }

  /* ── Modal ──────────────────────────────────────────────── */
  function openModal(call) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <h2>${esc(call.agent)} → ${esc(call.member || 'Unknown')}</h2>
            <p style="margin-top:3px">${esc(call.lob || '')} · ${esc(call.callDate)}</p>
          </div>
          <button class="modal-close" id="modal-close-btn" aria-label="Close">✕</button>
        </div>
        <div class="modal-meta">
          <div class="meta-chip"><strong>${call.duration || '—'}</strong></div>
          <div class="meta-chip"><span class="badge ${outcomeBadge(call.outcome)}">${esc(call.outcome)}</span></div>
          <div class="meta-chip">QA <strong class="${qaClass(call.qaScore)}">${call.qaScore != null ? call.qaScore+'/100' : '—'}</strong></div>
          ${call.product ? `<div class="meta-chip">${esc(call.product)}</div>` : ''}
          ${call.location ? `<div class="meta-chip">📍 ${esc(call.location)}</div>` : ''}
          ${call.revenue ? `<div class="meta-chip">💰 ${call.revenue > 0 ? '+' : ''}$${call.revenue.toLocaleString()}</div>` : ''}
        </div>
        <div class="modal-body">
          ${call.summary ? `<div class="detail-section"><h4>Summary</h4><p>${esc(call.summary)}</p></div>` : ''}
          ${listSection('Strengths',     call.strengths)}
          ${listSection('Opportunities', call.opportunities)}
          ${listSection('Objections',    call.objections)}
          ${listSection('Recommendations', call.recommendations)}
          ${call.tags?.length ? `<div class="detail-section"><h4>Tags</h4><p>${call.tags.map(t=>`<span style="background:#ECE9E4;padding:2px 8px;border-radius:99px;font-size:0.7rem;margin-right:4px">${esc(t)}</span>`).join('')}</p></div>` : ''}
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);
    document.addEventListener('keydown', onEsc);
  }

  function closeModal() {
    const el = document.getElementById('modal-overlay');
    if (el) el.remove();
    document.removeEventListener('keydown', onEsc);
  }

  function onEsc(e) { if (e.key === 'Escape') closeModal(); }

  function listSection(title, items) {
    if (!items?.length) return '';
    return `<div class="detail-section">
      <h4>${title}</h4>
      <ul class="detail-list">${items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>
    </div>`;
  }

  /* ── Event Binding ──────────────────────────────────────── */
  function bindEvents() {
    document.getElementById('period-list')?.addEventListener('click', e => {
      const li = e.target.closest('.period-item');
      if (li?.dataset.period) { state.period = li.dataset.period; applyFilters(); }
    });

    ['filter-lob','filter-agent','filter-outcome'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', e => {
        state.filters[id.replace('filter-','')] = e.target.value;
        applyFilters();
      });
    });

    document.getElementById('filter-qa-min')?.addEventListener('input', e => {
      state.filters.minQA = e.target.value;
      document.getElementById('qa-min-label').textContent = e.target.value;
      applyFilters();
    });

    document.getElementById('sidebar-keyword')?.addEventListener('input', e => {
      state.filters.keyword = e.target.value.trim();
      applyFilters();
    });

    document.getElementById('header-search')?.addEventListener('input', e => {
      state.filters.keyword = e.target.value.trim();
      const kw = document.getElementById('sidebar-keyword');
      if (kw) kw.value = state.filters.keyword;
      applyFilters();
    });

    document.getElementById('clear-filters')?.addEventListener('click', () => {
      state.filters = { agent:'', lob:'', outcome:'', product:'', minQA:'', keyword:'' };
      applyFilters();
    });

    // Mobile sidebar toggle
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
  }

  /* ── Helpers ────────────────────────────────────────────── */
  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function qaClass(score) {
    if (score == null) return '';
    if (score >= 80) return 'qa-high';
    if (score >= 60) return 'qa-mid';
    return 'qa-low';
  }

  function outcomeBadge(outcome) {
    const map = {
      'Sale':'badge-sale','Booked':'badge-booked','Saved':'badge-saved',
      'Declined':'badge-declined','Refunded':'badge-refunded','No Contact':'badge-no-contact',
    };
    return map[outcome] || 'badge-no-contact';
  }

  return { init };

})();

document.addEventListener('DOMContentLoaded', () => App.init());
