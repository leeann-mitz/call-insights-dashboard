/* analytics.js — pure data functions */
const Analytics = (() => {

  // ── Date helpers ────────────────────────────────────────
  function parseDate(s) {
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y, m-1, d);
  }
  function today() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
  function monday(d) {
    const x = new Date(d), day = x.getDay();
    x.setDate(x.getDate() - (day===0?6:day-1));
    return new Date(x.getFullYear(), x.getMonth(), x.getDate());
  }
  function toStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function fmt(d) {
    return d.toLocaleDateString('en-US', {month:'short', day:'numeric'});
  }

  // ── Ranges ──────────────────────────────────────────────
  function getRange(period) {
    const t  = today(),
          y  = addDays(t,-1),
          tm = monday(t),
          lm = addDays(tm,-7),
          ls = addDays(tm,-1),
          fom  = new Date(t.getFullYear(), t.getMonth(), 1),
          folm = new Date(t.getFullYear(), t.getMonth()-1, 1),
          eolm = addDays(fom,-1);
    return {
      all_time:   {start:null,  end:null },
      today:      {start:t,     end:t    },
      yesterday:  {start:y,     end:y    },
      this_week:  {start:tm,    end:t    },
      last_week:  {start:lm,    end:ls   },
      this_month: {start:fom,   end:t    },
      last_month: {start:folm,  end:eolm },
    }[period] || {start:null, end:null};
  }

  function getPrevRange(period) {
    const {start,end} = getRange(period);
    if (!start) return {start:null,end:null};
    const span  = Math.round((end-start)/86400000);
    const pEnd  = addDays(start,-1);
    const pStart= addDays(pEnd,-span);
    return {start:pStart, end:pEnd};
  }

  function inRange(call, start, end) {
    if (!start) return true;
    const d = parseDate(call.callDate);
    return d >= start && d <= end;
  }

  function getRangeLabel(period) {
    const {start,end} = getRange(period);
    if (!start) return 'All Time';
    if (toStr(start) === toStr(end)) return fmt(start);
    return `${fmt(start)} – ${fmt(end)}`;
  }

  // ── Core filter ─────────────────────────────────────────
  function filter(calls, period, filters) {
    const {start,end} = getRange(period);
    return calls.filter(c => {
      if (!inRange(c,start,end))                             return false;
      if (filters.lob       && c.lob         !== filters.lob)       return false;
      if (filters.leader    && c.teamLeader  !== filters.leader)    return false;
      if (filters.agent     && c.agent       !== filters.agent)     return false;
      if (filters.direction && c.direction   !== filters.direction) return false;
      return true;
    });
  }

  // ── KPIs ────────────────────────────────────────────────
  function dur(s) {
    if (!s && s!==0) return '—';
    const m = Math.floor(s/60), sec = s%60;
    return `${m}:${String(sec).padStart(2,'0')}`;
  }
  function avg(arr) { return arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0; }
  function pct(n, total) { return total ? Math.round(n/total*100) : 0; }
  function trend(cur, prev) {
    if (prev===null||prev===undefined) return null;
    if (prev===0) return cur>0?100:0;
    return Math.round((cur-prev)/prev*100);
  }

  function kpis(calls, prev) {
    const total   = calls.length;
    const pTotal  = prev?.length ?? null;
    const connected = calls.filter(c=>c.outcome!=='Voicemail'&&c.outcome!=='No Contact');
    const pConn   = prev?.filter(c=>c.outcome!=='Voicemail'&&c.outcome!=='No Contact')??[];
    const sales   = calls.filter(c=>c.outcome==='Sale').length;
    const pSales  = prev?.filter(c=>c.outcome==='Sale').length??null;
    const appts   = calls.filter(c=>c.outcome==='Appointment Set').length;
    const pAppts  = prev?.filter(c=>c.outcome==='Appointment Set').length??null;
    const declines= calls.filter(c=>c.outcome==='No Interest'||c.outcome==='Refund').length;
    const pDeclines=prev?.filter(c=>c.outcome==='No Interest'||c.outcome==='Refund').length??null;
    const scores  = calls.filter(c=>c.qaScore!=null).map(c=>c.qaScore);
    const pScores = prev?.filter(c=>c.qaScore!=null).map(c=>c.qaScore)??[];
    const avgQA   = avg(scores), pAvgQA = pScores.length?avg(pScores):null;
    const durs    = calls.filter(c=>c.durationSeconds).map(c=>c.durationSeconds);
    const pDurs   = prev?.filter(c=>c.durationSeconds).map(c=>c.durationSeconds)??[];
    const avgDurS = avg(durs), pAvgDurS = pDurs.length?avg(pDurs):null;
    const convRate  = pct(sales+appts, connected.length);
    const pConvRate = pConn.length ? pct((pSales??0)+(pAppts??0), pConn.length) : null;
    const declRate  = pct(declines, total);
    const pDeclRate = pTotal ? pct(pDeclines??0, pTotal) : null;

    return {
      total,        totalTrend:    trend(total, pTotal),
      connected:    connected.length,
      sales,        salesTrend:    trend(sales, pSales),
      appts,        apptsTrend:    trend(appts, pAppts),
      convRate,     convTrend:     trend(convRate, pConvRate),
      avgQA,        qaTrend:       trend(avgQA, pAvgQA),
      avgDur:       dur(avgDurS),  avgDurS,
      durTrend:     trend(avgDurS, pAvgDurS),
      declines,     declineTrend:  trend(declRate, pDeclRate),
      declRate,
    };
  }

  // ── Outcomes ─────────────────────────────────────────────
  function outcomes(calls) {
    const order = ['Sale','Appointment Set','Saved','No Interest','Refund','No Contact','Callback','Transferred','Voicemail'];
    const map = {};
    calls.forEach(c => { map[c.outcome] = (map[c.outcome]||0) + 1; });
    const total = calls.length || 1;
    return order
      .filter(o => map[o])
      .map(o => ({ outcome:o, count:map[o], pct: Math.round(map[o]/total*100) }));
  }

  // ── Decline Reasons ──────────────────────────────────────
  function declineReasons(calls, prev) {
    const declined = calls.filter(c=>c.declineReason);
    const pDeclined = prev?.filter(c=>c.declineReason)??[];
    const map = {}, pMap = {};
    declined.forEach(c => { map[c.declineReason] = (map[c.declineReason]||0)+1; });
    pDeclined.forEach(c => { pMap[c.declineReason] = (pMap[c.declineReason]||0)+1; });
    const total = declined.length || 1;
    return Object.entries(map)
      .sort((a,b)=>b[1]-a[1])
      .map(([r,n]) => ({
        reason: r, count: n,
        pct: Math.round(n/total*100),
        trend: trend(n, pMap[r]??0),
      }));
  }

  // ── Objection grouping ───────────────────────────────────
  const OBJ_GROUPS = [
    { theme:'Too Expensive',       keys:['price','cost','expensive','afford','budget','investment'],
      tip:'Delay price reveal until value is fully established. Use the customization frame: "cost varies based on your specific game." Focus on ROI — cost per round saved.' },
    { theme:'Need Time to Think',  keys:['think','consider','time','decide','talk'],
      tip:'Treat "think about it" as an information gap, not a delay. Ask: "What specifically would help you feel confident making a decision today?" Nail down the real objection.' },
    { theme:'Needs Spouse Approval',keys:['spouse','wife','husband','partner'],
      tip:'Include the decision-maker early. "Would it make sense to have your spouse join us for this part of the conversation?" Never let a call end without a defined next step.' },
    { theme:'Location / Travel',   keys:['location','travel','florida','texas','california','local','distance'],
      tip:'Add a location qualifier in the first 2 minutes. Have a virtual/online alternative ready for location-blocked prospects instead of a dead end.' },
    { theme:'Time / Schedule',     keys:['time','busy','schedule','5 day','work','profession','demands'],
      tip:'Offer a shorter-format option for time-poor professionals. Frame it as a single focused session vs. a multi-day commitment.' },
    { theme:'Not Interested / DNC',keys:['not interested','stop calling','dNC','every day','already spoken'],
      tip:'Review CRM contact frequency before dialing. Flag accounts with 2+ recent touches for manager review.' },
    { theme:'Login / Tech Issues', keys:['login','access','tech','download','app','log in'],
      tip:'Add a proactive login troubleshooting step to the post-purchase onboarding flow within 48 hours of purchase.' },
    { theme:'Billing Surprise',    keys:['charge','billing','didn\'t know','enrolled','member'],
      tip:'Review checkout and onboarding email clarity. Add explicit consent checkpoints to all subscription enrollment flows.' },
    { theme:'Low Usage / Frequency',keys:['rarely','2 to 3','few times','don\'t play'],
      tip:'Add a play-frequency qualifier to enrollment. Route low-frequency golfers to a different product tier.' },
    { theme:'Cancellation – Not Using', keys:['cancel','cancellation','not using','haven\'t used','no time to use','scratch club','champions pass','vip coaching','training program','physical product'],
      tip:'Trigger a proactive check-in at 30 days post-purchase. Identify usage barriers early before they become cancellation calls.' },
    { theme:'Refund / Dissatisfied',  keys:['refund','refunded','unhappy','dissatisfied','doesn\'t work','not what i expected','waste'],
      tip:'Flag refund requests for senior rep handling. Offer a pause, swap, or concession before processing — save rate on retained offers is significantly higher than cold cancels.' },
    { theme:'Already Purchased / Duplicate', keys:['already purchased','already bought','already have','duplicate','signed up'],
      tip:'Check CRM for existing active memberships before dialing. Flag duplicate accounts for cleanup to avoid wasted touches.' },
  ];

  function objections(calls, prev) {
    // Derive objections from declineReason + summary keywords (no c.objections array in CSV data)
    function matchGroups(calls) {
      const counts = {};
      calls.forEach(c => {
        const text = ((c.declineReason||'') + ' ' + (c.summary||'')).toLowerCase();
        OBJ_GROUPS.forEach(g => {
          if (g.keys.some(k => text.includes(k))) counts[g.theme] = (counts[g.theme]||0) + 1;
        });
      });
      return counts;
    }
    const cur  = matchGroups(calls);
    const prv  = matchGroups(prev||[]);
    return OBJ_GROUPS
      .map(g => ({ ...g, count: cur[g.theme]||0, pCount: prv[g.theme]||0, trend: trend(cur[g.theme]||0, prv[g.theme]||0) }))
      .filter(g => g.count > 0)
      .sort((a,b) => b.count - a.count);
  }

  // ── Agent/Rep stats ──────────────────────────────────────
  const SCRIPT_PHASES = {
    'PG1':               ['Warm Open','Discovery','Pain Amplification','Product Presentation','Objection Handling','Close'],
    'Internal Setter':   ['Warm Open','Discovery','Root-Flaw Framing','Social Proof','Identity Close','Two-Slot Time Close'],
    'ASR':               ['Purchase Confirmation','PG-One Value Intro','Discovery Questions','Advisor Scheduling','VIP Coaching Offer','Appointment Confirmation'],
    'ASR / PG1 Setter':  ['Purchase Confirmation','PG-One Value Intro','Discovery Questions','Advisor Scheduling','VIP Coaching Offer','Appointment Confirmation'],
    'PG1 Closers':       ['Warm Open','Discovery','Pain Amplification','Product Presentation','Objection Handling','Close'],
    'Inbound Customer Care':['Empathy & Acknowledgment','Account Review','Resolution','Retention Offer'],
    'Follow Up':         ['Reconnect','Account Review','Save Offer (Pause/Discount)','Resolution & Confirm'],
    'PG1':               ['Warm Open','Discovery','Solution Presentation','Objection Handling','Close'],
  };

  function repStats(calls) {
    const map = {};
    calls.forEach(c => {
      if (!c.agent) return;
      const r = map[c.agent] ||= {
        agent:c.agent, teamLeader:c.teamLeader, lob:c.lob,
        calls:0, qaSum:0, qaCount:0, sales:0, appts:0,
        durSum:0, durCount:0, scriptSum:0, scriptCount:0,
        gaps:[],
      };
      r.calls++;
      if (c.qaScore!=null) { r.qaSum+=c.qaScore; r.qaCount++; }
      if (c.outcome==='Sale') r.sales++;
      if (c.outcome==='Appointment Set') r.appts++;
      if (c.durationSeconds) { r.durSum+=c.durationSeconds; r.durCount++; }
      if (c.scriptAdherence!=null) { r.scriptSum+=c.scriptAdherence; r.scriptCount++; }
      if (c.scriptGaps) r.gaps.push(...c.scriptGaps);
    });
    return Object.values(map).map(r => {
      const avgQA   = r.qaCount   ? Math.round(r.qaSum/r.qaCount)     : null;
      const avgScript = r.scriptCount ? Math.round(r.scriptSum/r.scriptCount) : 0;
      const avgDurS = r.durCount  ? Math.round(r.durSum/r.durCount)   : 0;
      const connected = r.calls;
      const conv    = connected ? pct(r.sales+r.appts, connected) : 0;
      let priority, priorityCls;
      if (avgQA != null) {
        // QA-based priority
        if (avgQA >= 83)      { priority='Leader';    priorityCls='priority-leader'; }
        else if (avgQA >= 75) { priority='On Track';  priorityCls='priority-low';   }
        else if (avgQA >= 60) { priority='Monitor';   priorityCls='priority-med';   }
        else                  { priority='Coach Now'; priorityCls='priority-high';  }
      } else {
        // Conversion-based priority when no QA scores
        if (conv >= 30)       { priority='Leader';    priorityCls='priority-leader'; }
        else if (conv >= 20)  { priority='On Track';  priorityCls='priority-low';   }
        else if (conv >= 12)  { priority='Monitor';   priorityCls='priority-med';   }
        else                  { priority='Coach Now'; priorityCls='priority-high';  }
      }
      const topGap = [...new Set(r.gaps)].slice(0,1)[0] || '';
      return { ...r, avgQA: avgQA ?? 0, avgScript, avgDurS, avgDur:dur(avgDurS), conv, priority, priorityCls, topGap };
    }).sort((a,b)=>b.conv-a.conv);
  }

  // ── Period call counts ───────────────────────────────────
  function periodCounts(calls) {
    const periods = ['all_time','today','yesterday','this_week','last_week','this_month','last_month'];
    const out = {};
    periods.forEach(p => {
      const {start,end} = getRange(p);
      out[p] = calls.filter(c=>inRange(c,start,end)).length;
    });
    return out;
  }

  // ── Unique values ────────────────────────────────────────
  function uniq(calls, field) {
    return [...new Set(calls.map(c=>c[field]).filter(Boolean))].sort();
  }

  // ── WoW compare ─────────────────────────────────────────
  function wowRows(current, prev) {
    const ck = kpis(current, prev);
    return [
      { label:'Conversion',  cur:`${ck.convRate}%`,   prev_val: prev ? `${kpis(prev,[]).convRate}%` : '—', trend:ck.convTrend },
      { label:'QA Score',    cur:`${ck.avgQA}`,        prev_val: prev ? `${kpis(prev,[]).avgQA}` : '—', trend:ck.qaTrend },
      { label:'Sales',       cur:`${ck.sales}`,        prev_val: prev ? `${kpis(prev,[]).sales}` : '—', trend:ck.salesTrend },
      { label:'Appointments',cur:`${ck.appts}`,        prev_val: prev ? `${kpis(prev,[]).appts}` : '—', trend:ck.apptsTrend },
      { label:'Declines',    cur:`${ck.declines}`,     prev_val: prev ? `${kpis(prev,[]).declines}` : '—', trend:ck.declineTrend, invertGood:true },
      { label:'Call Volume', cur:`${ck.total}`,        prev_val: prev ? `${kpis(prev,[]).total}` : '—', trend:ck.totalTrend },
      { label:'Avg Duration',cur:ck.avgDur,           prev_val: prev ? kpis(prev,[]).avgDur : '—', trend:ck.durTrend },
      { label:'Decline Rate',cur:`${ck.declRate}%`,    prev_val: prev ? `${kpis(prev,[]).declRate}%` : '—', trend:ck.declineTrend, invertGood:true },
    ];
  }

  // ── Phrases ──────────────────────────────────────────────
  const OVERUSED = ['I completely understand','I don\'t want to pressure you','Let me see what I can do','No problem at all'];
  const BETTER   = {
    "I completely understand": "\"I hear you — that's one of the most common things I hear from golfers who've been at this a while.\"",
    "I don't want to pressure you": "\"I want to make sure this is the right fit for your game. What information would help you feel confident?\"",
    "Let me see what I can do": "\"Here's exactly what I can offer you today.\"",
    "No problem at all": "\"Absolutely — and here's why that actually makes sense for your situation.\"",
  };

  function phrases(calls) {
    const all = calls.flatMap(c=>c.phrases||[]);
    const counts = {};
    all.forEach(p => { counts[p]=(counts[p]||0)+1; });
    const common = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const overused = OVERUSED.filter(p=>counts[p]);
    return { common, overused, better: BETTER };
  }

  // ── Sparkline data ───────────────────────────────────────
  function sparkData(calls, allCalls) {
    // Last 7 days of the full dataset relative to the latest call date
    const dates = [...new Set(allCalls.map(c=>c.callDate))].sort().slice(-7);
    return dates.map(d => allCalls.filter(c=>c.callDate===d).length);
  }

  return {
    parseDate, getRange, getPrevRange, getRangeLabel, inRange,
    filter, kpis, outcomes, declineReasons, objections,
    repStats, periodCounts, uniq, wowRows, phrases, sparkData,
    dur, pct, trend, SCRIPT_PHASES,
  };
})();
