// Background backup when the app goes to the background (signed-in cloud
// users only), at most every 10 minutes. Silent: errors are logged, never shown.
import { isSupabaseConfigured } from "./supabase";

let lastRun = 0;
export function maybeAutoBackup() {
  if (!isSupabaseConfigured) return;
  const now = Date.now();
  if (now - lastRun < 10 * 60 * 1000) return;
  lastRun = now;
  import("./cloud")
    .then(({ backupLocalToCloud }) => backupLocalToCloud())
    .catch((error) => console.warn("[xlife] auto backup failed", error));
}
