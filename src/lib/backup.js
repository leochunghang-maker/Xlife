// Offline, versioned backup package for everything Xlife stores on this phone:
// localStorage records (dayflow_* / xlife_*) plus photos from the photo store.
//
// Restore is add-only / merge-safe: existing local data is never deleted, and a
// blank or weaker record never replaces a richer one (including today's log).
import { writeLocalJSON, writeLocalString, localDateISO } from "./storage";
import {
  isPhotoRef, isInlinePhoto, collectPhotoRefs, listPhotoRefs, hasPhoto,
  readPhotoAsDataUrl, savePhotoWithRef,
} from "./photoStore";
import { exportTextFile } from "./exportFile";

export const BACKUP_FORMAT = "xlife-backup";
export const BACKUP_VERSION = 1;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasSleepData(sleep) {
  return Boolean(sleep && (sleep.wake_time || sleep.bedtime || Number(sleep.duration_minutes || 0) > 0 || sleep.confirmed_awake));
}

function exerciseDone(item) {
  if (!item) return false;
  if (Array.isArray(item.sets) && item.sets.some((set) => set.done)) return true;
  return Boolean(item.done);
}

// How much real user content a daily log holds. Used so a blank same-day log
// cannot block restore or later overwrite a richer record.
export function logWeight(log) {
  if (!isPlainObject(log)) return 0;
  let weight = 0;
  weight += (Array.isArray(log.snaps) ? log.snaps.length : 0) * 3;
  weight += (Array.isArray(log.meals) ? log.meals.length : 0) * 2;
  if (String(log.notes || "").trim()) weight += 2;
  if (log.mood) weight += 1;
  if (log.wake_up_time) weight += 1;
  if (log.sleep_quality) weight += 1;
  if (hasSleepData(log.sleep)) weight += 2;
  if (log.cycle) weight += 1;
  const exercises = log.workout?.exercises;
  if (exercises && typeof exercises === "object") {
    weight += Object.values(exercises).filter(exerciseDone).length;
  }
  return weight;
}

export function isSparseLog(log) {
  return logWeight(log) === 0;
}

function unionBy(local = [], incoming = [], keyFn) {
  const list = Array.isArray(local) ? [...local] : [];
  const seen = new Set(list.map((item) => keyFn(item)).filter(Boolean));
  for (const item of (Array.isArray(incoming) ? incoming : [])) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    list.push(item);
  }
  return list;
}

function mealKey(meal) {
  return meal?.id || (meal ? `${meal.date || ""}:${meal.name || ""}:${meal.time || ""}:${meal.createdAt || ""}` : "");
}

function snapKey(snap) {
  return snap?.id || snap?.url || "";
}

function spendingKey(item) {
  return item?.id || (item ? `${item.date || ""}:${item.item_name || ""}:${item.amount || ""}:${item.createdAt || ""}` : "");
}

function workoutKey(item) {
  if (!item) return "";
  return item.session_id ? `${item.date}:${item.type}:${item.session_id}` : `${item.date}:${item.type}`;
}

function planKey(item) {
  return item?.id || `${item?.date || ""}:${item?.title || ""}:${item?.createdAt || ""}`;
}

function restaurantKey(item) {
  return item?.id || `${item?.name || ""}:${item?.location || ""}`;
}

function intimacyKey(item) {
  return item?.id || item?.date || "";
}

function sleepKey(item) {
  return item?.date || "";
}

function foodKey(item) {
  return item?.id || `${item?.name || ""}:${item?.createdAt || ""}`;
}

function countdownKey(item) {
  return item?.id || `${item?.title || ""}:${item?.date || ""}`;
}

function mergeWorkout(local, incoming) {
  if (!incoming) return local;
  if (!local) return incoming;
  const exercises = { ...(incoming.exercises || {}), ...(local.exercises || {}) };
  return {
    ...incoming,
    ...local,
    type: local.type || incoming.type,
    exercises,
    completed_at: local.completed_at || incoming.completed_at,
    summary: local.summary || incoming.summary,
    session_id: local.session_id || incoming.session_id,
  };
}

