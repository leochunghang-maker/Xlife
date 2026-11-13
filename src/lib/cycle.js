import { todayISO, toLocalDate, daysBetween } from "./dates";

// Phase estimate for a date. Defaults reproduce the original 28/5-day model;
// callers pass the user's own averages from predictCycle() when available.
// Ovulation is estimated 14 days before the next period (luteal phase).
export function getCyclePhase(cycleStart, dateISO, cycleLength = 28, periodLength = 5) {
  if (!cycleStart) return { phase: "follicular", day: 1 };
  const length = Math.min(60, Math.max(15, Math.round(cycleLength) || 28));
  const cycleDay = (((daysBetween(cycleStart, dateISO) % length) + length) % length) + 1;
  const ovulationDay = length - 14;
  if (cycleDay <= Math.max(1, Math.round(periodLength) || 5)) return { phase: "period", day: cycleDay };
  if (cycleDay < ovulationDay - 1) return { phase: "follicular", day: cycleDay };
  if (cycleDay <= ovulationDay + 1) return { phase: "ovulation", day: cycleDay };
  return { phase: "luteal", day: cycleDay };
}
export function toggleListValue(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
export function formatCycleDateTitle(dateISO) {
  const date = toLocalDate(dateISO);
  const formatted = date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return dateISO === todayISO ? `Today, ${formatted}` : formatted;
}
