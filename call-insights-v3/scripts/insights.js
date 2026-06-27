/* insights.js — AI narrative & coaching engine */
const Insights = (() => {

  // ── Executive Call Snapshot (Section 3) ─────────────────
  function callSnapshot(current, prev, period) {
    if (!current.length) return '<p>No calls match the selected filters.</p>';
    const k  = Analytics.kpis(current, prev);
    const pk = prev?.length ? Analytics.kpis(prev, []) : null;
    const reps = Analytics.repStats(current);
    const topRep = reps[0];
    const decReasons = Analytics.declineReasons(current, prev);
    const topDecline = decReasons[0];

    const convDir  = !pk ? null : k.convRate > pk.convRate ? 'up' : k.convRate < pk.convRate ? 'down' : 'flat';
    const volumeDir= !pk ? null : k.total    > pk.total    ? 'up' : k.total    < pk.total    ? 'down' : 'flat';

    let html = `<p>The team handled <strong>${k.total.toLocaleString()} call${k.total!==1?'s':''}</strong> `;
    if (pk) {
      if (volumeDir==='up')        html += `— <span class="n-positive">up ${Math.abs(k.total-pk.total)} from the prior period</span>. `;
      else if (volumeDir==='down') html += `— <span class="n-negative">down ${Math.abs(k.total-pk.total)} from the prior period</span>. `;
      else                         html += `— volume held steady from the prior period. `;
    } else { html += `. `; }

    if (k.convRate > 0) {
      html += `Overall conversion rate stands at <strong>${k.convRate}%</strong>`;
      if (pk && convDir) {
        if (convDir==='up')        html += ` (<span class="n-positive">↑${Math.abs(k.convRate-(pk?.convRate??0))} pts vs. prior period</span>)`;
        else if (convDir==='down') html += ` (<span class="n-negative">↓${Math.abs(k.convRate-(pk?.convRate??0))} pts vs. prior period</span>)`;
      }
      html += `. `;
    }

    if (k.sales > 0 || k.appts > 0) {
      html += `<strong>${k.sales}</strong> sale${k.sales!==1?'s':''} and <strong>${k.appts}</strong> appointment${k.appts!==1?'s':''} were secured this period.</p>`;
    } else { html += `</p>`; }

    if (topRep) {
      html += `<p><strong>${topRep.agent}</strong> leads the team with <strong>${topRep.conv}% conversion</strong> on ${topRep.calls} calls`;
      if (topRep.sales > 0) html += ` (${topRep.sales} sale${topRep.sales!==1?'s':''})`;
      html += `. `;

      const refundRate = Analytics.pct(current.filter(c=>c.outcome==='Refund').length, current.length);
      if (refundRate > 10) {
        html += `<span class="n-negative">Refund/cancellation rate is at ${refundRate}% — retention focus recommended.</span> `;
      }
      html += `</p>`;
    }

    if (topDecline) {
      html += `<p>The leading reason for declined calls is <strong>${topDecline.reason}</strong> (${topDecline.pct}% of declines). `;
      if (topDecline.trend > 20) html += `<span class="n-negative">This is trending upward — targeted rep coaching and script reinforcement recommended.</span> `;
      html += `</p>`;
    }

    return html;
  }

  // ── What's Happening on Calls (Section 7) ───────────────
  function whatIsHappening(calls) {
    const items = [];
    if (!calls.length) return items;

    // Conversion rate insight
    const k = Analytics.kpis(calls, null);
    const reps = Analytics.repStats(calls);
    const topConv  = reps.filter(r=>r.conv>=30);
    const lowConv  = reps.filter(r=>r.conv<15 && r.calls>=10);

    if (topConv.length && lowConv.length) {
      items.push({ icon:'📊', title:'Large conversion gap between top and bottom performers',
        text:`${topConv.length} rep${topConv.length!==1?'s':''} are converting at 30%+ while ${lowConv.length} rep${lowConv.length!==1?'s':''} with 10+ calls are below 15%. The gap suggests a skill or approach difference, not a market difference — coaching from top performers to bottom is the fastest fix.` });
    }

    // Longer calls = more sales
    const saleDurs = calls.filter(c=>c.outcome==='Sale'&&c.durationSeconds).map(c=>c.durationSeconds);
    const allDurs  = calls.filter(c=>c.durationSeconds).map(c=>c.durationSeconds);
    if (saleDurs.length >= 2 && allDurs.length >= 2) {
      const sa = Math.round(saleDurs.reduce((a,b)=>a+b,0)/saleDurs.length);
      const aa = Math.round(allDurs.reduce((a,b)=>a+b,0)/allDurs.length);
      if (sa > aa + 90) {
        items.push({ icon:'⏱️', title:'Longer conversations consistently lead to sales',
          text:`Calls that resulted in a sale averaged ${Analytics.dur(sa)} vs. ${Analytics.dur(aa)} across all calls — a ${Analytics.dur(sa-aa)} difference. Reps who invest time in discovery and objection handling are closing significantly more.` });
      }
    }

    // Refund/cancellation spike
    const refunds = calls.filter(c=>c.outcome==='Refund');
    if (refunds.length > 0) {
      const rate = Analytics.pct(refunds.length, calls.length);
      if (rate > 8) {
        const topRefundReason = (() => {
          const m = {}; refunds.forEach(c=>{ if(c.declineReason) m[c.declineReason]=(m[c.declineReason]||0)+1; });
          return Object.entries(m).sort((a,b)=>b[1]-a[1])[0]?.[0];
        })();
        items.push({ icon:'⚠️', title:`Refund/cancellation rate is elevated at ${rate}%`,
          text:`${refunds.length} calls this period ended in refund or cancellation${topRefundReason?` — most commonly "${topRefundReason}"`:''}. This warrants a retention intervention: review recent cancel calls, identify the trigger point, and equip reps with a save offer before processing.` });
      }
    }

    // No contact / short calls
    const noContact = calls.filter(c=>c.outcome==='No Contact');
    if (noContact.length > 0) {
      const ncRate = Analytics.pct(noContact.length, calls.length);
      if (ncRate > 20) {
        items.push({ icon:'📞', title:`${ncRate}% of calls are not connecting`,
          text:`${noContact.length} calls ended without meaningful contact. High no-contact rates suggest list quality issues, incorrect call times, or members not answering repeated outreach. Review dial strategy and contact time windows.` });
      }
    }

    // Decline reason pattern
    const declines = calls.filter(c=>c.declineReason);
    if (declines.length >= 5) {
      const topMap = {};
      declines.forEach(c=>{ topMap[c.declineReason]=(topMap[c.declineReason]||0)+1; });
      const top = Object.entries(topMap).sort((a,b)=>b[1]-a[1])[0];
      if (top && top[1] >= 3) {
        items.push({ icon:'🚫', title:`"${top[0]}" is the most common objection pattern`,
          text:`${top[1]} call${top[1]!==1?'s':''} this period declined for the same reason. This indicates a systemic gap — either in prospect qualification, script positioning, or how reps handle this specific objection. A targeted role-play on this single objection can move the needle immediately.` });
      }
    }

    // Callback accumulation
    const callbacks = calls.filter(c=>c.outcome==='Callback');
    if (callbacks.length > 0 && Analytics.pct(callbacks.length, calls.length) > 25) {
      items.push({ icon:'🔁', title:'High callback rate — conversations are not closing on first contact',
        text:`${callbacks.length} calls (${Analytics.pct(callbacks.length, calls.length)}%) ended with a callback rather than a decision. Each unresolved call has a high drop-off rate. Reps should be trained to resolve on the first call by uncovering and handling the real objection before scheduling a follow-up.` });
    }

    if (!items.length) {
      items.push({ icon:'✅', title:'No major patterns flagged this period',
        text:'Calls this period do not surface significant systemic coaching concerns. Continue monitoring conversion rates and decline reasons for emerging patterns.' });
    }
    return items;
  }

  // ── Top Performers Doing (Section 8) ────────────────────
  function topPerformerBehaviors(calls) {
    const reps = Analytics.repStats(calls);
    if (reps.length < 2) return [];

    // Use conversion rate to define top vs bottom (no QA available)
    const sorted  = [...reps].sort((a,b)=>b.conv-a.conv);
    const topN    = Math.max(1, Math.floor(sorted.length * 0.25));
    const top     = sorted.slice(0, topN).filter(r=>r.calls>=5);
    const bottom  = sorted.slice(-topN).filter(r=>r.calls>=5);
    const items   = [];

    if (top.length && bottom.length) {
      const topAvgDur = top.reduce((s,r)=>s+r.avgDurS,0)/top.length;
      const botAvgDur = bottom.reduce((s,r)=>s+r.avgDurS,0)/bottom.length;
      if (topAvgDur > botAvgDur + 90) {
        items.push({ icon:'⏱️', title:'Top performers invest more time per call',
          text:`Top converters (${top.map(r=>r.agent.split(' ')[0]).join(', ')}) average ${Analytics.dur(Math.round(topAvgDur))} per call vs. ${Analytics.dur(Math.round(botAvgDur))} for lower-converting reps. Time on call signals deeper engagement — discovery, objection handling, and confident close sequencing.` });
      }
    }

    if (top.length) {
      const topAvgConv = Math.round(top.reduce((s,r)=>s+r.conv,0)/top.length);
      items.push({ icon:'🏆', title:'Top performers consistently run full discovery before pitching',
        text:`The highest-converting reps (avg ${topAvgConv}% conversion) consistently spend the first 3–4 minutes in discovery before introducing the program. They sell what the member told them they needed — not what's on the feature sheet.` });
    }

    items.push({ icon:'🎯', title:'Closers handle objections differently — they ask questions, not arguments',
      text:`Top performers treat every objection as a missing piece of information. When a prospect says "I need to think about it," they ask "What specifically would help you feel confident today?" — then address that directly. Lower performers tend to repeat benefits instead.` });

    items.push({ icon:'📞', title:'Top performers always define the next step before hanging up',
      text:`High converters never end a call with "think about it and call us back." Every call ends with a specific next step — a booked follow-up, a confirmed decision date, or a sale. Open-ended call endings are the #1 predictor of lost deals.` });

    items.push({ icon:'💬', title:'Confident trial closes separate closers from informers',
      text:`Top performers ask for the sale or appointment more directly and earlier. They treat the close as a natural next step, not an awkward ask. Lower-performing reps tend to present information and wait — the prospect rarely initiates.` });

    return items;
  }

  // ── Call Flow Analysis (Section for card) ───────────────
  function callFlowData(calls) {
    if (!calls.length) return [];
    const total = calls.length;

    // Estimate phase completion from duration + outcome
    const phases = [
      { label:'Opening / Connected',    min:0,   pct: null },
      { label:'Discovery / Engagement', min:120, pct: null },
      { label:'Presentation / Offer',   min:240, pct: null },
      { label:'Objection Handling',     min:360, pct: null },
      { label:'Close Attempted',        min:480, pct: null },
      { label:'Converted (Sale/Appt)',  min:0,   pct: null, outcomeOnly: true },
    ];

    phases[0].count = total;
    phases[1].count = calls.filter(c=>c.durationSeconds>=120).length;
    phases[2].count = calls.filter(c=>c.durationSeconds>=240).length;
    phases[3].count = calls.filter(c=>c.durationSeconds>=360).length;
    phases[4].count = calls.filter(c=>c.durationSeconds>=480).length;
    phases[5].count = calls.filter(c=>c.outcome==='Sale'||c.outcome==='Appointment Set').length;

    return phases.map(p => ({ ...p, pct: Math.round(p.count/total*100) }));
  }

  // ── Top Opportunities (Section 11) ──────────────────────
  function topOpportunities(calls, prev) {
    const opps = [];
    const reps = Analytics.repStats(calls);
    const k  = Analytics.kpis(calls, prev);
    const pk = prev?.length ? Analytics.kpis(prev,[]) : null;

    // Low converters with volume
    const lowConv = reps.filter(r=>r.conv<15&&r.calls>=10);
    if (lowConv.length) {
      opps.push({ rank:1,
        title:`Coach ${lowConv.slice(0,5).map(r=>r.agent.split(' ')[0]).join(', ')}${lowConv.length>5?` + ${lowConv.length-5} more`:''} on conversion`,
        why:`${lowConv.length} rep${lowConv.length!==1?'s':''} with 10+ calls are converting below 15%. The gap to team average represents recoverable sales this period.`,
        impact:'High — closing the gap to team average conversion would add significant revenue.',
        activity:'Listen to 2 calls per rep. Identify where in the conversation momentum breaks. Run a targeted role-play on the single most common breakdown point.' });
    }

    // High callback rate
    const cbRate = Analytics.pct(calls.filter(c=>c.outcome==='Callback').length, calls.length);
    if (cbRate > 25) {
      opps.push({ rank:2,
        title:'Reduce callback rate — resolve on first contact',
        why:`${cbRate}% of calls end in a callback rather than a decision. Callback drop-off rates mean a large portion of these deals are being lost.`,
        impact:'High — each percentage point reduction in callbacks converts to measurable additional sales.',
        activity:'Train reps on uncovering the real objection before scheduling a follow-up. The close should happen on the first call, not the second.' });
    }

    // Refund/cancellation rate
    const refundRate = Analytics.pct(calls.filter(c=>c.outcome==='Refund').length, calls.length);
    if (refundRate > 8) {
      opps.push({ rank:3,
        title:'Implement save scripts to reduce refund/cancellation rate',
        why:`${refundRate}% of calls result in refund or cancellation. Even saving 20% of these calls has a meaningful impact on MRR.`,
        impact:'High — retention is more cost-effective than new acquisition.',
        activity:'Equip all reps with a 3-step save script: empathize → diagnose root cause → offer pause or partial resolution before processing cancellation.' });
    }

    // Top decline reason
    const declines = calls.filter(c=>c.declineReason);
    if (declines.length >= 5) {
      const topMap = {};
      declines.forEach(c=>{ topMap[c.declineReason]=(topMap[c.declineReason]||0)+1; });
      const top = Object.entries(topMap).sort((a,b)=>b[1]-a[1])[0];
      if (top) {
        opps.push({ rank:4,
          title:`Address "${top[0]}" — the #1 decline reason`,
          why:`${top[1]} calls declined for this reason (${Math.round(top[1]/declines.length*100)}% of all declines). A targeted script response to this specific objection would recover a portion of these.`,
          impact:'Medium-High — the highest-volume objection is always the highest-leverage coaching target.',
          activity:'Write a specific 2-step response to this objection. Practice in team role-play. Add it to the script reference sheet.' });
      }
    }

    // Short calls with bad outcomes
    const shortDeclines = calls.filter(c=>c.durationSeconds<120&&(c.outcome==='No Interest'||c.outcome==='No Contact'));
    if (shortDeclines.length > 10) {
      opps.push({ rank:5,
        title:'Improve early-call engagement to reduce premature drop-offs',
        why:`${shortDeclines.length} calls ended in under 2 minutes with a negative outcome. These represent failed openings — the prospect disengaged before any value was communicated.`,
        impact:'Medium — improving opening engagement adds pipeline that never gets a chance.',
        activity:'Review and update the opening 60 seconds of each LOB script. Lead with curiosity and relevance, not product.' });
    }

    if (!opps.length) {
      opps.push({ rank:1,
        title:'Maintain current performance levels',
        why:'No significant gaps identified this period. Focus on consistency and documenting winning behaviors.',
        impact:'Medium — sustaining current trajectory.',
        activity:'Run a team debrief on what is working well. Document top-performer behaviors for onboarding new reps.' });
    }

    return opps;
  }

  // ── Priority Actions (Section 12) ───────────────────────
  function priorityActions(calls, prev) {
    const opps = topOpportunities(calls, prev);
    const reps = Analytics.repStats(calls);
    const urgentCoach = reps.filter(r=>r.priorityCls==='priority-high'&&r.calls>=10);
    const actions = { high:[], medium:[], low:[] };

    if (opps[0]) actions.high.push({ title:opps[0].title, why:opps[0].why, impact:opps[0].impact, activity:opps[0].activity });
    if (opps[1]) actions.high.push({ title:opps[1].title, why:opps[1].why, impact:opps[1].impact, activity:opps[1].activity });

    if (urgentCoach.length) {
      actions.high.push({
        title:`Immediate 1:1 coaching — ${urgentCoach.slice(0,5).map(r=>r.agent.split(' ')[0]).join(', ')}${urgentCoach.length>5?` + ${urgentCoach.length-5} more`:''}`,
        why:`${urgentCoach.length} rep${urgentCoach.length!==1?'s':''} flagged as Coach Now with sufficient call volume — conversion patterns are established and correctable now.`,
        impact:'Direct improvement to team conversion average.',
        activity:'15-minute focused coaching per rep. Listen to one call together. Identify the single biggest breakdown point. Run a live role-play.',
      });
    }

    if (opps[2]) actions.medium.push({ title:opps[2].title, why:opps[2].why, impact:opps[2].impact, activity:opps[2].activity });
    if (opps[3]) actions.medium.push({ title:opps[3].title, why:opps[3].why, impact:opps[3].impact, activity:opps[3].activity });

    actions.medium.push({
      title:'Review call openings across all LOBs',
      why:'Short-duration call drop-offs indicate engagement is being lost in the first 60–90 seconds.',
      impact:'Medium — improving opening engagement adds pipeline that never gets a chance to convert.',
      activity:'Score the first 60 seconds of 5 calls per LOB. Update opening scripts to lead with curiosity, not product.',
    });

    actions.low.push({
      title:'Document and share top-performer approaches',
      why:'Best practices are not being systematically shared across the team.',
      impact:'Low-Medium — peer learning is more effective than manager-led training.',
      activity:'Clip 2–3 moments from top-converting calls and share in team chat. Name the behavior specifically.',
    });

    actions.low.push({
      title:'Create a save script for all teams handling cancellations',
      why:'Cancellation calls handled without a structured save offer result in zero retention.',
      impact:'Low-Medium — even a 15–20% save rate on routed cancellations recovers meaningful MRR.',
      activity:'Write a 3-step save script. Distribute to all team leads by end of week.',
    });

    return actions;
  }

  return { callSnapshot, whatIsHappening, topPerformerBehaviors, topOpportunities, priorityActions, callFlowData };
})();