export function mergeLogs(local, incoming) {
  if (!incoming) return local;
  if (!local) return incoming;
  return {
    ...incoming,
    ...local,
    date: local.date || incoming.date,
    notes: String(local.notes || "").trim() ? local.notes : incoming.notes,
    mood: local.mood || incoming.mood,
    wake_up_time: local.wake_up_time || incoming.wake_up_time,
    sleep_quality: local.sleep_quality || incoming.sleep_quality,
    sleep: hasSleepData(local.sleep) ? local.sleep : (incoming.sleep || local.sleep),
    calorie_goal: local.calorie_goal || incoming.calorie_goal,
    meals: unionBy(local.meals, incoming.meals, mealKey),
    snaps: unionBy(local.snaps, incoming.snaps, snapKey),
    workout: mergeWorkout(
      local.workout,
      incoming.workout && logWeight({ workout: incoming.workout }) ? incoming.workout : null,
    ),
    cycle: local.cycle || incoming.cycle,
  };
}

export function mergeDateMap(local, incoming, valueMerger) {
  const out = isPlainObject(local) ? { ...local } : {};
  if (!isPlainObject(incoming)) return out;
  for (const [date, value] of Object.entries(incoming)) {
    if (out[date] == null) out[date] = value;
    else if (valueMerger) out[date] = valueMerger(out[date], value);
  }
  return out;
}

export function mergeArray(local, incoming, keyFn) {
  return unionBy(Array.isArray(local) ? local : [], Array.isArray(incoming) ? incoming : [], keyFn);
}

function mergeCouple(local, incoming) {
  if (!incoming) return local;
  if (!local) return incoming;
  return {
    ...incoming,
    ...local,
    anniversary: local.anniversary || incoming.anniversary,
    countdowns: unionBy(local.countdowns, incoming.countdowns, countdownKey),
  };
}

function mergePartnerConnection(local, incoming) {
  if (!incoming) return local;
  if (!local || local.status === "none") return incoming;
  return local;
}

function mergeProfile(local, incoming) {
  if (!incoming) return local;
  if (!local) return incoming;
  const localEmail = String(local.email || "").toLowerCase();
  const incomingEmail = String(incoming.email || "").toLowerCase();
  if (localEmail && incomingEmail && localEmail !== incomingEmail) return local;
  if (local.id && incoming.id && local.id !== incoming.id && localEmail && localEmail === incomingEmail) {
    return { ...incoming, ...local };
  }
  return { ...incoming, ...local };
}

function mergePreferences(local, incoming) {
  if (!incoming) return local;
  if (!local) return incoming;
  const cuisines = [...new Set([...(incoming.favorite_cuisines || []), ...(local.favorite_cuisines || [])])];
  return { ...incoming, ...local, favorite_cuisines: cuisines.length ? cuisines : local.favorite_cuisines };
}

function mergeWorkoutTemplate(local, incoming) {
  if (!incoming) return local;
  if (!local) return incoming;
  const names = new Set([...Object.keys(incoming), ...Object.keys(local)]);
  const out = {};
  names.forEach((name) => {
    out[name] = local[name] ? { ...incoming[name], ...local[name] } : incoming[name];
  });
  return out;
}

const ARRAY_KEYS = {
  dayflow_meal_history: mealKey,
  dayflow_spending: spendingKey,
  dayflow_workout_history: workoutKey,
  dayflow_sleep_history: sleepKey,
  dayflow_intimacy_logs: intimacyKey,
  dayflow_restaurants: restaurantKey,
  dayflow_fun_plans: planKey,
  dayflow_rejected_food_suggestions: (item) => (typeof item === "string" ? item : JSON.stringify(item)),
  dayflow_saved_food_suggestions: (item) => (typeof item === "string" ? item : JSON.stringify(item)),
  dayflow_snaps: snapKey,
  dayflow_memories: snapKey,
  xlife_my_foods: foodKey,
  xlife_cloud_uploaded_photos: (item) => String(item || ""),
};

function parseStored(raw) {
  if (raw === null || raw === undefined) return { encoding: "missing", value: null };
  try {
    return { encoding: "json", value: JSON.parse(raw) };
  } catch {
    return { encoding: "text", value: raw };
  }
}

