// Safe localStorage helpers.
//
// Existing storage keys (dayflow_*) are intentionally NOT renamed: they hold
// real user data on already-installed iPhones. See docs/BACKLOG.md for the
// key inventory and the cloud migration plan.

export const STORAGE_ERROR_EVENT = "xlife:storage-error";

export function readLocalJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

// Returns true when the value was written. On failure (usually the ~5 MB
// WebView quota being exceeded by photos) it keeps the previous value intact
// and notifies the app shell so the user can be warned instead of the app
// crashing or silently dropping data.
export function writeLocalJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[xlife] Failed to save ${key}`, error);
    try {
      window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key, message: String(error?.message || error) } }));
    } catch {
      // ignore
    }
    return false;
  }
}

export function writeLocalString(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`[xlife] Failed to save ${key}`, error);
    try {
      window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key, message: String(error?.message || error) } }));
    } catch {
      // ignore
    }
    return false;
  }
}

// Local calendar date (YYYY-MM-DD) in the device's time zone.
// Never use `new Date().toISOString().slice(0, 10)` for this: that is the UTC
// date, which is "yesterday" before 08:00 in Hong Kong.
export function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Resolve the local date a stored record belongs to. Prefers an explicit
// `date` field; otherwise converts a timestamp to the device's local date.
export function recordLocalDate(item) {
  if (!item || typeof item !== "object") return "";
  if (item.date) return item.date;
  const timestamp = item.createdAt || item.taken_at || item.savedAt || item.addedFromSuggestionAt;
  if (!timestamp) return "";
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? "" : localDateISO(parsed);
}
