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
    const order = ['Sale','Appointment Set','Saved','No Interest','Refund','No Contact','Info Only','Callback','Transferred','Voicemail'];
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
    { theme:'Too Expensive', keys:['price','cost','expensive','afford','budget','investment'],
      tips:{
        'PG1':          'Stack the value before price — rounds saved, strokes gained, coaching access. Use: "Most members say it pays for itself in 2–3 rounds." Never lead with price.',
        'PG1 Closers':  'Re-anchor to what they said they wanted in discovery. "You mentioned shooting in the 80s — what would that be worth?" Then revisit the investment.',
        'ASR':          'Remind them they already invested in PG1. Frame VIP as protecting that investment: "This is what makes the program actually work for you."',
        'Internal Setters': 'De-risk the conversation — reps are not closing price, they are setting an appointment. Redirect: "The advisor will walk you through all the options. Your only job today is to show up."',
        'Inbound Customer Care': 'Acknowledge the concern without discounting. Offer a pause or lower-tier alternative before a full cancel. "Let me see what I can do to make this work within your budget."',
        'Retention':    'Offer a pause, product swap, or partial credit. Cancellation should always be the last option — present at least two save alternatives first.',
        'VIP':          'Tie VIP price to their existing PG1 commitment. "You already invested in the program — VIP is what unlocks the full result." ROI frame: cost per lesson vs. coaching access.',
        'default':      'Delay price reveal until value is fully established. Focus on ROI and outcomes, not the number itself.',
      }},
    { theme:'Need Time to Think', keys:['think','consider','decide','talk'],
      tips:{
        'PG1':          '"Think about it" almost always means a hidden objection. Ask: "What specifically is making you hesitate?" and stay silent. Isolate the real concern before ending the call.',
        'PG1 Closers':  'Set a hard callback with a specific time before hanging up. "Let\'s lock in Thursday at 10am — if it\'s not a fit I\'ll let you off the hook." Vague follow-ups rarely convert.',
        'ASR':          'Create urgency around the appointment slot: "Your advisor only has a few openings this week. Let\'s secure a time now and you can always reschedule." Remove the friction.',
        'Internal Setters': 'Reps should not be handling this — it means discovery was incomplete. Coach reps to identify the real blocker before pitching the appointment.',
        'Inbound Customer Care': 'This usually signals dissatisfaction, not indecision. Ask what would need to be true for them to feel confident staying. Listen more, pitch less.',
        'Retention':    'A member who wants to "think about it" is already halfway out. Offer a 30-day pause now: "No pressure to decide today — I can put your account on hold while you think."',
        'VIP':          'Book a follow-up slot before the call ends. "I\'ll hold this VIP spot for you for 48 hours — let\'s confirm a time to reconnect." Never leave it open-ended.',
        'default':      'Treat "think about it" as an information gap. Ask what would help them feel confident deciding today and isolate the real objection.',
      }},
    { theme:'Needs Spouse Approval', keys:['spouse','wife','husband','partner'],
      tips:{
        'PG1':          'Introduce the spouse early in discovery: "Is this something your partner would want to be part of?" Loop them in before the close, not after.',
        'PG1 Closers':  'Offer a 3-way callback: "Let\'s get your spouse on a quick 10-minute call — I\'ll walk you both through it together." Never let the call end without a next step locked.',
        'ASR':          'Shift focus to the appointment: "No commitment needed today — the advisor will answer all your questions together with your spouse on the call." Make it easy to say yes.',
        'default':      'Include the decision-maker early. Never let a call end without a defined next step — offer a 3-way callback.',
      }},
    { theme:'Location / Travel', keys:['location','travel','florida','texas','california','local','distance'],
      tips:{
        'PG1':          'Add a location qualifier in the first 2 minutes. Lead with virtual/online option for distance prospects — do not wait for them to raise it as an objection.',
        'PG1 Closers':  'Position the online coaching delivery: "Everything is delivered virtually — your rep connects with you on your schedule, wherever you are."',
        'Internal Setters': 'Qualify location before pitching the appointment. If they\'re not local to a facility, route to the virtual track immediately.',
        'default':      'Have a virtual/online alternative ready. Add a location qualifier early in the call — never let it become a late-stage objection.',
      }},
    { theme:'Time / Schedule', keys:['time','busy','schedule','5 day','work','profession','demands'],
      tips:{
        'PG1':          'Offer a condensed format option: "We have members who do this in weekend blocks — it\'s designed around your schedule, not the other way around."',
        'PG1 Closers':  'Reframe the time commitment: "You\'re already spending time on the course — this just makes every round count more." Tie to their stated goal.',
        'ASR':          'The appointment is 20–30 minutes. Emphasize the time is minimal: "Your advisor will work around your calendar — it\'s a single focused session."',
        'Internal Setters': 'Anchor to the appointment time, not the program: "It\'s just a 20-minute call — your advisor will handle all the details." Reduce the perceived commitment.',
        'Inbound Customer Care': 'Acknowledge their schedule and offer to find the best contact window. Don\'t let time become a reason to cancel — schedule a follow-up instead.',
        'Retention':    'Offer a pause rather than cancellation for members citing time. "Let\'s put your account on hold for 30–60 days and pick it back up when your schedule opens."',
        'default':      'Offer a shorter-format or flexible option. Frame as fitting their schedule, not the other way around.',
      }},
    { theme:'Not Interested / DNC', keys:['not interested','stop calling','every day','already spoken'],
      tips:{
        'PG1':          'Do not push past a firm no. Log the outcome correctly and flag for CRM review. Repeated calls to DNC contacts are a compliance risk.',
        'ASR':          'Check CRM notes before dialing — if the contact has declined before, escalate to a supervisor rather than re-pitching. Protect the brand.',
        'Inbound Customer Care': 'Honor the DNC request immediately. Confirm the removal, document it, and escalate to CRM ops to update the record.',
        'Retention':    'If the member is firm, process the cancel cleanly. A bad exit creates chargebacks and reviews — a respectful close keeps the door open for a future return.',
        'default':      'Review CRM contact frequency before dialing. Flag accounts with 2+ recent touches for manager review.',
      }},
    { theme:'Login / Tech Issues', keys:['login','access','tech','download','app','log in'],
      tips:{
        'ASR':          'This is the #1 reason members disengage before their first session. Route to tech support immediately — do not let the rep try to troubleshoot on the call.',
        'Inbound Customer Care': 'Own the fix before ending the call. Walk through login steps live, or schedule a screen-share with support. Never close the ticket until access is confirmed.',
        'Retention':    'Login issues masking a cancel request are common. Solve the access problem first — a member who can\'t log in has never experienced the product.',
        'PG1':          'Warm-transfer to customer care for tech issues during a sales call. Do not let tech friction kill a hot prospect — hand it off and reconnect after.',
        'default':      'Route to tech support immediately. Add a proactive login troubleshooting step to onboarding within 48 hours of purchase.',
      }},
    { theme:'Billing Surprise', keys:['charge','billing','didn\'t know','enrolled','member'],
      tips:{
        'Inbound Customer Care': 'Acknowledge immediately without being defensive. Pull the account, review the charge, and explain clearly. Offer a credit or refund where appropriate.',
        'Retention':    'A billing surprise is often the first sign of a cancellation. Resolve it fast and follow up with a goodwill gesture — a credit or bonus session builds trust back.',
        'ASR':          'If the member was charged unexpectedly, escalate to billing ops. Do not promise refunds you cannot authorize — route to the right team.',
        'default':      'Review checkout and onboarding email clarity. Add explicit consent checkpoints to all subscription enrollment flows.',
      }},
    { theme:'Low Usage / Frequency', keys:['rarely','2 to 3','few times','don\'t play'],
      tips:{
        'Retention':    'Low usage is the #1 precursor to cancellation. Lead with value reminder: "Let\'s get you back on track — what\'s been getting in the way?" Then offer a restart plan.',
        'Inbound Customer Care': 'Proactively identify low-usage accounts and reach out before the cancel call comes. A check-in call at 45 days of inactivity can save the membership.',
        'PG1':          'Qualify play frequency early. Low-frequency golfers may need a different product tier — flag for the advisor rather than forcing a bad fit.',
        'default':      'Add a play-frequency qualifier to enrollment. Route low-frequency golfers to a different product tier or offer a usage restart plan.',
      }},
    { theme:'Cancellation – Not Using', keys:['cancel','cancellation','not using','haven\'t used','no time to use','scratch club','champions pass','vip coaching','training program','physical product'],
      tips:{
        'Retention':    'Never accept the first cancel request. Always present 3 options: pause, downgrade, or a guided re-engagement session. Only process a cancel after all three are declined.',
        'Inbound Customer Care': 'Identify the root cause — is it cost, time, tech, or unmet expectations? The fix determines the save. Ask: "What would have to change for you to want to continue?"',
        'PG1 Closers':  'If a member is cancelling a product you closed, flag it for rep coaching. High cancel rates from specific reps signal a pitch-reality gap.',
        'ASR':          'Members cancelling after ASR calls may have been oversold. Review the call summary and flag to TL if expectations were misset during the appointment.',
        'default':      'Trigger a proactive check-in at 30 days post-purchase. Identify usage barriers early before they become cancellation calls.',
      }},
    { theme:'Refund / Dissatisfied', keys:['refund','refunded','unhappy','dissatisfied','doesn\'t work','not what i expected','waste'],
      tips:{
        'Retention':    'Flag for senior rep immediately. Offer a pause + bonus session before any refund discussion. Save rate on retained offers is significantly higher than cold cancels.',
        'Inbound Customer Care': 'Acknowledge the disappointment first — do not defend the product. Then ask: "What would a good outcome look like for you?" Match the offer to their answer.',
        'PG1 Closers':  'High refund rates from a closer signal overpromising. Pull recent call recordings for reps with refund rates above 15% and review for expectation-setting gaps.',
        'default':      'Flag for senior rep handling. Offer a pause, swap, or concession before processing — save rate on retained offers is significantly higher than cold cancels.',
      }},
    { theme:'Already Purchased / Duplicate', keys:['already purchased','already bought','already have','duplicate','signed up'],
      tips:{
        'ASR':          'Check CRM for active memberships before dialing. If a member already has the product, route to a VIP upsell or a scheduling call — not a re-sell.',
        'Internal Setters': 'Verify account status at the start of every call. A duplicate pitch wastes time and damages trust with existing members.',
        'PG1':          'Flag duplicate accounts to CRM ops for cleanup. Route existing members to ASR or Customer Care — not back into the PG1 pitch flow.',
        'default':      'Check CRM for existing active memberships before dialing. Flag duplicate accounts for cleanup to avoid wasted touches.',
      }},
  ];

  function objections(calls, prev, activeLob) {
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
    const cur = matchGroups(calls);
    const prv = matchGroups(prev||[]);
    return OBJ_GROUPS
      .map(g => {
        const tip = g.tips
          ? (g.tips[activeLob] || g.tips['default'] || '')
          : (g.tip || '');
        return { ...g, tip, count: cur[g.theme]||0, pCount: prv[g.theme]||0, trend: trend(cur[g.theme]||0, prv[g.theme]||0) };
      })
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