export function listAppKeys(storage = (typeof localStorage === "undefined" ? null : localStorage)) {
  if (!storage) return [];
  const keys = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && (key.startsWith("dayflow_") || key.startsWith("xlife_"))) keys.push(key);
  }
  return keys.sort();
}

function readAllKeys(storage) {
  const keys = {};
  listAppKeys(storage).forEach((key) => {
    keys[key] = parseStored(storage.getItem(key));
  });
  return keys;
}

function writeParsed(key, encoding, value) {
  if (encoding === "text") return writeLocalString(key, value);
  return writeLocalJSON(key, value);
}

export function mergeStoredValue(key, localEntry, incomingEntry) {
  if (!incomingEntry || incomingEntry.encoding === "missing") return { entry: localEntry, changed: false };
  if (!localEntry || localEntry.encoding === "missing") return { entry: incomingEntry, changed: true };

  if (key === "dayflow_log" && incomingEntry.encoding === "json") {
    const merged = mergeLogs(localEntry.value, incomingEntry.value);
    return { entry: { encoding: "json", value: merged }, changed: JSON.stringify(merged) !== JSON.stringify(localEntry.value) };
  }
  if (key === "dayflow_daily_logs" && incomingEntry.encoding === "json") {
    const merged = mergeDateMap(localEntry.value, incomingEntry.value, mergeLogs);
    return { entry: { encoding: "json", value: merged }, changed: JSON.stringify(merged) !== JSON.stringify(localEntry.value) };
  }
  if (key === "dayflow_period_logs" && incomingEntry.encoding === "json") {
    const merged = mergeDateMap(localEntry.value, incomingEntry.value, (local, incoming) => ({ ...incoming, ...local }));
    return { entry: { encoding: "json", value: merged }, changed: JSON.stringify(merged) !== JSON.stringify(localEntry.value) };
  }
  if (key === "xlife_daily_answers" && incomingEntry.encoding === "json") {
    const merged = mergeDateMap(localEntry.value, incomingEntry.value, (local, incoming) => ({ ...incoming, ...local }));
    return { entry: { encoding: "json", value: merged }, changed: JSON.stringify(merged) !== JSON.stringify(localEntry.value) };
  }
  if (key === "dayflow_user" && incomingEntry.encoding === "json") {
    const merged = mergeProfile(localEntry.value, incomingEntry.value);
    return { entry: { encoding: "json", value: merged }, changed: JSON.stringify(merged) !== JSON.stringify(localEntry.value) };
  }
  if (key === "dayflow_user_preferences" && incomingEntry.encoding === "json") {
    const merged = mergePreferences(localEntry.value, incomingEntry.value);
    return { entry: { encoding: "json", value: merged }, changed: JSON.stringify(merged) !== JSON.stringify(localEntry.value) };
  }
  if (key === "xlife_couple" && incomingEntry.encoding === "json") {
    const merged = mergeCouple(localEntry.value, incomingEntry.value);
    return { entry: { encoding: "json", value: merged }, changed: JSON.stringify(merged) !== JSON.stringify(localEntry.value) };
  }
  if ((key === "xlife_partner_connection" || key === "dayflow_partner_connection") && incomingEntry.encoding === "json") {
    const merged = mergePartnerConnection(localEntry.value, incomingEntry.value);
    return { entry: { encoding: "json", value: merged }, changed: JSON.stringify(merged) !== JSON.stringify(localEntry.value) };
  }
  if (key.startsWith("dayflow_workout_") && key !== "dayflow_workout_history" && incomingEntry.encoding === "json") {
    const merged = mergeWorkoutTemplate(localEntry.value || {}, incomingEntry.value || {});
    return { entry: { encoding: "json", value: merged }, changed: JSON.stringify(merged) !== JSON.stringify(localEntry.value) };
  }
  if (ARRAY_KEYS[key] && incomingEntry.encoding === "json") {
    const merged = mergeArray(localEntry.value, incomingEntry.value, ARRAY_KEYS[key]);
    return { entry: { encoding: "json", value: merged }, changed: JSON.stringify(merged) !== JSON.stringify(localEntry.value) };
  }
  if (key === "xlife_partner_privacy" || key === "xlife_reminders" || key === "xlife_app_lock") {
    if (incomingEntry.encoding !== "json") return { entry: localEntry, changed: false };
    const merged = { ...incomingEntry.value, ...localEntry.value };
    return { entry: { encoding: "json", value: merged }, changed: JSON.stringify(merged) !== JSON.stringify(localEntry.value) };
  }
  // Any other key that already exists locally is left untouched.
  return { entry: localEntry, changed: false };
}

