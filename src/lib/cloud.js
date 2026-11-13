// Xlife Cloud (Supabase): email auth, safe localStorage -> cloud backup,
// non-destructive restore, photo upload to Storage and partner pairing.
// Every function is a no-op / returns { skipped: true } in local-only builds.
//
// Safety rules:
//  - Local data is never deleted or overwritten by cloud operations.
//  - Backup is idempotent upserts keyed by "<user_id>:<local id>".
//  - Restore only ADDS records/dates that don't exist locally yet.
import { supabase, isSupabaseConfigured } from "./supabase";
import { readLocalJSON, writeLocalJSON } from "./storage";
import { getAllMemorySnaps } from "./dailyLog";
import { readPrivacy, PRIVACY_CATEGORIES } from "./privacy";
import { isPhotoRef, photoRefId, readPhotoAsDataUrl, savePhotoWithRef, hasPhoto } from "./photoStore";

export const CLOUD_STATUS_KEY = "xlife_cloud_status";
const UPLOADED_PHOTOS_KEY = "xlife_cloud_uploaded_photos";

export { isSupabaseConfigured };

// ------------------------------------------------------------------ auth
export async function getCloudSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export function onCloudAuthChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function cloudSignUp({ email, password, name }) {
  if (!supabase) return { skipped: true };
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  return { data, error };
}

