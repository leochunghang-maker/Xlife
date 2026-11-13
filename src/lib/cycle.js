import { todayISO, toLocalDate, daysBetween } from "./dates";

export function getCyclePhase(cycleStart, dateISO) {
  if (!cycleStart) return { phase: "follicular", day: 1 };
  const cycleDay = (((daysBetween(cycleStart, dateISO) % 28) + 28) % 28) + 1;
  if (cycleDay <= 5) return { phase: "period", day: cycleDay };
  if (cycleDay <= 12) return { phase: "follicular", day: cycleDay };
  if (cycleDay <= 15) return { phase: "ovulation", day: cycleDay };
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
