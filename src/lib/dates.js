import { localDateISO } from "./storage";

export 
// Evaluated once per page load. AppShell reloads the WebView when the app is
// resumed on a new calendar day so this never goes stale (see AppShell).
const todayISO = localDateISO();
export 
function toLocalDate(iso) {
  return new Date(`${iso}T00:00:00`);
}
export 
function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
export 
function daysBetween(startISO, endISO) {
  // Math.round, not floor: a day containing a DST change is 23 or 25 hours long.
  return Math.round((toLocalDate(endISO) - toLocalDate(startISO)) / 86400000);
}
