import { useRef, useState } from "react";
import { Archive } from "lucide-react";
import { Button } from "../components/ui.jsx";
import { exportBackupPackage, parseBackupPackage, applyBackupPackage, backupFilename } from "../lib/backup";

export function BackupSettings() {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function exportNow() {
    setBusy("export");
    setMessage("");
    try {
      const pkg = await exportBackupPackage();
      const photos = Object.keys(pkg.photos || {}).length;
      const keys = Object.keys(pkg.keys || {}).length;
      const missing = pkg.missingPhotos?.length || 0;
      setMessage(`Exported ${backupFilename()} with ${keys} record groups and ${photos} photo${photos === 1 ? "" : "s"}${missing ? ` (${missing} photo file${missing === 1 ? " was" : "s were"} missing and skipped)` : ""}.`);
    } catch (error) {
      setMessage(error?.message || "Couldn't export the backup.");
    } finally {
      setBusy("");
    }
  }

  async function onPick(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy("restore");
    setMessage("");
    try {
      const text = await file.text();
      const pkg = parseBackupPackage(text);
      const photos = Object.keys(pkg.photos || {}).length;
      const keys = Object.keys(pkg.keys || {}).length;
      const when = pkg.exportedAt ? ` from ${new Date(pkg.exportedAt).toLocaleString()}` : "";
      if (!window.confirm(`Restore this Xlife backup${when}? It has ${keys} record groups and ${photos} photo${photos === 1 ? "" : "s"}. Xlife will only add missing items. Nothing already on this phone will be deleted, and a blank day will not replace a day that already has entries.`)) {
        setBusy("");
        return;
      }
      const report = await applyBackupPackage(pkg);
      const failed = report.failedPhotos.length;
      const summary = `Restored ${report.addedKeys} new and ${report.updatedKeys} merged record groups, plus ${report.addedPhotos} photo${report.addedPhotos === 1 ? "" : "s"}.`;
      const extra = [
        failed ? `${failed} photo${failed === 1 ? "" : "s"} could not be written.` : "",
        ...(report.warnings || []),
        "Reloading so everything shows up.",
      ].filter(Boolean).join(" ");
      setMessage(`${summary} ${extra}`);
      window.setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      setMessage(error?.message || "Couldn't restore that backup.");
      setBusy("");
    }
  }

  return (
    <section className="space-y-3 rounded-3xl bg-zinc-50 p-4 dark:bg-zinc-800/60" data-testid="offline-backup">
      <p className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">
        <Archive className="h-4 w-4" />Backup on this phone
      </p>
      <p className="text-sm font-semibold">Offline export and restore</p>
      <p className="text-xs text-zinc-500">
        Save a complete copy of your logs, meals, workouts, plans, cycle data, My foods, Together dates and photos. Restore only adds what this phone is missing. This stays on your device — it does not turn on Xlife Cloud.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={exportNow} disabled={!!busy} className="rounded-2xl bg-[hsl(160_50%_45%)] py-3 text-white">
          {busy === "export" ? "Exporting…" : "Export backup"}
        </Button>
        <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={!!busy} className="rounded-2xl py-3">
          {busy === "restore" ? "Restoring…" : "Restore from backup"}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Choose an Xlife backup file"
        onChange={onPick}
      />
      {message && <p className="text-sm text-zinc-500" role="status">{message}</p>}
    </section>
  );
}
