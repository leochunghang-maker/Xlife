import { readLocalJSON, writeLocalJSON } from "./storage";
import { todayISO } from "./dates";

export function formatSleepDuration(minutes) {
  const hours = Math.floor(Number(minutes || 0) / 60);
  const mins = Number(minutes || 0) % 60;
  return `${hours}h ${mins}m`;
}
export function currentTimeHHMM() {
  return new Date().toTimeString().slice(0, 5);
}
export function minutesBetweenTimes(start, end) {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  return endTotal >= startTotal ? endTotal - startTotal : 1440 - startTotal + endTotal;
}
export function saveSleepHistoryRecord(sleepRecord) {
  const history = readLocalJSON("dayflow_sleep_history", []);
  writeLocalJSON("dayflow_sleep_history", [sleepRecord, ...history.filter((item) => item.date !== sleepRecord.date)]);
}
// Wake prompt state for today: { date, snoozes, skipped }. "Not yet" snoozes
// for an hour, at most twice a day; "Skip today" stops it until tomorrow.
const WAKE_PROMPT_KEY = "xlife_wake_prompt_state";
export const MAX_WAKE_SNOOZES = 2;

export function readWakePromptState() {
  const state = readLocalJSON(WAKE_PROMPT_KEY, null);
  return state && state.date === todayISO ? state : { date: todayISO, snoozes: 0, skipped: false };
}

export function snoozeWakePrompt({ skip = false } = {}) {
  const state = readWakePromptState();
  writeLocalJSON(WAKE_PROMPT_KEY, { ...state, snoozes: state.snoozes + (skip ? 0 : 1), skipped: skip || state.skipped });
  localStorage.setItem("dayflow_wake_prompt_snoozed_at", new Date().toISOString());
}

export function clearWakePrompt() {
  localStorage.removeItem("dayflow_wake_prompt_snoozed_at");
  localStorage.removeItem(WAKE_PROMPT_KEY);
}

// The user's usual wake-up time from onboarding (dayflow_user_preferences).
export function preferredWakeMinutes() {
  const prefs = readLocalJSON("dayflow_user_preferences", {});
  const match = /^(\d{1,2}):(\d{2})$/.exec(prefs?.preferred_wake_time || "");
  if (!match) return 7 * 60 + 30;
  return Math.min(23, Number(match[1])) * 60 + Math.min(59, Number(match[2]));
}

export function shouldShowWakeConfirmation(sleep, now = new Date()) {
  const lastActiveAt = (localStorage.getItem("dayflow_last_active_at") || "").replace(/"/g, "");
  const snoozedAt = localStorage.getItem("dayflow_wake_prompt_snoozed_at");
  const promptState = readWakePromptState();
  const hoursSinceActive = lastActiveAt ? (now - new Date(lastActiveAt)) / 36e5 : Infinity;
  const snoozedRecently = snoozedAt && (now - new Date(snoozedAt)) / 36e5 < 1;
  // Window: from 2h before to 4h after the preferred wake-up time.
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const wake = preferredWakeMinutes();
  const morningOpen = nowMinutes >= wake - 120 && nowMinutes < wake + 240;
  const needsHealthKitConfirmation =
    sleep?.source === "apple_health" && sleep.date === todayISO && !sleep.confirmed_awake;

  if (sleep?.confirmed_awake || (sleep?.date === todayISO && sleep?.wake_time && sleep?.source === "manual")) return false;
  if (promptState.skipped || promptState.snoozes >= MAX_WAKE_SNOOZES || snoozedRecently) return false;
  return morningOpen || hoursSinceActive > 5 || needsHealthKitConfirmation;
}

// Apple HealthKit is NOT integrated yet (no native plugin / entitlement in the
// iOS project). Earlier builds returned hard-coded numbers here and labelled
// them "Apple Health", which looked like real data. Until a native plugin is
// added this reports "not connected" instead of fabricating a sleep record.
export async function syncSleepFromAppleHealth() {
  return { connected: false };
}
