/* analytics.js — pure calculation functions, no DOM */

const Analytics = (() => {

  /* ── Date helpers ───────────────────────────────────────── */
  function parseDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function today() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function monday(d) {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(d, n) {
    const r = new Date(d); r.setDate(r.getDate() + n); return r;
  }

  function toStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  /* ── Period ranges ──────────────────────────────────────── */
  function getRange(period) {
    const t = today();
    const yest = addDays(t, -1);
    const thisMon  = monday(t);
    const lastMon  = addDays(thisMon, -7);
    const lastSun  = addDays(thisMon, -1);
    const fom  = new Date(t.getFullYear(), t.getMonth(), 1);
    const folm = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    const eolm = addDays(fom, -1);
    const foy  = new Date(t.getFullYear(), 0, 1);
    const d90  = addDays(t, -89);

    const map = {
      today:       { start: t,       end: t       },
      yesterday:   { start: yest,    end: yest    },
      this_week:   { start: thisMon, end: t       },
      last_week:   { start: lastMon, end: lastSun },
      this_month:  { start: fom,     end: t       },
      last_month:  { start: folm,    end: eolm    },
      last_90_days:{ start: d90,     end: t       },
      this_year:   { start: foy,     end: t       },
      all_time:    { start: null,    end: null    },
    };
    return map[period] || map.all_time;
  }

  function getPrevRange(period) {
    const { start, end } = getRange(period);
    if (!start) return { start: null, end: null };
    const span = Math.round((end - start) / 86400000);
    const prevEnd   = addDays(start, -1);
    const prevStart = addDays(prevEnd, -span);
    return { start: prevStart, end: prevEnd };
  }

  function inRange(call, start, end) {
    if (!start) return true;
    const d = parseDate(call.callDate);
    return d >= start && d <= end;
  }

  /* ── Filtering ──────────────────────────────────────────── */
  function filter(calls, period, filters) {
    const { start, end } = getRange(period);
    return calls.filter(c => {
      if (!inRange(c, start, end)) return false;
      if (filters.agent   && c.agent   !== filters.agent)   return false;
      if (filters.lob     && c.lob     !== filters.lob)     return false;
      if (filters.outcome && c.outcome !== filters.outcome) return false;
      if (filters.product && c.product !== filters.product) return false;
      if (filters.minQA   && (c.qaScore ?? 0) < Number(filters.minQA)) return false;
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        const hay = [c.summary, c.agent, c.member, c.lob, c.product,
          ...(c.strengths||[]), ...(c.objections||[]), ...(c.opportunities||[]),
          ...(c.tags||[])].join(' ').toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }

  /* ── KPIs ───────────────────────────────────────────────── */
  function duration(secs) {
    if (!secs) return '—';
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function avg(arr) {
    if (!arr.length) return 0;
    return Math.round(arr.reduce((a,b) => a+b, 0) / arr.length);
  }

  function trend(cur, prev) {
    if (prev === null || prev === undefined) return null;
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  }

  function kpis(calls, prevCalls) {
    const total = calls.length;
    const prev  = prevCalls ? prevCalls.length : null;

    const scores = calls.filter(c => c.qaScore != null).map(c => c.qaScore);
    const pScores = prevCalls ? prevCalls.filter(c => c.qaScore != null).map(c => c.qaScore) : [];
    const avgQA = avg(scores);
    const pAvgQA = pScores.length ? avg(pScores) : null;

    const live  = calls.filter(c => c.outcome !== 'No Contact');
    const pLive = prevCalls ? prevCalls.filter(c => c.outcome !== 'No Contact') : [];

    const sales  = live.filter(c => c.outcome === 'Sale').length;
    const pSales = pLive.filter(c => c.outcome === 'Sale').length;
    const closeRate  = live.length  ? Math.round(sales  / live.length  * 100) : 0;
    const pCloseRate = pLive.length ? Math.round(pSales / pLive.length * 100) : null;

    const booked  = live.filter(c => c.outcome === 'Booked').length;
    const pBooked = pLive.filter(c => c.outcome === 'Booked').length;
    const bookRate  = live.length  ? Math.round(booked  / live.length  * 100) : 0;
    const pBookRate = pLive.length ? Math.round(pBooked / pLive.length * 100) : null;

    const retCalls = calls.filter(c => c.lob === 'Retention' && ['Saved','Refunded','Declined'].includes(c.outcome));
    const saved    = retCalls.filter(c => c.outcome === 'Saved').length;
    const saveRate = retCalls.length ? Math.round(saved / retCalls.length * 100) : 0;

    const durs    = calls.filter(c => c.durationSeconds).map(c => c.durationSeconds);
    const avgDurS = avg(durs);
    const pDurs   = prevCalls ? prevCalls.filter(c => c.durationSeconds).map(c => c.durationSeconds) : [];
    const pAvgDurS = pDurs.length ? avg(pDurs) : null;

    const rev  = calls.reduce((s,c)  => s + (c.revenue || 0), 0);
    const pRev = prevCalls ? prevCalls.reduce((s,c) => s + (c.revenue || 0), 0) : null;

    return {
      total,       totalTrend:    trend(total, prev),
      avgQA,       avgQATrend:    trend(avgQA, pAvgQA),
      closeRate,   closeRateTrend:trend(closeRate, pCloseRate),
      bookRate,    bookRateTrend: trend(bookRate, pBookRate),
      saveRate,    saveRateTrend: null,
      avgDur:      duration(avgDurS), avgDurS, avgDurTrend: trend(avgDurS, pAvgDurS),
      rev,         revTrend:      trend(rev, pRev),
    };
  }

  /* ── Breakdowns ─────────────────────────────────────────── */
  function outcomes(calls) {
    const keys = ['Sale','Booked','Saved','Declined','Refunded','No Contact'];
    return keys.map(o => ({ outcome: o, count: calls.filter(c => c.outcome === o).length }))
               .filter(x => x.count > 0);
  }

  function agentStats(calls) {
    const map = {};
    calls.forEach(c => {
      if (!c.agent) return;
      const a = map[c.agent] ||= { agent:c.agent, calls:0, qaSum:0, qaCount:0, sales:0, booked:0 };
      a.calls++;
      if (c.qaScore != null) { a.qaSum += c.qaScore; a.qaCount++; }
      if (c.outcome === 'Sale')   a.sales++;
      if (c.outcome === 'Booked') a.booked++;
    });
    return Object.values(map)
      .map(a => ({ ...a, avgQA: a.qaCount ? Math.round(a.qaSum / a.qaCount) : 0 }))
      .sort((a,b) => b.avgQA - a.avgQA);
  }

  function lobStats(calls) {
    const map = {};
    calls.forEach(c => {
      const k = c.lob || 'Unknown';
      const l = map[k] ||= { lob:k, calls:0, sales:0, booked:0 };
      l.calls++;
      if (c.outcome === 'Sale')   l.sales++;
      if (c.outcome === 'Booked') l.booked++;
    });
    return Object.values(map).sort((a,b) => b.calls - a.calls);
  }

  function timeline(calls, period) {
    const { start, end } = getRange(period);
    const byDate = {};
    calls.forEach(c => { byDate[c.callDate] = (byDate[c.callDate] || 0) + 1; });

    if (!start) {
      return Object.keys(byDate).sort().map(d => ({ date: d, count: byDate[d] }));
    }
    const result = [];
    const cur = new Date(start);
    while (cur <= end) {
      const ds = toStr(cur);
      result.push({ date: ds, count: byDate[ds] || 0 });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }

  /* ── Period counts ──────────────────────────────────────── */
  function periodCounts(calls) {
    const periods = ['today','yesterday','this_week','last_week','this_month',
                     'last_month','last_90_days','this_year','all_time'];
    const out = {};
    periods.forEach(p => {
      const { start, end } = getRange(p);
      out[p] = calls.filter(c => inRange(c, start, end)).length;
    });
    return out;
  }

  /* ── Unique values (for dropdowns) ──────────────────────── */
  function uniq(calls, field) {
    return [...new Set(calls.map(c => c[field]).filter(Boolean))].sort();
  }

  /* ── AI Insights ────────────────────────────────────────── */
  function insights(calls) {
    if (!calls.length) return [{ icon:'📊', title:'No calls', text:'No calls match the current filters.' }];
    const out = [];
    const agents = agentStats(calls);

    if (agents.length) {
      const top = agents[0];
      out.push({ icon:'🏆', title:'Top Performer',
        text:`${top.agent} leads with avg QA ${top.avgQA}/100 across ${top.calls} call${top.calls!==1?'s':''}.` });
    }

    const teamAvgQA = agents.length ? Math.round(agents.reduce((s,a)=>s+a.avgQA,0)/agents.length) : 0;
    const coaching = agents.filter(a => a.calls >= 2 && a.avgQA < teamAvgQA - 10);
    if (coaching.length) {
      out.push({ icon:'🎯', title:'Coaching Needed',
        text:`${coaching.map(a=>a.agent).join(', ')} scoring 10+ points below team avg (${teamAvgQA}/100). Schedule 1:1 sessions.` });
    }

    const allObjs = calls.flatMap(c => c.objections || []);
    if (allObjs.length) {
      const cats = {};
      allObjs.forEach(o => {
        const l = o.toLowerCase();
        let k = l.includes('price')||l.includes('cost')||l.includes('afford') ? 'Price / Cost' :
                l.includes('time')||l.includes('busy')||l.includes('schedule') ? 'Time / Schedule' :
                l.includes('location')||l.includes('travel')||l.includes('florida') ? 'Location' :
                l.includes('think')||l.includes('spouse')||l.includes('partner') ? 'Needs to Think / Spouse' :
                l.includes('login')||l.includes('access')||l.includes('tech') ? 'Tech / Login Issues' :
                l.includes('stop call')||l.includes('calling me') ? 'Call Fatigue / DNC' : 'Other';
        cats[k] = (cats[k]||0) + 1;
      });
      const [topObj, topCnt] = Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
      out.push({ icon:'🚧', title:'Top Objection',
        text:`"${topObj}" appears across ${topCnt} call${topCnt!==1?'s':''} — the most common barrier this period.` });
    }

    const lobs = lobStats(calls);
    if (lobs.length > 1) {
      out.push({ icon:'📈', title:'LOB Volume',
        text:`${lobs[0].lob} leads with ${lobs[0].calls} calls. ${lobs[lobs.length-1].lob} has the fewest (${lobs[lobs.length-1].calls}).` });
    }

    const saleDurs = calls.filter(c=>c.outcome==='Sale'&&c.durationSeconds).map(c=>c.durationSeconds);
    const allDurs  = calls.filter(c=>c.durationSeconds).map(c=>c.durationSeconds);
    if (saleDurs.length && allDurs.length) {
      const sa = avg(saleDurs), aa = avg(allDurs);
      if (sa > aa + 60) {
        out.push({ icon:'⏱️', title:'Talk Time',
          text:`Won calls average ${duration(sa)} vs ${duration(aa)} team-wide — longer conversations correlate with sales.` });
      }
    }

    const refunds = calls.filter(c=>c.outcome==='Refunded');
    if (refunds.length) {
      const totalRev = refunds.reduce((s,c)=>s+(c.revenue||0),0);
      out.push({ icon:'↩️', title:'Refund Impact',
        text:`${refunds.length} refund${refunds.length!==1?'s':''} this period totaling $${Math.abs(totalRev).toLocaleString()}. Review enrollment & billing disclosure gaps.` });
    }

    return out;
  }

  /* ── Public API ─────────────────────────────────────────── */
  return { getRange, getPrevRange, filter, kpis, outcomes, agentStats, lobStats, timeline, periodCounts, uniq, insights, duration };

})();
