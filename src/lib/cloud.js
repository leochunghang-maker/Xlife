// Xlife Cloud (Supabase): email auth, safe localStorage -> cloud backup,
// non-destructive restore, photo upload to Storage and partner pairing.
// Local-only UI does not call these operations. Cloud data access requires an
// explicitly associated dataset owner; denied operations fail closed.
//
// Safety rules:
//  - Local data is never deleted or overwritten by cloud operations.
//  - Backup is idempotent upserts keyed by "<user_id>:<local id>".
//  - Restore only ADDS records/dates that don't exist locally yet.
import { supabase, isSupabaseConfigured } from "./supabase";
import { readLocalJSON, writeLocalJSON } from "./storage";
import { getAllMemorySnaps } from "./dailyLog";
import { readPrivacy, PRIVACY_CATEGORIES } from "./privacy";
import { isPhotoRef, photoRefId, readPhotoAsDataUrl, savePhotoWithRef, hasPhoto, collectPhotoRefs } from "./photoStore";
import { mergeIncomingDay, shouldSkipCloudDailyUpsert, isSparseLog } from "./backup";

import { assertIdentity, assertDataOwner, associateDataOwner, invalidateCloudOperations, accountEpoch, assertAccountEpoch, readDataOwner, ownerEmail } from "./accountOwner";
export { readDataOwner };
export const CLOUD_STATUS_KEY = "xlife_cloud_status";
const UPLOADED_PHOTOS_KEY = "xlife_cloud_uploaded_photos";

export { isSupabaseConfigured };

// ------------------------------------------------------------------ auth
export async function getCloudSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const session = data.session || null;
  if (session) {
    try { assertIdentity(session.user); } catch {
      invalidateCloudOperations();
      await supabase.auth.signOut({ scope: 'local' });
      return null;
    }
  }
  return session;
}

export function onCloudAuthChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    try { if (session) assertIdentity(session.user); callback(session); }
    catch { invalidateCloudOperations(); callback(null); queueMicrotask(() => { supabase.auth.signOut({ scope: 'local' }).catch(() => {}); }); }
  });
  return () => data.subscription.unsubscribe();
}

export async function cloudSignUp({ email, password, name }) {
  if (!supabase) return { skipped: true };
  try { preflightAccountEmail(email); } catch (error) { return { error }; }
  invalidateCloudOperations();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  if (data?.session) {
    try { assertIdentity(data.session.user); } catch (mismatch) {
      invalidateCloudOperations();
      await supabase.auth.signOut({ scope: 'local' });
      return { data: null, error: mismatch };
    }
  }
  return { data, error };
}

export async function cloudSignIn({ email, password }) {
  if (!supabase) return { skipped: true };
  try { preflightAccountEmail(email); } catch (error) { return { error }; }
  invalidateCloudOperations();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (data?.session) {
    try { assertIdentity(data.session.user); } catch (mismatch) {
      invalidateCloudOperations();
      await supabase.auth.signOut({ scope: 'local' });
      return { data: null, error: mismatch };
    }
  }
  return { data, error };
}

export async function cloudSignOut() {
  if (!supabase) return { skipped: true };
  invalidateCloudOperations();
  return supabase.auth.signOut({ scope: "local" });
}

function preflightAccountEmail(email) {
  const owner = readDataOwner();
  const profile = readLocalJSON('dayflow_user', null);
  const expected = owner?.email || profile?.email;
  if (expected && ownerEmail(expected) !== ownerEmail(email)) throw new Error('Account mismatch: sign in with this phone’s existing profile. Local data was not changed.');
}
async function ownedSession() {
  const session = await getCloudSession();
  if (!session) throw new Error('Sign in with this phone’s account first.');
  assertDataOwner(session.user);
  return session;
}
function sessionGuard(session) {
  const expected = accountEpoch();
  return () => { assertAccountEpoch(expected); assertDataOwner(session.user); };
}
export async function associateCurrentCloudOwner() {
  const session = await getCloudSession();
  if (!session) throw new Error('Sign in first.');
  return associateDataOwner(session.user);
}
export function uploadedPhotosKey(uid) { return `${UPLOADED_PHOTOS_KEY}:${uid}`; }
function cloudPhotoId(ref) {
  if (!/^xlife-photo:[A-Za-z0-9-]+$/.test(ref)) throw new Error('Invalid photo reference; upload blocked.');
  return ref.slice('xlife-photo:'.length);
}

// ------------------------------------------------------------------ helpers
function rowId(userId, localId) {
  return `${userId}:${localId}`;
}

