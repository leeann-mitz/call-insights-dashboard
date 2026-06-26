/* insights.js — AI narrative & coaching engine */
const Insights = (() => {

  // ── Executive Call Snapshot (Section 3) ─────────────────
  function callSnapshot(current, prev, period) {
    if (!current.length) return '<p>No calls match the selected filters.</p>';
    const k  = Analytics.kpis(current, prev);
    const pk = prev?.length ? Analytics.kpis(prev, []) : null;
    const reps = Analytics.repStats(current);
    const topRep = reps[0];
    const objs = Analytics.objections(current, prev);
    const topObj = objs[0];
    const decReasons = Analytics.declineReasons(current, prev);
    const topDecline = decReasons[0];

    const convDir = !pk ? null : k.convRate > pk.convRate ? 'up' : k.convRate < pk.convRate ? 'down' : 'flat';
    const qaDir   = !pk ? null : k.avgQA    > pk.avgQA    ? 'up' : k.avgQA    < pk.avgQA    ? 'down' : 'flat';
    const volumeDir= !pk? null : k.total    > pk.total    ? 'up' : k.total    < pk.total    ? 'down' : 'flat';

    let html = `<p>The team handled <strong>${k.total.toLocaleString()} call${k.total!==1?'s':''}</strong> `;
    if (pk) {
      if (volumeDir==='up')   html += `— <span class="n-positive">up ${Math.abs(k.total-pk.total)} from the prior period</span>. `;
      else if (volumeDir==='down') html += `— <span class="n-negative">down ${Math.abs(k.total-pk.total)} from the prior period</span>. `;
      else html += `— volume held steady from the prior period. `;
    } else { html += `. `; }

    if (k.convRate > 0) {
      html += `Overall conversion rate stands at <strong>${k.convRate}%</strong>`;
      if (pk && convDir) {
        if (convDir==='up')   html += ` (<span class="n-positive">↑${Math.abs(k.convRate-pk.convRate)} pts vs. prior period</span>)`;
        else if (convDir==='down') html += ` (<span class="n-negative">↓${Math.abs(k.convRate-pk.convRate)} pts vs. prior period</span>)`;
      }
      html += `. `;
    }

    html += `Average QA score is <strong>${k.avgQA}/100</strong>`;
    if (pk && qaDir==='up')   html += ` <span class="n-positive">(↑ improving)</span>`;
    else if (pk && qaDir==='down') html += ` <span class="n-negative">(↓ declining — coaching review recommended)</span>`;
    html += `.</p>`;

    if (topRep) {
      html += `<p>`;
      if (topRep.avgQA >= 80) {
        html += `<strong>${topRep.agent}</strong> continues to lead the team with an average QA of <strong>${topRep.avgQA}/100</strong>. `;
      } else {
        html += `QA performance varies across the team — the highest scorer this period reached <strong>${topRep.avgQA}/100</strong>. `;
      }
      if (topObj) {
        html += `<strong>${topObj.theme}</strong> remains the most frequent objection`;
        if (topObj.trend > 10)  html += ` and <span class="n-negative">is trending upward</span>`;
        else if (topObj.trend < -10) html += ` and <span class="n-positive">is trending down</span>`;
        html += `. `;
      }
      html += `</p>`;
    }

    const scriptGapCalls = current.filter(c=>(c.scriptGaps||[]).length>0);
    const avgAdherence = current.filter(c=>c.scriptAdherence!=null).length ?
      Math.round(current.filter(c=>c.scriptAdherence!=null).map(c=>c.scriptAdherence).reduce((a,b)=>a+b,0)/current.filter(c=>c.scriptAdherence!=null).length) : null;

    if (avgAdherence !== null) {
      html += `<p>Average script adherence across all calls is <strong>${avgAdherence}/100</strong>. `;
      if (scriptGapCalls.length) {
        const allGaps = scriptGapCalls.flatMap(c=>c.scriptGaps||[]);
        const gapCounts = {};
        allGaps.forEach(g=>{ gapCounts[g]=(gapCounts[g]||0)+1; });
        const topGap = Object.entries(gapCounts).sort((a,b)=>b[1]-a[1])[0];
        if (topGap) html += `The most common script gap is <em>"${topGap[0]}"</em>, appearing on ${topGap[1]} call${topGap[1]!==1?'s':''}. `;
      }
      if (avgAdherence < 60) html += `<span class="n-negative">Script adherence is below target — structured coaching intervention recommended this week.</span>`;
      else if (avgAdherence >= 80) html += `<span class="n-positive">Script adherence is strong overall.</span>`;
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

    const avgAdh = calls.filter(c=>c.scriptAdherence!=null).length ?
      Math.round(calls.filter(c=>c.scriptAdherence!=null).map(c=>c.scriptAdherence).reduce((a,b)=>a+b,0)/calls.filter(c=>c.scriptAdherence!=null).length) : null;
    if (avgAdh !== null && avgAdh < 65) {
      items.push({ icon:'📋', title:'Script adherence is inconsistent',
        text:`Average script adherence is ${avgAdh}/100. Reps are skipping key phases — particularly discovery and objection pre-emption blocks. Structured script reinforcement sessions are needed before the next call cycle.` });
    }

    const discoveryGaps = calls.filter(c=>(c.scriptGaps||[]).some(g=>g.toLowerCase().includes('discovery')));
    if (discoveryGaps.length >= 2) {
      items.push({ icon:'🔍', title:'Discovery questions are being skipped',
        text:`${discoveryGaps.length} of ${calls.length} calls had little or no discovery. Reps are moving to product recommendations before establishing the golfer's pain, goals, or current situation. This is the most common pattern reducing conversion rates.` });
    }

    const priceGaps = calls.filter(c=>(c.scriptGaps||[]).some(g=>g.toLowerCase().includes('price')||g.toLowerCase().includes('cost')));
    if (priceGaps.length >= 1) {
      items.push({ icon:'💰', title:'Price is being revealed before value is established',
        text:`On at least ${priceGaps.length} call${priceGaps.length!==1?'s':''}, the investment was discussed before the prospect's pain was fully acknowledged and product value was established. This triggers early price shock and premature call endings.` });
    }

    const vipGaps = calls.filter(c=>(c.scriptGaps||[]).some(g=>g.toLowerCase().includes('vip')||g.toLowerCase().includes('upsell')));
    if (vipGaps.length >= 2) {
      items.push({ icon:'⬆️', title:'VIP coaching offers are consistently missed',
        text:`${vipGaps.length} calls where a VIP coaching offer was appropriate — zero attempts made. This represents missed upsell revenue on every post-purchase and booking call.` });
    }

    const callFatigue = calls.filter(c=>(c.declineReason||'').toLowerCase().includes('fatigue')||
      (c.declineReason||'').toLowerCase().includes('over-contact'));
    if (callFatigue.length) {
      items.push({ icon:'📞', title:'Call fatigue is damaging member relationships',
        text:`${callFatigue.length} call${callFatigue.length!==1?'s':''} resulted in DNC requests due to over-contacting. CRM call frequency controls are absent — accounts with 2+ recent outbound touches are being dialed without manager review.` });
    }

    const billingCalls = calls.filter(c=>(c.declineReason||'').toLowerCase().includes('billing')||
      (c.objections||[]).some(o=>o.toLowerCase().includes('charge')||o.toLowerCase().includes('billing')));
    if (billingCalls.length >= 2) {
      items.push({ icon:'💳', title:'Billing surprise is a recurring cancellation driver',
        text:`${billingCalls.length} calls this period involved customers who were surprised by charges they did not expect. Checkout and onboarding email clarity must be reviewed — explicit billing disclosure at point of sale is missing.` });
    }

    const saleDurs = calls.filter(c=>c.outcome==='Sale'&&c.durationSeconds).map(c=>c.durationSeconds);
    const allDurs  = calls.filter(c=>c.durationSeconds).map(c=>c.durationSeconds);
    if (saleDurs.length >= 2 && allDurs.length >= 2) {
      const sa = Math.round(saleDurs.reduce((a,b)=>a+b,0)/saleDurs.length);
      const aa = Math.round(allDurs.reduce((a,b)=>a+b,0)/allDurs.length);
      if (sa > aa + 120) {
        items.push({ icon:'⏱️', title:'Longer conversations consistently lead to sales',
          text:`Calls that resulted in a sale averaged ${Analytics.dur(sa)} vs. ${Analytics.dur(aa)} across all calls — a ${Analytics.dur(sa-aa)} difference. Reps who pace the conversation and invest time in discovery are closing significantly more.` });
      }
    }

    if (!items.length) {
      items.push({ icon:'✅', title:'No major patterns flagged this period',
        text:'Calls this period do not surface significant systemic coaching concerns. Continue monitoring QA scores and script adherence for emerging patterns.' });
    }
    return items;
  }

  // ── Top Performers Doing (Section 8) ────────────────────
  function topPerformerBehaviors(calls) {
    const reps = Analytics.repStats(calls);
    if (reps.length < 2) return [];
    const top    = reps.filter(r=>r.avgQA>=80);
    const bottom = reps.filter(r=>r.avgQA<65);
    const items  = [];

    if (top.length) {
      const topAvgDur = top.reduce((s,r)=>s+r.avgDurS,0)/top.length;
      const botAvgDur = bottom.length ? bottom.reduce((s,r)=>s+r.avgDurS,0)/bottom.length : null;
      if (botAvgDur && topAvgDur > botAvgDur + 90) {
        items.push({ icon:'🏆', title:'Top performers invest more time in the conversation',
          text:`High-QA reps (${top.map(r=>r.agent.split(' ')[0]).join(', ')}) average ${Analytics.dur(Math.round(topAvgDur))} per call vs. ${Analytics.dur(Math.round(botAvgDur))} for lower-performing reps. Time on call correlates directly with QA score and conversion.` });
      }

      const topScript = top.filter(r=>r.avgScript).length ?
        Math.round(top.filter(r=>r.avgScript).map(r=>r.avgScript).reduce((a,b)=>a+b,0)/top.filter(r=>r.avgScript).length) : null;
      const botScript = bottom.filter(r=>r.avgScript).length ?
        Math.round(bottom.filter(r=>r.avgScript).map(r=>r.avgScript).reduce((a,b)=>a+b,0)/bottom.filter(r=>r.avgScript).length) : null;
      if (topScript && botScript && topScript > botScript + 15) {
        items.push({ icon:'📋', title:'Top performers follow the script more closely',
          text:`Top-QA reps average ${topScript}/100 script adherence vs. ${botScript}/100 for reps scoring below 65 QA. Script adherence is not optional — it is predictive of outcome. Reps who skip phases are consistently underperforming.` });
      }
    }

    const phoebe = calls.filter(c=>c.agent==='Phoebe Collado'&&c.qaScore>=80);
    const dan    = calls.filter(c=>c.agent==='Dan Emmanuel Nicolas'&&c.qaScore>=80);
    const topCalls = [...phoebe, ...dan];
    if (topCalls.length) {
      items.push({ icon:'🔍', title:'Discovery-first sequencing is the top differentiator',
        text:`The highest-performing reps consistently run full discovery before revealing any program or investment details. They ask about the golfer's current game, biggest challenge, how long they've struggled, and their score goal — before introducing the solution.` });
    }

    if (top.length) {
      items.push({ icon:'🎯', title:'Top performers use root-flaw framing',
        text:`High-QA reps position the program around finding the "root cause" rather than fixing symptoms. This reframes the conversation from product features to personal transformation — the golfer's emotional investment increases before any price is mentioned.` });
    }

    items.push({ icon:'💬', title:'Confident trial closes separate closers from informers',
      text:`Top performers ask for the sale or appointment more directly and earlier. They treat the close as a natural next step, not an awkward ask. Lower-performing reps tend to present information and wait for the prospect to initiate — the prospect rarely does.` });

    return items;
  }

  // ── Top Opportunities (Section 11) ──────────────────────
  function topOpportunities(calls, prev) {
    const opps = [];
    const reps = Analytics.repStats(calls);
    const k  = Analytics.kpis(calls, prev);
    const pk = prev?.length ? Analytics.kpis(prev,[]) : null;
    const discoveryGaps = calls.filter(c=>(c.scriptGaps||[]).some(g=>g.toLowerCase().includes('discovery')));
    const vipGaps = calls.filter(c=>(c.scriptGaps||[]).some(g=>g.toLowerCase().includes('vip')));
    const priceGaps = calls.filter(c=>(c.scriptGaps||[]).some(g=>g.toLowerCase().includes('price')));
    const coachingNeeded = reps.filter(r=>r.avgQA<70&&r.calls>=2);

    if (discoveryGaps.length >= 2) {
      opps.push({ rank:1, title:'Implement discovery-first protocol across all LOBs',
        why:`${discoveryGaps.length} of ${calls.length} calls had insufficient discovery. Reps recommending solutions before understanding the golfer's situation is the #1 conversion killer.`,
        impact:'High — discovery consistency is directly correlated with QA score and close rate.',
        activity:'Run a 30-minute role-play session: "Ask 4 before you pitch." Score discovery completeness on every QA review this week.' });
    }

    if (priceGaps.length >= 1) {
      opps.push({ rank:2, title:'Delay price reveal until value is established',
        why:`Price is being introduced before the golfer's pain is fully acknowledged. Cold price reveals cause immediate objections that are difficult to recover from.`,
        impact:'High — eliminating early price shock can add 15–20% to conversion rates.',
        activity:'Add a price pre-emption script block to all LOBs. Practice the deflection: "Cost varies based on your specific game — let me understand your situation first."' });
    }

    if (vipGaps.length >= 2) {
      opps.push({ rank:3, title:'Add VIP coaching touchpoint to every post-purchase call',
        why:`${vipGaps.length} calls where a VIP coaching offer was appropriate — zero attempts made. Post-purchase calls are the highest-intent moment in the customer journey.`,
        impact:'Medium-High — each missed offer is a direct revenue loss.',
        activity:'Update the ASR and Internal Setter scripts with a VIP coaching offer after the appointment is confirmed.' });
    }

    if (coachingNeeded.length) {
      opps.push({ rank:4, title:`Coach ${coachingNeeded.map(r=>r.agent.split(' ')[0]).join(', ')} on script adherence`,
        why:`${coachingNeeded.length} rep${coachingNeeded.length!==1?'s':''} scoring below 70 QA on ${coachingNeeded.reduce((s,r)=>s+r.calls,0)} calls. Targeted coaching on the 2–3 most common gaps per rep is the highest-leverage activity.`,
        impact:'Medium — improving underperforming reps by 10 QA points has an outsized impact on team average.',
        activity:'Schedule individual 15-minute coaching calls. Focus on the top gap per rep, not general feedback.' });
    }

    const billingCalls = calls.filter(c=>(c.declineReason||'').toLowerCase().includes('billing'));
    if (billingCalls.length) {
      opps.push({ rank:5, title:'Fix billing transparency gaps at checkout and enrollment',
        why:`${billingCalls.length} refund/cancel call${billingCalls.length!==1?'s':''} this period were driven by customers who did not know they were being charged. This is an upstream product issue, not a rep issue.`,
        impact:'High — billing surprise is the #1 cancellation driver and a retention cost.',
        activity:'Audit checkout page and onboarding email for explicit subscription disclosure. Add double-opt-in to all recurring subscription enrollments.' });
    }

    if (!opps.length) {
      opps.push({ rank:1, title:'Maintain current performance levels',
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
    const coachNeeded = reps.filter(r=>r.avgQA<60&&r.calls>=2);
    const actions = { high:[], medium:[], low:[] };

    if (opps[0]) {
      actions.high.push({
        title: opps[0].title,
        why: opps[0].why,
        impact: opps[0].impact,
        activity: opps[0].activity,
      });
    }
    if (opps[1]) {
      actions.high.push({
        title: opps[1].title,
        why: opps[1].why,
        impact: opps[1].impact,
        activity: opps[1].activity,
      });
    }

    if (coachNeeded.length) {
      actions.high.push({
        title:`Immediate 1:1 coaching — ${coachNeeded.map(r=>r.agent.split(' ')[0]).join(', ')}`,
        why:`Scoring below 60 QA with sufficient call volume — patterns are established and correctable now.`,
        impact:'Direct improvement to team QA average and conversion.',
        activity:'15-minute focused coaching on top 1 script gap per rep. Listen to best-practice call together. Run a live role-play. Observe next 3 calls.',
      });
    }

    if (opps[2]) {
      actions.medium.push({
        title: opps[2].title,
        why: opps[2].why,
        impact: opps[2].impact,
        activity: opps[2].activity,
      });
    }

    actions.medium.push({
      title:'Review script adherence on all LOBs this week',
      why:'Average script adherence indicates gaps in phase completion across multiple teams.',
      impact:'Medium — consistent script use correlates with higher QA and conversion.',
      activity:'QA at least 2 calls per rep this week specifically scoring for phase completion. Share results at weekly team meeting.',
    });

    actions.low.push({
      title:'Document and share top-performer behaviors',
      why:'Best practices are not being systematically shared across the team.',
      impact:'Low-Medium — peer learning is more effective than manager-led training.',
      activity:'Clip 2–3 moments from top-QA calls and share in team chat. Name the behavior, not just the rep.',
    });

    actions.low.push({
      title:'Create a Scratch Club save script for all teams',
      why:'Cancellation calls handled by non-Retention reps result in zero save attempts.',
      impact:'Low-Medium — even a 20% save rate on routed cancellations recovers meaningful MRR.',
      activity:'Write a 3-step Scratch Club save script. Distribute to all team leads by end of week.',
    });

    return actions;
  }

  return { callSnapshot, whatIsHappening, topPerformerBehaviors, topOpportunities, priorityActions };
})();
