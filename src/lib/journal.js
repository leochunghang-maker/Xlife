import { todayISO, toLocalDate, toISODate, daysBetween } from "./dates";
import { readLocalJSON } from "./storage";

// Reflection prompts (Day One style). Static, written for Xlife.
export const JOURNAL_PROMPTS = [
  "What made you smile today?",
  "What's one thing you're grateful for right now?",
  "What drained your energy today, and what gave it back?",
  "Describe a small win from today.",
  "What did you learn about yourself this week?",
  "Who made your day better, and how?",
  "What would make tomorrow great?",
  "What's on your mind that you haven't said out loud?",
  "How did your body feel today?",
  "What's something you're looking forward to?",
  "What would you tell yourself from a year ago?",
  "Which moment today do you want to remember?",
];

export function promptForDay(dateISO = todayISO, offset = 0) {
  const start = new Date(toLocalDate(dateISO).getFullYear(), 0, 1);
  const dayOfYear = daysBetween(toISODate(start), dateISO);
  const n = JOURNAL_PROMPTS.length;
  return JOURNAL_PROMPTS[(((dayOfYear + offset) % n) + n) % n];
}

// Notes written exactly 1 week / 1 month / 1 year ago (from the day archive).
export function notesOnThisDay(today = todayISO) {
  const archive = readLocalJSON("dayflow_daily_logs", {});
  const t = toLocalDate(today);
  const targets = [
    { label: "1 week ago", date: new Date(t.getFullYear(), t.getMonth(), t.getDate() - 7) },
    { label: "1 month ago", date: new Date(t.getFullYear(), t.getMonth() - 1, t.getDate()) },
    { label: "1 year ago", date: new Date(t.getFullYear() - 1, t.getMonth(), t.getDate()) },
  ];
  return targets
    .map((target) => {
      const iso = toISODate(target.date);
      return { label: target.label, iso, notes: archive?.[iso]?.notes || "" };
    })
    .filter((item) => item.notes.trim());
}