// A second session of the same split on one day carries a session_id.
function workoutKey(w) {
  return w.session_id ? `${w.date}:${w.type}:${w.session_id}` : `${w.date}:${w.type}`;
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(meta)?.[1] || "image/jpeg";
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: mime });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function upsertRows(table, rows, check) {
  for (let i = 0; i < rows.length; i += 200) {
    check();
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 200), { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  return rows.length;
}

// Never upsert a blank / empty daily log over a richer cloud row (a same-day
// empty working log used to wipe a restored diary on the next backup).
async function upsertDailyLogs(rows, check) {
  let written = 0;
  for (const row of rows) {
    check();
    if (isSparseLog(row.data)) {
      const { data: existing, error } = await supabase.from("daily_logs").select("data").eq("id", row.id).maybeSingle();
      if (error) throw new Error(`daily_logs: ${error.message}`);
      if (shouldSkipCloudDailyUpsert(row.data, existing?.data)) continue;
    }
    check();
    const { error } = await supabase.from("daily_logs").upsert(row, { onConflict: "id" });
    if (error) throw new Error(`daily_logs: ${error.message}`);
    written += 1;
  }
  return written;
}

// Builds cloud rows from every local store. Pure (reads localStorage only).
export function buildCloudRows(userId) {
  assertDataOwner({ id: userId, email: readDataOwner()?.email });
  const today = readLocalJSON("dayflow_log", null);
  const archive = readLocalJSON("dayflow_daily_logs", {});
  const days = { ...(archive && typeof archive === "object" ? archive : {}), ...(today?.date ? { [today.date]: today } : {}) };
  const list = (key) => {
    const value = readLocalJSON(key, []);
    return Array.isArray(value) ? value : [];
  };
  const periodLogs = readLocalJSON("dayflow_period_logs", {});
  const rows = {
    daily_logs: Object.entries(days).filter(([date]) => validDate(date)).map(([date, log]) => ({ id: rowId(userId, date), user_id: userId, date, data: log })),
    journal_entries: Object.entries(days).filter(([date, log]) => validDate(date) && log?.notes).map(([date, log]) => ({ id: rowId(userId, `journal:${date}`), user_id: userId, date, data: { notes: log.notes } })),
    meals: list("dayflow_meal_history").map((meal, index) => ({ id: rowId(userId, meal.id || `meal:${meal.date || ""}:${index}`), user_id: userId, date: validDate(meal.date), data: meal })),
    workouts: list("dayflow_workout_history").map((w) => ({ id: rowId(userId, workoutKey(w)), user_id: userId, date: validDate(w.date), data: w })),
    spending: list("dayflow_spending").map((s, index) => ({ id: rowId(userId, s.id || `spend:${index}`), user_id: userId, date: validDate(s.date), data: s })),
    sleep_logs: list("dayflow_sleep_history").map((s) => ({ id: rowId(userId, `sleep:${s.date}`), user_id: userId, date: validDate(s.date), data: s })),
    period_logs: Object.entries(periodLogs && typeof periodLogs === "object" ? periodLogs : {}).filter(([date]) => validDate(date)).map(([date, entry]) => ({ id: rowId(userId, `period:${date}`), user_id: userId, date, data: entry })),
    intimacy_logs: list("dayflow_intimacy_logs").map((entry, index) => ({ id: rowId(userId, entry.id || `intimacy:${entry.date}:${index}`), user_id: userId, date: validDate(entry.date), data: entry })),
    restaurants: list("dayflow_restaurants").filter((r) => !r.is_sample).map((r) => ({ id: rowId(userId, r.id), user_id: userId, date: null, data: r })),
    plans: list("dayflow_fun_plans").map((p) => ({ id: rowId(userId, p.id), user_id: userId, date: validDate(p.date), data: p })),
    memories: getAllMemorySnaps(today || {}).map((snap, index) => ({ id: rowId(userId, snap.id || photoRefId(snap.url) || `memory:${snap.date}:${index}`), user_id: userId, date: validDate(snap.date), data: snap })),
  };
  return rows;
}

// Uploads photos referenced by the rows (once each) to Storage photos/<uid>/<id>.jpg.
async function uploadPhotos(userId, rows, onProgress, check) {
  const uploaded = new Set(readLocalJSON(uploadedPhotosKey(userId), []));
  const refs = [...collectPhotoRefs(rows)].filter((ref) => !uploaded.has(ref));
  let done = 0;
  for (const ref of refs) {
    const dataUrl = await readPhotoAsDataUrl(ref).catch(() => "");
    check();
    if (dataUrl) {
      const { error } = await supabase.storage.from("photos").upload(`${userId}/${cloudPhotoId(ref)}.jpg`, dataUrlToBlob(dataUrl), { contentType: "image/jpeg", upsert: true });
      if (error) throw new Error(`photo upload: ${error.message}`);
      check();
      uploaded.add(ref);
      writeLocalJSON(uploadedPhotosKey(userId), [...uploaded]);
    }
    done += 1;
    onProgress?.(`Uploading photos ${done}/${refs.length}`);
  }
  return refs.length;
}

export async function backupLocalToCloud({ onProgress } = {}) {
  const session = await ownedSession();
  if (!session) return { skipped: true };
  const userId = session.user.id;
  const check = sessionGuard(session);
  const rows = buildCloudRows(userId);
  const counts = {};
  onProgress?.("Saving profile…");
  const user = readLocalJSON("dayflow_user", {});
  const preferences = readLocalJSON("dayflow_user_preferences", {});
  const { error: profileError } = await supabase.from("profiles").upsert({ id: userId, name: user?.name || "", preferences, updated_at: new Date().toISOString() });
  if (profileError) throw profileError;
  check();
  const { error: sharingError } = await pushSharingPreferences();
  if (sharingError) throw sharingError;
  check();
  for (const [table, tableRows] of Object.entries(rows)) {
    onProgress?.(`Backing up ${table.replace("_", " ")}…`);
    const stamped = tableRows.map((row) => ({ ...row, updated_at: new Date().toISOString() }));
    counts[table] = table === "daily_logs"
      ? await upsertDailyLogs(stamped, check)
      : await upsertRows(table, stamped, check);
  }
  counts.photos = await uploadPhotos(userId, rows, onProgress, check);
  check();
  const status = { userId, lastBackupAt: new Date().toISOString(), counts };
  writeLocalJSON(CLOUD_STATUS_KEY, status);
  return status;
}

// ------------------------------------------------------------------ restore (additive)
async function fetchAll(table, userId, check) {
  check();
  const { data, error } = await supabase.from(table).select("id,user_id,date,data").eq("user_id", userId).limit(10000);
  if (error) throw new Error(`${table}: ${error.message}`);
  check();
  if ((data || []).some(row => row.user_id !== userId)) throw new Error("Cloud restore returned a different account’s records. Restore blocked.");
  return data || [];
}

function mergeList(key, cloudItems, identity) {
  const local = readLocalJSON(key, []);
  const list = Array.isArray(local) ? local : [];
  const seen = new Set(list.map(identity));
  const additions = cloudItems.filter((item) => !seen.has(identity(item)));
  if (additions.length) writeLocalJSON(key, [...list, ...additions]);
  return additions.length;
}

export async function restoreFromCloud({ onProgress } = {}) {
  const session = await ownedSession();
  if (!session) return { skipped: true };
  const userId = session.user.id;
  const check = sessionGuard(session);
  const added = {};
  onProgress?.("Downloading days…");
  const archive = readLocalJSON("dayflow_daily_logs", {}) || {};
  const today = readLocalJSON("dayflow_log", null);
  let newDays = 0;
  const allRows = [];
  let todayChanged = false;
  let todayMerged = today;
  for (const row of await fetchAll("daily_logs", userId, check)) {
    allRows.push(row);
    if (!row.date || !row.data) continue;
    if (row.date === today?.date) {
      const result = mergeIncomingDay(todayMerged, row.data);
      if (result.changed) {
        todayMerged = result.value;
        todayChanged = true;
        newDays += 1;
      }
      continue;
    }
    const result = mergeIncomingDay(archive[row.date], row.data);
    if (result.changed) {
      archive[row.date] = result.value;
      newDays += 1;
    }
  }
  check();
  if (newDays) writeLocalJSON("dayflow_daily_logs", archive);
  if (todayChanged) writeLocalJSON("dayflow_log", todayMerged);
  added.days = newDays;

  const simple = [
    ["meals", "dayflow_meal_history", (m) => m.id || `${m.date}:${m.name}`],
    ["workouts", "dayflow_workout_history", workoutKey],
    ["spending", "dayflow_spending", (s) => s.id || `${s.date}:${s.item_name}:${s.amount}`],
    ["sleep_logs", "dayflow_sleep_history", (s) => s.date],
    ["intimacy_logs", "dayflow_intimacy_logs", (e) => e.id || e.date],
    ["restaurants", "dayflow_restaurants", (r) => r.id],
    ["plans", "dayflow_fun_plans", (p) => p.id],
  ];
  for (const [table, key, identity] of simple) {
    onProgress?.(`Downloading ${table.replace("_", " ")}…`);
    const rows = await fetchAll(table, userId, check);
    check();
    allRows.push(...rows);
    added[table] = mergeList(key, rows.map((row) => row.data), identity);
  }

  const periodLogs = readLocalJSON("dayflow_period_logs", {}) || {};
  let newPeriod = 0;
  for (const row of await fetchAll("period_logs", userId, check)) {
    if (row.date && !periodLogs[row.date]) {
      periodLogs[row.date] = row.data;
      newPeriod += 1;
    }
  }
  check();
  if (newPeriod) writeLocalJSON("dayflow_period_logs", periodLogs);
  added.period_logs = newPeriod;

  // Download any referenced photos that aren't on this device yet.
  const refs = [...collectPhotoRefs(allRows.map((row) => row.data))];
  let photos = 0;
  for (const ref of refs) {
    const exists = await hasPhoto(ref);
    check();
    if (exists) continue;
    const { data } = await supabase.storage.from("photos").download(`${userId}/${cloudPhotoId(ref)}.jpg`);
    if (data) {
      const dataUrl = await blobToDataUrl(data);
      check();
      await savePhotoWithRef(ref, dataUrl);
      check();
      photos += 1;
      onProgress?.(`Downloading photos ${photos}`);
    }
  }
  added.photos = photos;
  return { added };
}

// ------------------------------------------------------------------ couples
export async function createCoupleInvite() {
  if (!supabase) return { skipped: true };
  const check = sessionGuard(await ownedSession());
  const { data, error } = await supabase.rpc("create_couple_invite");
  check();
  return { code: data, error };
}

export async function acceptCoupleInvite(code) {
  if (!supabase) return { skipped: true };
  const check = sessionGuard(await ownedSession());
  const { data, error } = await supabase.rpc("accept_couple_invite", { invite_code: code });
  check();
  return { coupleId: data, error };
}

export async function leaveCouple() {
  if (!supabase) return { skipped: true };
  const check = sessionGuard(await ownedSession());
  const result = await supabase.rpc("leave_couple");
  check();
  return result;
}

export async function getCouple() {
  const session = await ownedSession();
  if (!session) return null;
  const check = sessionGuard(session);
  const { data: couple, error: coupleError } = await supabase.from("couples").select("*").maybeSingle();
  check();
  if (coupleError) throw coupleError;
  if (!couple) return null;
  const partnerId = couple.user_a === session.user.id ? couple.user_b : couple.user_a;
  const { data: profile } = await supabase.from("profiles").select("id,name").eq("id", partnerId).maybeSingle();
  check();
  return { ...couple, partnerId, partnerName: profile?.name || "Partner" };
}

// The partner's shared items (RLS returns only categories they share).
export async function getPartnerFeed(partnerId) {
  if (!supabase || !partnerId) return [];
  const check = sessionGuard(await ownedSession());
  const tables = [["memories", "memory"], ["plans", "plan"], ["meals", "meal"], ["workouts", "workout"]];
  const results = [];
  for (const [table, type] of tables) {
    check();
    const { data } = await supabase.from(table).select("id,date,data,updated_at").eq("user_id", partnerId).order("updated_at", { ascending: false }).limit(10);
    (data || []).forEach((row) => results.push({ type, ...row }));
  }
  check();
  return results.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 20);
}