async function collectExportPhotos(keys) {
  const refs = new Set();
  Object.values(keys).forEach((entry) => collectPhotoRefs(entry.value, refs));
  for (const ref of await listPhotoRefs()) refs.add(ref);
  const photos = {};
  const missing = [];
  for (const ref of refs) {
    if (!isPhotoRef(ref)) continue;
    if (!(await hasPhoto(ref))) {
      missing.push(ref);
      continue;
    }
    const dataUrl = await readPhotoAsDataUrl(ref).catch(() => "");
    if (!isInlinePhoto(dataUrl)) {
      missing.push(ref);
      continue;
    }
    photos[ref] = dataUrl;
  }
  return { photos, missing };
}

export async function buildBackupPackage({ storage = localStorage } = {}) {
  const keys = readAllKeys(storage);
  const { photos, missing } = await collectExportPhotos(keys);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: "Xlife",
    exportedAt: new Date().toISOString(),
    keys,
    photos,
    missingPhotos: missing,
  };
}

export function backupFilename(date = localDateISO()) {
  return `xlife-backup-${date}.json`;
}

export async function exportBackupPackage() {
  const pkg = await buildBackupPackage();
  await exportTextFile(backupFilename(), JSON.stringify(pkg), "application/json");
  return pkg;
}

export function parseBackupPackage(input) {
  const pkg = typeof input === "string" ? JSON.parse(input) : input;
  if (!pkg || pkg.format !== BACKUP_FORMAT) {
    throw new Error("This file isn't an Xlife backup.");
  }
  if (Number(pkg.version) > BACKUP_VERSION) {
    throw new Error("This backup was made with a newer Xlife. Update the app and try again.");
  }
  if (!isPlainObject(pkg.keys)) throw new Error("This backup is missing its records.");
  return pkg;
}

export async function applyBackupPackage(pkg, { storage = localStorage, reload = false } = {}) {
  const parsed = parseBackupPackage(pkg);
  const report = { addedKeys: 0, updatedKeys: 0, addedPhotos: 0, skippedPhotos: 0, failedPhotos: [], warnings: [] };

  for (const [ref, dataUrl] of Object.entries(parsed.photos || {})) {
    if (!isPhotoRef(ref) || !isInlinePhoto(dataUrl)) {
      report.failedPhotos.push(ref);
      continue;
    }
    if (await hasPhoto(ref)) {
      report.skippedPhotos += 1;
      continue;
    }
    try {
      await savePhotoWithRef(ref, dataUrl);
      if (!(await hasPhoto(ref))) throw new Error("not readable after restore");
      report.addedPhotos += 1;
    } catch {
      report.failedPhotos.push(ref);
    }
  }

  for (const [key, incoming] of Object.entries(parsed.keys || {})) {
    if (!key || !(key.startsWith("dayflow_") || key.startsWith("xlife_"))) continue;
    const local = parseStored(storage.getItem(key));
    const { entry, changed } = mergeStoredValue(key, local, incoming);
    if (!changed) continue;
    const ok = writeParsed(key, entry.encoding, entry.value);
    if (!ok) {
      report.warnings.push(`Couldn't write ${key} (storage may be full).`);
      continue;
    }
    if (local.encoding === "missing") report.addedKeys += 1;
    else report.updatedKeys += 1;
  }

  if (reload && typeof window !== "undefined") window.location.reload();
  return report;
}

// Used by cloud restore: merge a cloud daily log into local today/archive
// without letting a blank side win.
export function mergeIncomingDay(local, incoming) {
  if (!incoming) return { value: local, changed: false };
  if (!local) return { value: incoming, changed: true };
  const merged = mergeLogs(local, incoming);
  return { value: merged, changed: JSON.stringify(merged) !== JSON.stringify(local) };
}

export function shouldSkipCloudDailyUpsert(localLog, existingCloudLog) {
  return isSparseLog(localLog) && logWeight(existingCloudLog) > 0;
}
