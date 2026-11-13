import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "../components/ui.jsx";
import { appLockSupported, biometricAvailability, readAppLock, saveAppLock, unlockWithBiometrics } from "../lib/appLock";
import { readReminders, saveReminders, ensurePermission, notificationsSupported, applyJournalReminder } from "../lib/notifications";
import { PRIVACY_CATEGORIES, readPrivacy, savePrivacy } from "../lib/privacy";
import { classNames } from "../lib/utils";
import { CloudSettings } from "./CloudSettings.jsx";
import { pushSharingPreferences } from "../lib/cloud";

function Toggle({ checked, onChange, label, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={classNames("relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40", checked ? "bg-[hsl(160_50%_45%)]" : "bg-zinc-300 dark:bg-zinc-700")}
    >
      <span className={classNames("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition", checked ? "left-[1.4rem]" : "left-0.5")} />
    </button>
  );
}

function Section({ title, children, note }) {
  return (
    <section className="rounded-3xl bg-zinc-50 p-4 dark:bg-zinc-800/60">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">{title}</p>
      <div className="space-y-3">{children}</div>
      {note && <p className="mt-3 text-xs text-zinc-500">{note}</p>}
    </section>
  );
}

function Row({ label, children, sub }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {sub && <p className="text-xs text-zinc-500">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Settings({ user, onClose, onLogout, focus }) {
  const [lock, setLock] = useState(readAppLock);
  const [lockAvailable, setLockAvailable] = useState(false);
  const [reminders, setReminders] = useState(readReminders);
  const [privacy, setPrivacy] = useState(readPrivacy);
  const [message, setMessage] = useState("");

  useEffect(() => {
    biometricAvailability().then((result) => setLockAvailable(result.available));
  }, []);

  useEffect(() => {
    if (focus) document.getElementById(`settings-${focus}`)?.scrollIntoView({ block: "center" });
  }, [focus]);

  async function toggleLock(next) {
    if (next && !(await unlockWithBiometrics())) {
      setMessage("Face ID / passcode check failed, so the lock wasn't turned on.");
      return;
    }
    const value = { ...lock, enabled: next };
    saveAppLock(value);
    setLock(value);
  }

  async function updateJournal(patch) {
    const journal = { ...reminders.journal, ...patch };
    if (journal.enabled && !(await ensurePermission())) {
      setMessage("Allow notifications for Xlife in iPhone Settings to get reminders.");
      return;
    }
    const next = { ...reminders, journal };
    saveReminders(next);
    setReminders(next);
    await applyJournalReminder(journal).catch(() => setMessage("Couldn't schedule the reminder."));
  }

  function togglePrivacy(id, value) {
    const next = { ...privacy, [id]: value };
    savePrivacy(next);
    setPrivacy(next);
    pushSharingPreferences().catch(() => {});
  }

  return (
    <div className="fixed inset-0 z-[65] overflow-y-auto bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50" role="dialog" aria-label="Settings">
      <div className="mx-auto max-w-2xl space-y-4 p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <p className="text-2xl font-black">Settings</p>
          <button onClick={onClose} aria-label="Close settings" className="rounded-full bg-zinc-100 p-2 dark:bg-zinc-800"><X className="h-5 w-5" /></button>
        </div>

        <CloudSettings user={user} />

        <Section title="Privacy & security" note={appLockSupported() ? "Xlife locks again after a minute in the background." : "Face ID lock is available in the iPhone app."}>
          <Row label="Lock with Face ID / passcode">
            <Toggle label="Lock with Face ID" checked={lock.enabled} disabled={!lockAvailable} onChange={toggleLock} />
          </Row>
        </Section>

        <div id="settings-reminders">
          <Section title="Reminders" note={notificationsSupported() ? "Reminders are local notifications on this phone. Cycle and rest-timer reminders are in Health and Gym." : "Reminders work in the iPhone app (local notifications)."}>
            <Row label="Daily journal reminder">
              <Toggle label="Daily journal reminder" checked={reminders.journal.enabled} disabled={!notificationsSupported()} onChange={(enabled) => updateJournal({ enabled })} />
            </Row>
            {reminders.journal.enabled && (
              <input type="time" className="field" value={reminders.journal.time} onChange={(e) => updateJournal({ time: e.target.value })} aria-label="Journal reminder time" />
            )}
          </Section>
        </div>

        <div id="settings-privacy">
          <Section title="What your partner can see" note="Applies once you're paired through Xlife Cloud. Health, intimate and journal data stay private unless you turn them on.">
            {PRIVACY_CATEGORIES.map((category) => (
              <Row key={category.id} label={category.label} sub={category.sensitive ? "Private by default" : undefined}>
                <Toggle label={`Share ${category.label}`} checked={privacy[category.id]} onChange={(value) => togglePrivacy(category.id, value)} />
              </Row>
            ))}
          </Section>
        </div>

        {message && <p className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800" role="status">{message}</p>}

        <Button variant="secondary" onClick={onLogout} className="w-full rounded-2xl py-3">Log out</Button>
      </div>
    </div>
  );
}
