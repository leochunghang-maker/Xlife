import { readLocalJSON, writeLocalJSON } from "./storage";
import { todayISO, toLocalDate, toISODate, daysBetween } from "./dates";

// Couple question of the day. Answers are kept locally (xlife_daily_answers)
// and, when paired through Xlife Cloud, revealed to the partner only after
// they answer too (enforced by RLS in supabase/migrations).
export const DAILY_QUESTIONS = [
  "What's one small thing I did recently that you appreciated?",
  "Where would you go if we had a free weekend?",
  "What song reminds you of us?",
  "What's something new you'd like us to try together?",
  "What made you laugh this week?",
  "What's a favourite memory of ours from this year?",
  "How can I support you better this week?",
  "What's a meal you'd love us to cook together?",
  "What are you most looking forward to this month?",
  "What's one habit you'd like us to build together?",
  "What was the highlight of your day?",
  "If we had a theme song for this week, what would it be?",
];
export const ANSWERS_KEY = "xlife_daily_answers";

export function questionForDay(dateISO = todayISO) {
  const start = toISODate(new Date(toLocalDate(dateISO).getFullYear(), 0, 1));
  return DAILY_QUESTIONS[daysBetween(start, dateISO) % DAILY_QUESTIONS.length];
}

export function readAnswers() {
  const value = readLocalJSON(ANSWERS_KEY, {});
  return value && typeof value === "object" ? value : {};
}

export function saveAnswer(dateISO, question, answer) {
  const answers = readAnswers();
  answers[dateISO] = { question, answer, answeredAt: new Date().toISOString() };
  writeLocalJSON(ANSWERS_KEY, answers);
  return answers;
}