export async function cloudSignIn({ email, password }) {
  if (!supabase) return { skipped: true };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function cloudSignOut() {
  if (!supabase) return { skipped: true };
  return supabase.auth.signOut();
}

// ------------------------------------------------------------------ helpers
function rowId(userId, localId) {
  return `${userId}:${localId}`;
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function collectPhotoRefs(value, out = new Set()) {
  if (isPhotoRef(value)) out.add(value);
  else if (Array.isArray(value)) value.forEach((item) => collectPhotoRefs(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectPhotoRefs(item, out));
  return out;
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

async function upsertRows(table, rows) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + 200), { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  return rows.length;
}

// Builds cloud rows from every local store. Pure (reads localStorage only).
export function buildCloudRows(userId) {
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
    workouts: list("dayflow_workout_history").map((w) => ({ id: rowId(userId, `${w.date}:${w.type}`), user_id: userId, date: validDate(w.date), data: w })),
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
async function uploadPhotos(userId, rows, onProgress) {
  const uploaded = new Set(readLocalJSON(UPLOADED_PHOTOS_KEY, []));
  const refs = [...collectPhotoRefs(rows)].filter((ref) => !uploaded.has(ref));
  let done = 0;
  for (const ref of refs) {
    const dataUrl = await readPhotoAsDataUrl(ref).catch(() => "");
    if (dataUrl) {
      const { error } = await supabase.storage.from("photos").upload(`${userId}/${photoRefId(ref)}.jpg`, dataUrlToBlob(dataUrl), { contentType: "image/jpeg", upsert: true });
      if (error) throw new Error(`photo upload: ${error.message}`);
      uploaded.add(ref);
      writeLocalJSON(UPLOADED_PHOTOS_KEY, [...uploaded]);
    }
    done += 1;
    onProgress?.(`Uploading photos ${done}/${refs.length}`);
  }
  return refs.length;
}

export async function backupLocalToCloud({ onProgress } = {}) {
  const session = await getCloudSession();
  if (!session) return { skipped: true };
  const userId = session.user.id;
  const rows = buildCloudRows(userId);
  const counts = {};
  onProgress?.("Saving profile…");
  const user = readLocalJSON("dayflow_user", {});
  const preferences = readLocalJSON("dayflow_user_preferences", {});
  await supabase.from("profiles").upsert({ id: userId, name: user?.name || "", preferences, updated_at: new Date().toISOString() });
  await pushSharingPreferences();
  for (const [table, tableRows] of Object.entries(rows)) {
    onProgress?.(`Backing up ${table.replace("_", " ")}…`);
    counts[table] = await upsertRows(table, tableRows.map((row) => ({ ...row, updated_at: new Date().toISOString() })));
  }
  counts.photos = await uploadPhotos(userId, rows, onProgress);
  const status = { userId, lastBackupAt: new Date().toISOString(), counts };
  writeLocalJSON(CLOUD_STATUS_KEY, status);
  return status;
}

// ------------------------------------------------------------------ restore (additive)
async function fetchAll(table, userId) {
  const { data, error } = await supabase.from(table).select("id,date,data").eq("user_id", userId).limit(10000);
  if (error) throw new Error(`${table}: ${error.message}`);
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
  const session = await getCloudSession();
  if (!session) return { skipped: true };
  const userId = session.user.id;
  const added = {};
  onProgress?.("Downloading days…");
  const archive = readLocalJSON("dayflow_daily_logs", {}) || {};
  const today = readLocalJSON("dayflow_log", null);
  let newDays = 0;
  const allRows = [];
  for (const row of await fetchAll("daily_logs", userId)) {
    allRows.push(row);
    if (row.date && !archive[row.date] && row.date !== today?.date) {
      archive[row.date] = row.data;
      newDays += 1;
    }
  }
  if (newDays) writeLocalJSON("dayflow_daily_logs", archive);
  added.days = newDays;

  const simple = [
    ["meals", "dayflow_meal_history", (m) => m.id || `${m.date}:${m.name}`],
    ["workouts", "dayflow_workout_history", (w) => `${w.date}:${w.type}`],
    ["spending", "dayflow_spending", (s) => s.id || `${s.date}:${s.item_name}:${s.amount}`],
    ["sleep_logs", "dayflow_sleep_history", (s) => s.date],
    ["intimacy_logs", "dayflow_intimacy_logs", (e) => e.id || e.date],
    ["restaurants", "dayflow_restaurants", (r) => r.id],
    ["plans", "dayflow_fun_plans", (p) => p.id],
  ];
  for (const [table, key, identity] of simple) {
    onProgress?.(`Downloading ${table.replace("_", " ")}…`);
    const rows = await fetchAll(table, userId);
    allRows.push(...rows);
    added[table] = mergeList(key, rows.map((row) => row.data), identity);
  }

  const periodLogs = readLocalJSON("dayflow_period_logs", {}) || {};
  let newPeriod = 0;
  for (const row of await fetchAll("period_logs", userId)) {
    if (row.date && !periodLogs[row.date]) {
      periodLogs[row.date] = row.data;
      newPeriod += 1;
    }
  }
  if (newPeriod) writeLocalJSON("dayflow_period_logs", periodLogs);
  added.period_logs = newPeriod;

  // Download any referenced photos that aren't on this device yet.
  const refs = [...collectPhotoRefs(allRows.map((row) => row.data))];
  let photos = 0;
  for (const ref of refs) {
    if (await hasPhoto(ref)) continue;
    const { data } = await supabase.storage.from("photos").download(`${userId}/${photoRefId(ref)}.jpg`);
    if (data) {
      await savePhotoWithRef(ref, await blobToDataUrl(data));
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
  const { data, error } = await supabase.rpc("create_couple_invite");
  return { code: data, error };
}

export async function acceptCoupleInvite(code) {
  if (!supabase) return { skipped: true };
  const { data, error } = await supabase.rpc("accept_couple_invite", { invite_code: code });
  return { coupleId: data, error };
}

export async function leaveCouple() {
  if (!supabase) return { skipped: true };
  return supabase.rpc("leave_couple");
}

export async function getCouple() {
  const session = await getCloudSession();
  if (!session) return null;
  const { data: couple } = await supabase.from("couples").select("*").maybeSingle();
  if (!couple) return null;
  const partnerId = couple.user_a === session.user.id ? couple.user_b : couple.user_a;
  const { data: profile } = await supabase.from("profiles").select("id,name").eq("id", partnerId).maybeSingle();
  return { ...couple, partnerId, partnerName: profile?.name || "Partner" };
}

// The partner's shared items (RLS returns only categories they share).
export async function getPartnerFeed(partnerId) {
  if (!supabase || !partnerId) return [];
  const tables = [["memories", "memory"], ["plans", "plan"], ["meals", "meal"], ["workouts", "workout"]];
  const results = [];
  for (const [table, type] of tables) {
    const { data } = await supabase.from(table).select("id,date,data,updated_at").eq("user_id", partnerId).order("updated_at", { ascending: false }).limit(10);
    (data || []).forEach((row) => results.push({ type, ...row }));
  }
  return results.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 20);
}

export async function partnerPhotoUrl(partnerId, ref) {
  if (!supabase || !isPhotoRef(ref)) return "";
  const { data } = await supabase.storage.from("photos").createSignedUrl(`${partnerId}/${photoRefId(ref)}.jpg`, 3600);
  return data?.signedUrl || "";
}

export async function pushSharingPreferences() {
  const session = await getCloudSession();
  if (!session) return { skipped: true };
  const privacy = readPrivacy();
  return supabase.from("couple_shares").upsert(
    PRIVACY_CATEGORIES.map((c) => ({ user_id: session.user.id, category: c.id, shared: Boolean(privacy[c.id]), updated_at: new Date().toISOString() })),
    { onConflict: "user_id,category" },
  );
}
