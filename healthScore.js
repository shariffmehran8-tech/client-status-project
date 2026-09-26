// healthScore.js
// Composite "relationship health" scoring — combines payment timeliness,
// responsiveness, scope stability, and sentiment into one weighted 0-100 index.

const DEFAULT_WEIGHTS = {
  payment: 0.30,
  responsiveness: 0.20,
  scopeStability: 0.20,
  sentiment: 0.30,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function withinWindow(dateStr, asOf, windowDays) {
  const t = new Date(dateStr).getTime();
  const end = new Date(asOf).getTime();
  const start = end - windowDays * DAY_MS;
  return t <= end && t >= start;
}

function scorePayment(payments, asOf, windowDays = 90) {
  const inWindow = payments.filter((p) => p.paidDate && withinWindow(p.paidDate, asOf, windowDays));
  if (inWindow.length === 0) return { score: null, sample: 0, avgDaysLate: null };

  const daysLateList = inWindow.map((p) => {
    const due = new Date(p.dueDate).getTime();
    const paid = new Date(p.paidDate).getTime();
    return (paid - due) / DAY_MS;
  });
  const avgDaysLate = daysLateList.reduce((a, b) => a + b, 0) / daysLateList.length;
  const score = clamp(100 - Math.max(0, avgDaysLate) * 7);
  return { score: Math.round(score), sample: inWindow.length, avgDaysLate: Math.round(avgDaysLate * 10) / 10 };
}

function scoreResponsiveness(responses, asOf, windowDays = 60) {
  const inWindow = responses.filter((r) => withinWindow(r.date, asOf, windowDays));
  if (inWindow.length === 0) return { score: null, sample: 0, avgHours: null };

  const avgHours = inWindow.reduce((a, r) => a + r.hoursToReply, 0) / inWindow.length;
  const score = clamp(100 - Math.max(0, avgHours - 4) * 5);
  return { score: Math.round(score), sample: inWindow.length, avgHours: Math.round(avgHours * 10) / 10 };
}

function scoreScopeStability(scopeEvents, asOf, windowDays = 90) {
  const inWindow = scopeEvents.filter((e) => withinWindow(e.date, asOf, windowDays));
  if (inWindow.length === 0) return { score: 100, sample: 0, reductions: 0, expansions: 0 };

  let score = 100;
  let reductions = 0;
  let expansions = 0;
  for (const e of inWindow) {
    const mag = e.magnitude ?? 1;
    if (e.type === "reduction") {
      score -= 15 * mag;
      reductions++;
    } else if (e.type === "expansion") {
      score -= 5 * mag;
      expansions++;
    }
  }
  return { score: Math.round(clamp(score)), sample: inWindow.length, reductions, expansions };
}

function scoreSentiment(sentimentLog, asOf, windowDays = 60) {
  const inWindow = sentimentLog.filter((s) => withinWindow(s.date, asOf, windowDays));
  if (inWindow.length === 0) return { score: null, sample: 0, avgSentiment: null };

  const avg = inWindow.reduce((a, s) => a + s.score, 0) / inWindow.length;
  const score = clamp((avg + 1) * 50);
  return { score: Math.round(score), sample: inWindow.length, avgSentiment: Math.round(avg * 100) / 100 };
}

function computeSubScores(client, asOf) {
  const signals = client.signals || {};
  return {
    payment: scorePayment(signals.payments || [], asOf),
    responsiveness: scoreResponsiveness(signals.responses || [], asOf),
    scopeStability: scoreScopeStability(signals.scopeEvents || [], asOf),
    sentiment: scoreSentiment(signals.sentiment || [], asOf),
  };
}

function computeComposite(subScores, weights = DEFAULT_WEIGHTS) {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const key of Object.keys(weights)) {
    const s = subScores[key];
    if (s && s.score !== null) {
      weightedSum += s.score * weights[key];
      totalWeight += weights[key];
    }
  }
  if (totalWeight === 0) return null;
  return Math.round(weightedSum / totalWeight);
}

function computeHealthScore(client, asOf = new Date().toISOString(), weights = client.weights || DEFAULT_WEIGHTS) {
  const subScores = computeSubScores(client, asOf);
  const composite = computeComposite(subScores, weights);
  return { asOf, composite, subScores };
}

function computeTrajectory(client, weeks = 8, weights = client.weights || DEFAULT_WEIGHTS) {
  const points = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const asOf = new Date(now.getTime() - i * 7 * DAY_MS).toISOString();
    const { composite, subScores } = computeHealthScore(client, asOf, weights);
    points.push({ date: asOf.slice(0, 10), score: composite, subScores });
  }
  return points;
}

function classify(score) {
  if (score === null) return "insufficient-data";
  if (score >= 75) return "healthy";
  if (score >= 55) return "steady";
  if (score >= 40) return "at-risk";
  return "critical";
}

function computeAlerts(client, trajectory) {
  const alerts = [];
  const latest = trajectory[trajectory.length - 1];
  const monthAgoIdx = Math.max(0, trajectory.length - 5);
  const monthAgo = trajectory[monthAgoIdx];

  if (latest.score !== null && latest.score < 40) {
    alerts.push({ level: "critical", message: `Health score is critical (${latest.score}/100).` });
  } else if (latest.score !== null && latest.score < 55) {
    alerts.push({ level: "warning", message: `Health score is trending at-risk (${latest.score}/100).` });
  }

  if (latest.score !== null && monthAgo.score !== null) {
    const delta = latest.score - monthAgo.score;
    if (delta <= -15) {
      alerts.push({ level: "warning", message: `Score dropped ${Math.abs(delta)} points over the last ~4 weeks.` });
    }
  }

  const sub = latest.subScores;
  if (sub.scopeStability.reductions >= 2) {
    alerts.push({ level: "warning", message: `${sub.scopeStability.reductions} scope reductions in the last 90 days.` });
  }
  if (sub.payment.avgDaysLate !== null && sub.payment.avgDaysLate > 5) {
    alerts.push({ level: "warning", message: `Payments averaging ${sub.payment.avgDaysLate} days late.` });
  }

  return alerts;
}

module.exports = {
  DEFAULT_WEIGHTS,
  computeSubScores,
  computeComposite,
  computeHealthScore,
  computeTrajectory,
  classify,
  computeAlerts,
};
