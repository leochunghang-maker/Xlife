import { readLocalJSON, writeLocalJSON, createId } from "./storage";
import { todayISO, toLocalDate, toISODate, daysBetween } from "./dates";

// Couple dates (Between / Dote style): anniversary + custom countdowns.
export const COUPLE_KEY = "xlife_couple";

export function readCouple() {
  const saved = readLocalJSON(COUPLE_KEY, {});
  return { anniversary: "", ...saved, countdowns: Array.isArray(saved?.countdowns) ? saved.countdowns : [] };
}

export function saveCouple(next) {
  writeLocalJSON(COUPLE_KEY, next);
}

export function newCountdown(title, date) {
  return { id: createId(), title: title.trim(), date };
}

export function daysTogether(anniversary, today = todayISO) {
  if (!anniversary || anniversary > today) return null;
  return daysBetween(anniversary, today) + 1;
}

export function nextAnniversary(anniversary, today = todayISO) {
  if (!anniversary) return null;
  const start = toLocalDate(anniversary);
  const now = toLocalDate(today);
  let year = now.getFullYear();
  let next = new Date(year, start.getMonth(), start.getDate());
  if (toISODate(next) < today) next = new Date(year + 1, start.getMonth(), start.getDate());
  year = next.getFullYear();
  return { date: toISODate(next), inDays: daysBetween(today, toISODate(next)), years: year - start.getFullYear() };
}

// Upcoming countdowns: custom ones plus finalized plans with a future date.
export function upcomingCountdowns(couple, plans = [], today = todayISO) {
  const custom = couple.countdowns.filter((c) => c.date >= today).map((c) => ({ ...c, kind: "custom" }));
  const planItems = plans
    .filter((plan) => plan.status === "finalized" && plan.date && plan.date >= today)
    .map((plan) => ({ id: `plan-${plan.id}`, title: plan.title || "Plan", date: plan.date, kind: "plan" }));
  return [...custom, ...planItems]
    .map((item) => ({ ...item, inDays: daysBetween(today, item.date) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
