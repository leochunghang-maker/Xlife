// Photo storage outside localStorage.
//
// Records keep a short reference string ("xlife-photo:<id>") instead of a
// multi-hundred-KB data URL, so localStorage no longer hits its ~5 MB quota.
//  - iOS/Android (Capacitor): JPEG files in the app's private Data directory
//    via @capacitor/filesystem (photos/<id>.jpg). Not visible in the Photos app.
//  - Web/dev: IndexedDB database "xlife", object store "photos".
// Legacy data URLs (and any http(s) URL) are still accepted everywhere and
// rendered as-is, so old records keep working before/without migration.

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { createId } from "./storage";

export const PHOTO_REF_PREFIX = "xlife-photo:";
const DB_NAME = "xlife";
const STORE = "photos";
const urlCache = new Map();

export function isPhotoRef(value) {
  return typeof value === "string" && value.startsWith(PHOTO_REF_PREFIX);
}

export function isInlinePhoto(value) {
  return typeof value === "string" && value.startsWith("data:image/");
}

function hasNativeFiles() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Filesystem");
}

let dbPromise = null;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB is not available."));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

async function idb(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Photo save was aborted."));
  });
}

function refId(ref) {
  return ref.slice(PHOTO_REF_PREFIX.length).replace(/[^a-zA-Z0-9-]/g, "");
}

// Saves a data URL and returns a reference. Throws if the photo could not be
// stored and read back, so callers can keep the inline data URL instead.
export async function savePhoto(dataUrl) {
  if (!isInlinePhoto(dataUrl)) return dataUrl;
  const id = createId();
  const ref = `${PHOTO_REF_PREFIX}${id}`;
  if (hasNativeFiles()) {
    const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    await Filesystem.writeFile({ path: `photos/${id}.jpg`, data: base64, directory: Directory.Data, recursive: true });
    await Filesystem.stat({ path: `photos/${id}.jpg`, directory: Directory.Data });
  } else {
    await idb("readwrite", (store) => store.put(dataUrl, id));
    const check = await idb("readonly", (store) => store.get(id));
    if (check !== dataUrl) throw new Error("Photo could not be verified after saving.");
  }
  urlCache.set(ref, dataUrl);
  return ref;
}

// Best effort: keep the inline data URL if the photo store is unavailable.
export async function persistPhoto(dataUrl) {
  try {
    return await savePhoto(dataUrl);
  } catch {
    return dataUrl;
  }
}

// Returns a URL an <img> can display, or "" when the photo is missing.
export async function resolvePhoto(value) {
  if (!value) return "";
  if (!isPhotoRef(value)) return value;
  if (urlCache.has(value)) return urlCache.get(value);
  const id = refId(value);
  let url;
  try {
    if (hasNativeFiles()) {
      const { uri } = await Filesystem.getUri({ path: `photos/${id}.jpg`, directory: Directory.Data });
      url = Capacitor.convertFileSrc(uri);
    } else {
      url = (await idb("readonly", (store) => store.get(id))) || "";
    }
  } catch {
    url = "";
  }
  if (url) urlCache.set(value, url);
  return url;
}

// Data URL form (for export, AI analysis, cloud upload).
export async function readPhotoAsDataUrl(value) {
  if (!value) return "";
  if (!isPhotoRef(value)) return value;
  const id = refId(value);
  if (hasNativeFiles()) {
    const { data } = await Filesystem.readFile({ path: `photos/${id}.jpg`, directory: Directory.Data });
    return typeof data === "string" ? `data:image/jpeg;base64,${data}` : await blobToDataUrl(data);
  }
  return (await idb("readonly", (store) => store.get(id))) || "";
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function deletePhoto(value) {
  if (!isPhotoRef(value)) return;
  const id = refId(value);
  urlCache.delete(value);
  try {
    if (hasNativeFiles()) await Filesystem.deleteFile({ path: `photos/${id}.jpg`, directory: Directory.Data });
    else await idb("readwrite", (store) => store.delete(id));
  } catch {
    // Already gone.
  }
}

// ---- One-time, non-destructive migration of inline photos ----------------
// Walks every Xlife localStorage value, moves inline data:image URLs into the
// photo store and replaces them with references. A key is only rewritten after
// every photo in it was saved and verified; on any failure the key is left
// untouched (and retried next launch). The same data URL is stored once.
const MIGRATION_FLAG = "xlife_photo_migration_v1";

function isAppKey(key) {
  return key.startsWith("dayflow_") || key.startsWith("xlife_");
}

async function replaceInline(value, seen) {
  if (isInlinePhoto(value)) {
    if (!seen.has(value)) seen.set(value, await savePhoto(value));
    return seen.get(value);
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) out.push(await replaceInline(item, seen));
    return out;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await replaceInline(v, seen);
    return out;
  }
  return value;
}

export async function migrateInlinePhotos({ storage = window.localStorage } = {}) {
  const report = { keys: 0, photos: 0, failedKeys: [] };
  const seen = new Map();
  const keys = [];
  for (let i = 0; i < storage.length; i += 1) keys.push(storage.key(i));
  for (const key of keys) {
    if (!key || !isAppKey(key) || key === MIGRATION_FLAG) continue;
    const raw = storage.getItem(key);
    if (!raw || !raw.includes("data:image/")) continue;
    try {
      const parsed = JSON.parse(raw);
      const before = seen.size;
      const next = await replaceInline(parsed, seen);
      // Re-check the key wasn't changed by the app while we were saving.
      if (storage.getItem(key) !== raw) {
        report.failedKeys.push(key);
        continue;
      }
      storage.setItem(key, JSON.stringify(next));
      report.keys += 1;
      report.photos += seen.size - before;
    } catch {
      report.failedKeys.push(key);
    }
  }
  if (!report.failedKeys.length) storage.setItem(MIGRATION_FLAG, new Date().toISOString());
  return report;
}
