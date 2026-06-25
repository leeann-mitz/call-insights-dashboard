/* ============================================================
   Call Insights Dashboard — app.js
   All logic: data loading, routing, rendering, filtering
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────
const State = {
  data: null,           // raw JSON from insights.json
  view: 'home',         // current page: 'home' | 'all' | 'detail'
  currentId: null,      // insight id for detail view
  search: '',           // global search query
  filters: {
    period: 'all',      // all | daily | weekly | monthly | yearly
    campaign: '',
    offer: '',
    product: '',
    funnel: '',
    team_member: '',
    call_type: ''
  },
  sort: 'newest'        // newest | oldest
};

// ── Utility ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = {
  date: s => {
    if (!s) return '—';
    const d = new Date(s + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },
  period: s => {
    if (!s) return '—';
    const d = new Date(s + 'T00:00:00');
    const now = new Date();
    const diff = (now - d) / 864e5;
    if (diff < 1) return 'Today';
    if (diff < 2) return 'Yesterday';
    if (diff < 7) return `${Math.floor(diff)}d ago`;
    if (diff < 30) return `${Math.floor(diff/7)}w ago`;
    return fmt.date(s);
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlight(text, query) {
  if (!query || !text) return escapeHtml(text);
  const escaped = escapeHtml(text);
  if (!query.trim()) return escaped;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(re, '<mark>$1</mark>');
}

function getStatusClass(status) {
  if (!status) return 'status-pending';
  const s = status.toLowerCase();
  if (s.includes('complete') || s === 'done') return 'status-completed';
  if (s.includes('progress')) return 'status-in-progress';
  return 'status-pending';
}

function callTypeColor(type) {
  if (!type) return 'tag-neutral';
  const t = type.toLowerCase();
  if (t.includes('close') || t.includes('sales')) return 'tag-cyan';
  if (t.includes('retention') || t.includes('cancel')) return 'tag-amber';
  if (t.includes('appointment') || t.includes('set')) return 'tag-green';
  if (t.includes('inbound')) return 'tag-purple';
  return 'tag-neutral';
}

// ── Data Loading ───────────────────────────────────────────
async function loadData() {
  try {
    // Cache bust with timestamp so GitHub Pages always serves fresh JSON
    const res = await fetch(`insights.json?v=${Date.now()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    State.data = await res.json();
    init();
  } catch (e) {
    console.error('Failed to load data:', e);
    $('content').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>Could not load insights.json<br><small style="color:var(--text-muted)">${escapeHtml(e.message)}</small></p>
      </div>`;
  }
}

// ── Filtering & Search ─────────────────────────────────────
function getFilteredInsights() {
  if (!State.data) return [];
  let list = [...State.data.insights];

  // Period filter
  if (State.filters.period !== 'all') {
    const now = new Date();
    list = list.filter(ins => {
      const d = new Date(ins.date + 'T00:00:00');
      const diff = (now - d) / 864e5;
      if (State.filters.period === 'daily')   return diff < 1;
      if (State.filters.period === 'weekly')  return diff < 7;
      if (State.filters.period === 'monthly') return diff < 30;
      if (State.filters.period === 'yearly')  return diff < 365;
      return true;
    });
  }

  // Field filters
  const fieldMap = {
    campaign: 'campaign', offer: 'offer', product: 'product',
    funnel: 'funnel', team_member: 'team_member', call_type: 'call_type'
  };
  for (const [key, field] of Object.entries(fieldMap)) {
    if (State.filters[key]) {
      list = list.filter(ins => ins[field] === State.filters[key]);
    }
  }

  // Search
  if (State.search.trim()) {
    const q = State.search.toLowerCase();
    list = list.filter(ins => {
      const searchable = [
        ins.title, ins.summary, ins.campaign, ins.offer, ins.product,
        ins.funnel, ins.team_member, ins.call_type,
        ...(ins.main_findings || []),
        ...(ins.customer_objections || []),
        ...(ins.winning_language || []),
        ...(ins.pain_points || []),
        ...(ins.buying_triggers || []),
        ...(ins.opportunities || []),
        ...(ins.recommendations || []),
        ...(ins.tags || []),
        ...(ins.action_items || []).map(a => a.task)
      ].join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }

  // Sort
  list.sort((a, b) => {
    const da = new Date(a.date), db = new Date(b.date);
    return State.sort === 'newest' ? db - da : da - db;
  });

  return list;
}

// ── Build filter option lists from data ───────────────────
function getUnique(field) {
  if (!State.data) return [];
  return [...new Set(State.data.insights.map(i => i[field]).filter(Boolean))].sort();
}

function populateFilterDropdowns() {
  const fields = ['campaign', 'offer', 'product', 'funnel', 'team_member', 'call_type'];
  fields.forEach(field => {
    const sel = $(`filter-${field.replace('_', '-')}`);
    if (!sel) return;
    const vals = getUnique(field);
    const label = field.replace(/_/g, ' ');
    sel.innerHTML = `<option value="">All ${label}s</option>` +
      vals.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    sel.value = State.filters[field] || '';
  });
}

// ── Aggregate stats for homepage ──────────────────────────
function computeStats() {
  const insights = State.data?.insights || [];
  const total = insights.length;

  // Objection frequency
  const objMap = {};
  insights.forEach(ins => {
    (ins.customer_objections || []).forEach(o => {
      objMap[o] = (objMap[o] || 0) + 1;
    });
  });
  const topObjections = Object.entries(objMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Buying trigger frequency
  const trigMap = {};
  insights.forEach(ins => {
    (ins.buying_triggers || []).forEach(t => {
      trigMap[t] = (trigMap[t] || 0) + 1;
    });
  });
  const topTriggers = Object.entries(trigMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Topics from tags
  const tagMap = {};
  insights.forEach(ins => {
    (ins.tags || []).forEach(t => {
      tagMap[t] = (tagMap[t] || 0) + 1;
    });
  });
  const topTopics = Object.entries(tagMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 16);

  // Total action items
  const totalActions = insights.reduce((sum, ins) =>
    sum + (ins.action_items || []).length, 0);

  return { total, topObjections, topTriggers, topTopics, totalActions };
}

// ── Sidebar Navigation Items ──────────────────────────────
function renderNav() {
  const periods = [
    { key: 'all',     label: 'All Time',  icon: '◈' },
    { key: 'daily',   label: 'Today',     icon: '○' },
    { key: 'weekly',  label: 'This Week', icon: '⬡' },
    { key: 'monthly', label: 'This Month', icon: '◇' },
    { key: 'yearly',  label: 'This Year', icon: '△' }
  ];

  const insights = State.data?.insights || [];
  const now = new Date();

  const counts = {
    all:     insights.length,
    daily:   insights.filter(i => (now - new Date(i.date + 'T00:00:00')) / 864e5 < 1).length,
    weekly:  insights.filter(i => (now - new Date(i.date + 'T00:00:00')) / 864e5 < 7).length,
    monthly: insights.filter(i => (now - new Date(i.date + 'T00:00:00')) / 864e5 < 30).length,
    yearly:  insights.filter(i => (now - new Date(i.date + 'T00:00:00')) / 864e5 < 365).length,
  };

  $('nav-periods').innerHTML = periods.map(p => `
    <button class="nav-item ${State.filters.period === p.key && State.view !== 'home' ? 'active' : ''}"
            onclick="navToPeriod('${p.key}')">
      <span class="nav-icon">${p.icon}</span>
      <span>${p.label}</span>
      <span class="nav-count">${counts[p.key]}</span>
    </button>`).join('');

  // Update sidebar last-updated
  const lastUpdated = State.data?.meta?.last_updated || '—';
  const luEl = $('last-updated');
  if (luEl) luEl.textContent = `Updated: ${lastUpdated}`;
}

// ── Render: Homepage ──────────────────────────────────────
function renderHome() {
  State.view = 'home';
  updateBreadcrumb('Home');
  updateSearchBanner();

  const stats  = computeStats();
  const recent = (State.data?.insights || [])
    .slice().sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

  $('content').innerHTML = `
    <div class="fade-in">
      <div class="page-title">Call Intelligence Hub</div>
      <div class="page-subtitle">Performance Golf · Phone Team Analytics</div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Analyzed Calls</div>
          <div class="stat-value cyan" data-target="${stats.total}">0</div>
          <div class="stat-sub">insight records</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Action Items</div>
          <div class="stat-value amber" data-target="${stats.totalActions}">0</div>
          <div class="stat-sub">tracked tasks</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Objections Mapped</div>
          <div class="stat-value green" data-target="${Object.values(stats.topObjections.reduce((a,[k,v]) => ({...a,[k]:v}), {})).reduce((s,v)=>s+v,0) || stats.topObjections.length}">0</div>
          <div class="stat-sub">unique objection types</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Teams Covered</div>
          <div class="stat-value" data-target="${getUnique('team_member').length}">0</div>
          <div class="stat-sub">team segments</div>
        </div>
      </div>

      <div class="section-header">
        <div class="section-title"><span class="section-icon">◈</span> Latest Insights</div>
        <span class="see-all-link" onclick="navToAll()">See all →</span>
      </div>
      <div class="insights-list" style="margin-bottom:32px">
        ${recent.map(ins => renderInsightCard(ins)).join('')}
        ${recent.length === 0 ? '<div class="no-results">No insights yet.</div>' : ''}
      </div>

      <div class="two-col">
        <div>
          <div class="section-title" style="margin-bottom:12px"><span class="section-icon">⚡</span> Top Objections</div>
          <div class="panel-card">
            <div class="chip-list">
              ${stats.topObjections.length ? stats.topObjections.map(([obj, cnt]) => `
                <div class="chip-item">
                  <span>${escapeHtml(obj)}</span>
                  <span class="chip-count">${cnt}</span>
                </div>`).join('') : '<div style="color:var(--text-muted);font-size:12px">No data yet</div>'}
            </div>
          </div>
        </div>
        <div>
          <div class="section-title" style="margin-bottom:12px"><span class="section-icon">▲</span> Buying Triggers</div>
          <div class="panel-card">
            <div class="chip-list">
              ${stats.topTriggers.length ? stats.topTriggers.map(([t, cnt]) => `
                <div class="chip-item">
                  <span>${escapeHtml(t)}</span>
                  <span class="chip-count">${cnt}</span>
                </div>`).join('') : '<div style="color:var(--text-muted);font-size:12px">No data yet</div>'}
            </div>
          </div>
        </div>
      </div>

      <div class="section-header">
        <div class="section-title"><span class="section-icon">◇</span> Topics</div>
      </div>
      <div class="panel-card" style="margin-bottom:32px">
        <div class="topics-cloud">
          ${stats.topTopics.map(([tag]) => `
            <span class="topic-tag" onclick="searchFor('${escapeHtml(tag)}')">${escapeHtml(tag)}</span>`).join('')}
          ${stats.topTopics.length === 0 ? '<span style="color:var(--text-muted);font-size:12px">No topics yet</span>' : ''}
        </div>
      </div>

      <div class="section-header">
        <div class="section-title"><span class="section-icon">▸</span> Recent Recommendations</div>
      </div>
      <div class="panel-card" style="margin-bottom:32px">
        <div class="finding-list">
          ${recent.flatMap(ins => (ins.recommendations || []).slice(0,2).map(r => `
            <div class="finding-item">${escapeHtml(r)}</div>`)).slice(0,8).join('') ||
            '<div style="color:var(--text-muted);font-size:12px">No recommendations yet</div>'}
        </div>
      </div>
    </div>`;

  // Animate counters
  document.querySelectorAll('[data-target]').forEach(el => {
    animateCounter(el, parseInt(el.dataset.target, 10));
  });
}

function animateCounter(el, target) {
  const duration = 800;
  const start = performance.now();
  const update = now => {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(ease * target);
    if (t < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ── Render: All Insights ───────────────────────────────────
function renderAll() {
  State.view = 'all';
  updateBreadcrumb('All Insights');
  updateSearchBanner();

  const list = getFilteredInsights();

  $('content').innerHTML = `
    <div class="fade-in">
      <div class="page-title">All Insights</div>
      <div class="page-subtitle">${list.length} record${list.length !== 1 ? 's' : ''} found</div>

      <div class="filter-bar">
        <span class="filter-bar-label">Sort:</span>
        <button class="sort-btn ${State.sort === 'newest' ? 'active' : ''}"
                onclick="setSort('newest')">Newest first</button>
        <button class="sort-btn ${State.sort === 'oldest' ? 'active' : ''}"
                onclick="setSort('oldest')">Oldest first</button>
        <span class="result-count">${list.length} result${list.length !== 1 ? 's' : ''}</span>
      </div>

      <div class="insights-list">
        ${list.length ? list.map(ins => renderInsightCard(ins)).join('') :
          '<div class="no-results">No insights match your current filters.</div>'}
      </div>
    </div>`;
}

// ── Render: Insight Card (shared) ─────────────────────────
function renderInsightCard(ins) {
  const q = State.search;
  return `
    <div class="insight-card" onclick="navToDetail('${escapeHtml(ins.id)}')">
      <div class="insight-card-date">${fmt.period(ins.date)}</div>
      <div class="insight-card-body">
        <div class="insight-card-title">${highlight(ins.title, q)}</div>
        <div class="insight-card-summary">${highlight(ins.summary, q)}</div>
        <div class="insight-card-meta">
          ${ins.call_type ? `<span class="tag ${callTypeColor(ins.call_type)}">${escapeHtml(ins.call_type)}</span>` : ''}
          ${ins.product ? `<span class="tag tag-neutral">${escapeHtml(ins.product)}</span>` : ''}
          ${ins.team_member ? `<span class="tag tag-neutral">${escapeHtml(ins.team_member)}</span>` : ''}
          ${ins.date ? `<span class="tag tag-neutral">${fmt.date(ins.date)}</span>` : ''}
        </div>
      </div>
      <div class="insight-card-arrow">›</div>
    </div>`;
}

// ── Render: Detail ────────────────────────────────────────
function renderDetail(id) {
  State.view = 'detail';
  State.currentId = id;

  const ins = State.data?.insights?.find(i => i.id === id);
  if (!ins) {
    $('content').innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>Insight not found.</p></div>`;
    return;
  }

  updateBreadcrumb(ins.title);

  const section = (title, colorClass, items, itemClass = '') => {
    if (!items || items.length === 0) return '';
    return `
      <div class="detail-section">
        <div class="detail-section-title ${colorClass}">${title}</div>
        <div class="finding-list">
          ${items.map(item => `<div class="finding-item ${itemClass}">${escapeHtml(item)}</div>`).join('')}
        </div>
      </div>`;
  };

  $('content').innerHTML = `
    <div class="fade-in">
      <div class="detail-header">
        <div class="detail-back" onclick="navBack()">← Back to insights</div>
        <div class="detail-title">${escapeHtml(ins.title)}</div>
        <div class="detail-meta-row">
          ${ins.date ? `<div class="detail-meta-item"><span class="meta-icon">📅</span><strong>${fmt.date(ins.date)}</strong></div>` : ''}
          ${ins.campaign ? `<div class="detail-meta-item"><span class="meta-icon">📣</span><strong>${escapeHtml(ins.campaign)}</strong></div>` : ''}
          ${ins.call_type ? `<div class="detail-meta-item"><span class="meta-icon">📞</span><strong>${escapeHtml(ins.call_type)}</strong></div>` : ''}
          ${ins.call_duration ? `<div class="detail-meta-item"><span class="meta-icon">⏱</span><strong>${escapeHtml(ins.call_duration)}</strong></div>` : ''}
          ${ins.team_member ? `<div class="detail-meta-item"><span class="meta-icon">👤</span><strong>${escapeHtml(ins.team_member)}</strong></div>` : ''}
          ${ins.funnel ? `<div class="detail-meta-item"><span class="meta-icon">🔀</span><strong>${escapeHtml(ins.funnel)}</strong></div>` : ''}
        </div>
        <div class="detail-tags">
          ${ins.product ? `<span class="tag tag-cyan">${escapeHtml(ins.product)}</span>` : ''}
          ${ins.offer ? `<span class="tag tag-amber">${escapeHtml(ins.offer)}</span>` : ''}
          ${(ins.tags || []).map(t => `<span class="tag tag-neutral">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>

      ${ins.summary ? `<div class="summary-box">${escapeHtml(ins.summary)}</div>` : ''}

      ${ins.main_findings?.length ? `
        <div class="detail-section full-width" style="margin-bottom:16px">
          <div class="detail-section-title cyan">◈ Main Findings</div>
          <div class="finding-list">
            ${ins.main_findings.map(f => `<div class="finding-item">${escapeHtml(f)}</div>`).join('')}
          </div>
        </div>` : ''}

      <div class="detail-grid">
        ${section('✦ Positive Patterns', 'green', ins.positive_patterns, 'green')}
        ${section('⚡ Customer Objections', 'red', ins.customer_objections, 'red')}
        ${section('▸ Winning Language', 'cyan', [])}
        ${ins.winning_language?.length ? `
          <div class="detail-section">
            <div class="detail-section-title cyan">▸ Winning Language</div>
            ${ins.winning_language.map(l => `<div class="language-quote">${escapeHtml(l)}</div>`).join('')}
          </div>` : ''}
        ${section('◇ Pain Points', 'amber', ins.pain_points, 'amber')}
        ${section('▲ Buying Triggers', 'green', ins.buying_triggers, 'green')}
        ${section('○ Opportunities', 'purple', ins.opportunities)}
        ${section('△ Recommendations', 'cyan', ins.recommendations)}
      </div>

      ${ins.action_items?.length ? `
        <div class="detail-section full-width" style="margin-bottom:20px">
          <div class="detail-section-title amber">◇ Action Items</div>
          <table class="action-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Owner</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${ins.action_items.map(a => `
                <tr>
                  <td>${escapeHtml(a.task)}</td>
                  <td>${escapeHtml(a.owner || '—')}</td>
                  <td style="font-family:var(--font-mono);font-size:11px">${escapeHtml(a.due || '—')}</td>
                  <td><span class="status-badge ${getStatusClass(a.status)}">${escapeHtml(a.status || 'Pending')}</span></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}

      ${ins.transcript_excerpts?.length ? `
        <div class="detail-section full-width">
          <div class="detail-section-title purple">✦ Transcript Excerpts</div>
          ${ins.transcript_excerpts.map(t => `
            <div class="transcript-box">
              <div class="transcript-label">${escapeHtml(t.label)}</div>
              <div class="transcript-text">${escapeHtml(t.text)}</div>
            </div>`).join('')}
        </div>` : ''}
    </div>`;
}

// ── Navigation ─────────────────────────────────────────────
function navToHome() {
  State.view = 'home';
  State.currentId = null;
  updateActiveNav('home');
  renderHome();
  closeSidebar();
}

function navToAll() {
  State.view = 'all';
  State.currentId = null;
  updateActiveNav('all');
  renderAll();
  closeSidebar();
}

function navToPeriod(period) {
  State.filters.period = period;
  State.view = 'all';
  State.currentId = null;
  updateActiveNav('period-' + period);
  renderAll();
  populateFilterDropdowns();
  closeSidebar();
}

function navToDetail(id) {
  State.currentId = id;
  State.view = 'detail';
  renderDetail(id);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  closeSidebar();
}

function navBack() {
  State.view = 'all';
  State.currentId = null;
  renderAll();
}

function navSearch() {
  State.view = 'all';
  renderAll();
  updateSearchBanner();
}

function searchFor(term) {
  State.search = term;
  $('search-input').value = term;
  navSearch();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateActiveNav(active) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const el = $('nav-' + active);
  if (el) el.classList.add('active');
}

function updateBreadcrumb(current) {
  const el = $('breadcrumb-current');
  if (el) el.textContent = current?.length > 60 ? current.slice(0, 60) + '…' : current;
}

function updateSearchBanner() {
  const banner = $('search-results-banner');
  if (!banner) return;
  if (State.search.trim()) {
    const count = getFilteredInsights().length;
    $('search-result-text').textContent = `Showing ${count} result${count !== 1 ? 's' : ''} for "${State.search}"`;
    banner.classList.remove('hidden');
    banner.style.display = 'flex';
  } else {
    banner.classList.add('hidden');
    banner.style.display = 'none';
  }
}

function setSort(order) {
  State.sort = order;
  renderAll();
}

// ── Sidebar toggle (mobile) ────────────────────────────────
function openSidebar() {
  $('sidebar').classList.add('open');
  $('sidebar-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  $('sidebar').classList.remove('open');
  $('sidebar-overlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ── Filter change handlers ─────────────────────────────────
function onFilterChange(field, value) {
  State.filters[field] = value;
  if (State.view !== 'all') {
    State.view = 'all';
  }
  renderAll();
}

function clearAllFilters() {
  State.filters = {
    period: 'all', campaign: '', offer: '', product: '',
    funnel: '', team_member: '', call_type: ''
  };
  State.search = '';
  const searchInput = $('search-input');
  if (searchInput) searchInput.value = '';
  populateFilterDropdowns();
  renderNav();
  renderHome();
}

// ── Init ───────────────────────────────────────────────────
function init() {
  renderNav();
  populateFilterDropdowns();

  // Bind search
  const searchInput = $('search-input');
  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', e => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        State.search = e.target.value.trim();
        if (State.search) {
          navSearch();
        } else {
          updateSearchBanner();
          if (State.view === 'all') renderAll();
        }
      }, 280);
    });
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        State.search = '';
        updateSearchBanner();
        if (State.view === 'all') renderAll();
      }
    });
  }

  // Bind filter dropdowns
  const filterFields = {
    'filter-campaign':    'campaign',
    'filter-offer':       'offer',
    'filter-product':     'product',
    'filter-funnel':      'funnel',
    'filter-team-member': 'team_member',
    'filter-call-type':   'call_type'
  };
  for (const [elId, field] of Object.entries(filterFields)) {
    const el = $(elId);
    if (el) el.addEventListener('change', e => onFilterChange(field, e.target.value));
  }

  // Bind sidebar overlay
  const overlay = $('sidebar-overlay');
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Bind mobile menu button
  const menuBtn = $('mobile-menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', openSidebar);

  // Bind home link
  const homeLink = $('nav-home');
  if (homeLink) homeLink.addEventListener('click', navToHome);

  // Bind all-insights link
  const allLink = $('nav-all');
  if (allLink) allLink.addEventListener('click', navToAll);

  // Bind clear search in banner
  const clearSearch = $('clear-search-btn');
  if (clearSearch) clearSearch.addEventListener('click', () => {
    State.search = '';
    if (searchInput) searchInput.value = '';
    updateSearchBanner();
    renderAll();
  });

  // Bind clear filters button
  const clearBtn = $('clear-filters-btn');
  if (clearBtn) clearBtn.addEventListener('click', clearAllFilters);

  // Initial view
  renderHome();

  // Handle hash navigation (for direct linking)
  if (window.location.hash) {
    const hash = window.location.hash.slice(1);
    if (hash.startsWith('insight-')) navToDetail(hash);
  }
}

// ── Boot ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadData);
