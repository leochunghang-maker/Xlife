// Local (on-device) notifications via @capacitor/local-notifications.
// Everything is opt-in: nothing is scheduled until the user turns a reminder on
// and iOS grants permission. On the web build these are no-ops.
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { readLocalJSON, writeLocalJSON } from "./storage";

export const REMINDERS_KEY = "xlife_reminders";
export const NOTIFICATION_IDS = { rest: 9001, journal: 9101, periodSoon: 9201, periodLate: 9202 };

export function notificationsSupported() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications");
}

export function readReminders() {
  return {
    journal: { enabled: false, time: "21:30" },
    period: { enabled: false },
    restTimer: { enabled: false },
    ...readLocalJSON(REMINDERS_KEY, {}),
  };
}

export function saveReminders(next) {
  writeLocalJSON(REMINDERS_KEY, next);
}

export async function ensurePermission() {
  if (!notificationsSupported()) return false;
  let status = await LocalNotifications.checkPermissions();
  if (status.display === "prompt" || status.display === "prompt-with-rationale") {
    status = await LocalNotifications.requestPermissions();
  }
  return status.display === "granted";
}

async function cancel(ids) {
  if (!notificationsSupported()) return;
  await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) }).catch(() => {});
}

export async function scheduleRestDone(endAt) {
  if (!notificationsSupported() || !readReminders().restTimer.enabled) return;
  await cancel([NOTIFICATION_IDS.rest]);
  await LocalNotifications.schedule({
    notifications: [{ id: NOTIFICATION_IDS.rest, title: "Rest over", body: "Time for your next set 💪", schedule: { at: new Date(endAt), allowWhileIdle: true } }],
  }).catch(() => {});
}

export function cancelRestDone() {
  return cancel([NOTIFICATION_IDS.rest]);
}

function parseTime(value, fallback) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value || "");
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : fallback;
}

export async function applyJournalReminder({ enabled, time }) {
  await cancel([NOTIFICATION_IDS.journal]);
  if (!enabled || !notificationsSupported()) return;
  const { hour, minute } = parseTime(time, { hour: 21, minute: 30 });
  await LocalNotifications.schedule({
    notifications: [{
      id: NOTIFICATION_IDS.journal,
      title: "Xlife journal",
      body: "How was your day? Take a minute to write it down.",
      schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
    }],
  });
}

// One reminder 2 days before the estimated next period. Rescheduled whenever
// the estimate changes. The text says "estimate" on purpose.
export async function applyPeriodReminder({ enabled, nextStartISO }) {
  await cancel([NOTIFICATION_IDS.periodSoon, NOTIFICATION_IDS.periodLate]);
  if (!enabled || !notificationsSupported() || !nextStartISO) return;
  const [y, m, d] = nextStartISO.split("-").map(Number);
  const soon = new Date(y, m - 1, d - 2, 9, 0);
  const late = new Date(y, m - 1, d + 3, 9, 0);
  const notifications = [];
  if (soon > new Date()) notifications.push({ id: NOTIFICATION_IDS.periodSoon, title: "Cycle estimate", body: "Your period may start in about 2 days (estimate from your logs).", schedule: { at: soon, allowWhileIdle: true } });
  if (late > new Date()) notifications.push({ id: NOTIFICATION_IDS.periodLate, title: "Cycle check-in", body: "Your estimated period date has passed. Log it in Xlife if it started.", schedule: { at: late, allowWhileIdle: true } });
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}