export async function partnerPhotoUrl(partnerId, ref) {
  if (!supabase || !isPhotoRef(ref)) return "";
  const check = sessionGuard(await ownedSession());
  // Authenticated download evaluates RLS on each fetch; do not mint a
  // long-lived bearer URL that remains usable after unpair/unshare.
  const { data, error } = await supabase.storage.from("photos").download(`${partnerId}/${cloudPhotoId(ref)}.jpg`);
  if (error || !data) return "";
  const dataUrl = await blobToDataUrl(data);
  check();
  return dataUrl;
}

export async function pushSharingPreferences() {
  const session = await ownedSession();
  if (!session) return { skipped: true };
  const check = sessionGuard(session);
  const privacy = readPrivacy();
  const result = await supabase.from("couple_shares").upsert(
    PRIVACY_CATEGORIES.map((c) => ({ user_id: session.user.id, category: c.id, shared: Boolean(privacy[c.id]), updated_at: new Date().toISOString() })),
    { onConflict: "user_id,category" },
  );
  check();
  return result;
}

// ------------------------------------------------------------------ daily question
export async function saveDailyAnswerToCloud(date, question, answer) {
  const session = await ownedSession();
  if (!session) return { skipped: true };
  const check = sessionGuard(session);
  const result = await supabase.from("couple_answers").upsert(
    { id: rowId(session.user.id, `answer:${date}`), user_id: session.user.id, date, question, answer, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  check();
  return result;
}

// Returns the partner's answer for `date`, or null (RLS hides it until you answer).
export async function getPartnerAnswer(partnerId, date) {
  if (!supabase || !partnerId) return null;
  const check = sessionGuard(await ownedSession());
  const { data } = await supabase.from("couple_answers").select("answer,question").eq("user_id", partnerId).eq("date", date).maybeSingle();
  check();
  return data || null;
}
