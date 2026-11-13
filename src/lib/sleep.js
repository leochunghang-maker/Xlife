import { readLocalJSON, writeLocalJSON } from "./storage";
import { todayISO } from "./dates";

export 
function formatSleepDuration(minutes) {
  const hours = Math.floor(Number(minutes || 0) / 60);
  const mins = Number(minutes || 0) % 60;
  return `${hours}h ${mins}m`;
}
export 
function currentTimeHHMM() {
  return new Date().toTimeString().slice(0, 5);
}
export 
function minutesBetweenTimes(start, end) {
  if (!start || !end) return 0;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  return endTotal >= startTotal ? endTotal - startTotal : 1440 - startTotal + endTotal;
}
export 
function saveSleepHistoryRecord(sleepRecord) {
  const history = readLocalJSON("dayflow_sleep_history", []);
  writeLocalJSON("dayflow_sleep_history", [sleepRecord, ...history.filter((item) => item.date !== sleepRecord.date)]);
}
export 
function shouldShowWakeConfirmation(sleep) {
  const now = new Date();
  const lastActiveAt = localStorage.getItem("dayflow_last_active_at");
  const snoozedAt = localStorage.getItem("dayflow_wake_prompt_snoozed_at");
  const hoursSinceActive = lastActiveAt ? (now - new Date(lastActiveAt)) / 36e5 : Infinity;
  const snoozedRecently = snoozedAt && (now - new Date(snoozedAt)) / 36e5 < 1;
  const morningOpen = now.getHours() >= 5 && now.getHours() < 12;
  const needsHealthKitConfirmation =
    sleep?.source === "apple_health" && sleep.date === todayISO && !sleep.confirmed_awake;

  if (snoozedRecently || sleep?.confirmed_awake) return false;
  return morningOpen || hoursSinceActive > 5 || needsHealthKitConfirmation;
}
export 
// Apple HealthKit is NOT integrated yet (no native plugin / entitlement in the
// iOS project). Earlier builds returned hard-coded numbers here and labelled
// them "Apple Health", which looked like real data. Until a native plugin is
// added this reports "not connected" instead of fabricating a sleep record.
async function syncSleepFromAppleHealth() {
  return { connected: false };
}
