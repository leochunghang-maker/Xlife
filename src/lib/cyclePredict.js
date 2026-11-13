// Cycle estimates learned from the user's own logged period days
// (dayflow_period_logs). Approach similar to Apple Health / Clue: average of
// recent cycle lengths, ovulation ~14 days before the next period, fertile
// window = 5 days before ovulation + ovulation day. These are estimates only —
// not medical advice and not a form of contraception.
import { todayISO, toLocalDate, toISODate, daysBetween } from "./dates";

const DEFAULT_CYCLE = 28;
const DEFAULT_PERIOD = 5;

function addDays(iso, days) {
  const date = toLocalDate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function isLoggedPeriodDay(entry) {
  return entry?.phase === "period" && entry?.flow && entry.flow !== "none";
}

// Groups logged period days into periods (a gap of up to 2 days joins them).
export function findPeriods(periodLogs = {}) {
  const days = Object.keys(periodLogs).filter((date) => isLoggedPeriodDay(periodLogs[date])).sort();
  const periods = [];
  days.forEach((date) => {
    const last = periods[periods.length - 1];
    if (last && daysBetween(last.end, date) <= 3) last.end = date;
    else periods.push({ start: date, end: date });
  });
  return periods.map((period) => ({ ...period, length: daysBetween(period.start, period.end) + 1 }));
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function predictCycle(periodLogs = {}, today = todayISO) {
  const periods = findPeriods(periodLogs).filter((period) => period.start <= today);
  const cycleLengths = [];
  for (let i = 1; i < periods.length; i += 1) {
    const length = daysBetween(periods[i - 1].start, periods[i].start);
    if (length >= 15 && length <= 60) cycleLengths.push(length);
  }
  const recentCycles = cycleLengths.slice(-6);
  const recentPeriods = periods.slice(-6).map((period) => period.length).filter((length) => length <= 10);
  const avgCycle = recentCycles.length ? Math.round(mean(recentCycles)) : DEFAULT_CYCLE;
  const avgPeriod = recentPeriods.length ? Math.max(1, Math.round(mean(recentPeriods))) : DEFAULT_PERIOD;
  const lastStart = periods.length ? periods[periods.length - 1].start : null;
  const variation = recentCycles.length >= 2 ? Math.max(...recentCycles) - Math.min(...recentCycles) : 0;

  if (!lastStart) {
    return { hasData: false, cycles: 0, avgCycle, avgPeriod, periods, cycleLengths, lastStart: null };
  }

  let nextStart = addDays(lastStart, avgCycle);
  const daysLate = daysBetween(nextStart, today);
  const late = daysLate > 0 ? daysLate : 0;
  // If several cycles were skipped in logging, roll forward to the next future estimate.
  if (late > avgCycle) {
    while (nextStart < today) nextStart = addDays(nextStart, avgCycle);
  }
  const ovulation = addDays(nextStart, -14);
  const fertileStart = addDays(ovulation, -5);

  return {
    hasData: true,
    cycles: recentCycles.length,
    confidence: recentCycles.length >= 3 ? "higher" : recentCycles.length >= 1 ? "low" : "very low",
    usingDefaults: recentCycles.length === 0,
    avgCycle,
    avgPeriod,
    variation,
    irregular: recentCycles.length >= 3 && (variation > 7 || avgCycle < 21 || avgCycle > 35),
    lastStart,
    nextStart,
    nextEnd: addDays(nextStart, avgPeriod - 1),
    daysUntilNext: daysBetween(today, nextStart),
    lateBy: late > 0 && late <= avgCycle ? late : 0,
    ovulation,
    fertileStart,
    fertileEnd: ovulation,
    periods,
    cycleLengths,
  };
}

export function isInRange(dateISO, start, end) {
  return Boolean(start && end && dateISO >= start && dateISO <= end);
}

// Summary rows for the printable report (last 12 months).
export function buildCycleReport(periodLogs = {}, today = todayISO) {
  const since = addDays(today, -365);
  const prediction = predictCycle(periodLogs, today);
  const periods = prediction.periods.filter((period) => period.start >= since);
  const rows = periods.map((period, index) => {
    const next = periods[index + 1];
    return { start: period.start, end: period.end, periodLength: period.length, cycleLength: next ? daysBetween(period.start, next.start) : null };
  });
  const symptomCounts = {};
  Object.entries(periodLogs).forEach(([date, entry]) => {
    if (date < since) return;
    (entry?.symptoms || []).forEach((symptom) => { symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1; });
  });
  return { since, today, prediction, rows, symptomCounts };
}
