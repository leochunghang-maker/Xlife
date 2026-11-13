import { useState } from "react";
import { Moon } from "lucide-react";
import { Button, SoftCard, SectionTitle } from "../components/ui.jsx";
import { todayISO } from "../lib/dates";
import { initialLog } from "../lib/dailyLog";
import { formatSleepDuration, currentTimeHHMM, minutesBetweenTimes, saveSleepHistoryRecord, syncSleepFromAppleHealth } from "../lib/sleep";
import { SummaryPill } from "./Dashboard.jsx";

export 
function SleepHealthKitCard({ log, setLog, requestWakeConfirmation }) {
  const sleep = log.sleep || initialLog.sleep;
  const [manualOpen, setManualOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  function saveSleep(nextSleep) {
    const sleepRecord = {
      ...sleep,
      ...nextSleep,
      sleep_stages: {
        ...sleep.sleep_stages,
        ...(nextSleep.sleep_stages || {}),
      },
    };
    saveSleepHistoryRecord(sleepRecord);
    setLog({
      ...log,
      wake_up_time: sleepRecord.wake_time,
      sleep_quality: sleepRecord.sleep_quality || log.sleep_quality,
      sleep: sleepRecord,
    });
  }

  async function handleHealthKitSync() {
    setSyncing(true);
    const result = await syncSleepFromAppleHealth();
    if (result?.connected && result.sleep) {
      saveSleep(result.sleep);
      requestWakeConfirmation?.();
      setSyncMessage("");
    } else {
      setSyncMessage("Apple Health sync isn't connected in this build yet. Use manual entry for now.");
      setManualOpen(true);
    }
    setSyncing(false);
  }

  function updateManualSleep(field, value) {
    const bedtime = field === "bedtime" ? value : sleep.bedtime;
    const wakeTime = field === "wake_time" ? value : sleep.wake_time;
    const duration = field === "duration_minutes"
      ? Number(value)
      : (bedtime && wakeTime ? minutesBetweenTimes(bedtime, wakeTime) : sleep.duration_minutes);

    saveSleep({
      source: "manual",
      bedtime,
      wake_time: wakeTime,
      duration_minutes: duration,
      sleep_quality: sleep.sleep_quality || log.sleep_quality,
      last_synced_at: sleep.last_synced_at,
    });
  }

  return (
    <SoftCard>
      <SectionTitle icon={Moon} title="Sleep" />

      <div className="mb-4 rounded-3xl bg-[hsl(160_50%_45%)]/10 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(160_50%_45%)]">
          {sleep.source === "apple_health" ? "Apple Health" : "Manual entry"}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <SummaryPill label="Duration" value={formatSleepDuration(sleep.duration_minutes)} />
          <SummaryPill label="Quality" value={log.sleep_quality || "--"} />
          <SummaryPill label="Bedtime" value={sleep.bedtime || "--"} />
          <SummaryPill label="Wake" value={sleep.wake_time || "--"} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2 text-center">
        {Object.entries(sleep.sleep_stages || {}).map(([stage, minutes]) => (
          <div key={stage} className="rounded-2xl bg-zinc-100 p-3 dark:bg-zinc-800">
            <p className="text-xs capitalize text-zinc-500">{stage}</p>
            <p className="font-bold">{minutes}m</p>
          </div>
        ))}
      </div>

      <p className="mb-3 rounded-2xl bg-[hsl(24_80%_58%)]/10 p-3 text-sm text-zinc-600 dark:text-zinc-300">
        Apple Health sleep sync is planned. For now, enter sleep manually or confirm your wake-up time.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleHealthKitSync}
          className="rounded-2xl bg-[hsl(24_80%_58%)] py-3 text-white"
          disabled={syncing}
        >
          {syncing ? "Checking..." : "Apple Health (soon)"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setManualOpen(!manualOpen)}
          className="rounded-2xl py-3"
        >
          Manual entry
        </Button>
      </div>

      {syncMessage && (
        <p className="mt-3 rounded-2xl bg-zinc-100 p-3 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{syncMessage}</p>
      )}

      {manualOpen && (
        <div className="mt-4 grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="time"
              value={sleep.bedtime}
              onChange={(e) => updateManualSleep("bedtime", e.target.value)}
              className="rounded-2xl bg-zinc-100 px-4 py-3 outline-none dark:bg-zinc-800"
            />
            <input
              type="time"
              value={sleep.wake_time}
              onChange={(e) => updateManualSleep("wake_time", e.target.value)}
              className="rounded-2xl bg-zinc-100 px-4 py-3 outline-none dark:bg-zinc-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={sleep.duration_minutes}
              onChange={(e) => updateManualSleep("duration_minutes", e.target.value)}
              className="rounded-2xl bg-zinc-100 px-4 py-3 outline-none dark:bg-zinc-800"
              placeholder="Minutes asleep"
            />
            <select
              value={log.sleep_quality || ""}
              onChange={(e) => setLog({
                ...log,
                sleep_quality: e.target.value,
                sleep: {
                  ...sleep,
                  sleep_quality: e.target.value,
                },
              })}
              className="field mb-0"
            >
              <option value="">Sleep quality</option>
              {["great", "good", "okay", "poor"].map((quality) => <option key={quality}>{quality}</option>)}
            </select>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-400">
        Last synced: {sleep.last_synced_at ? new Date(sleep.last_synced_at).toLocaleString() : "Not synced yet"}
      </p>
    </SoftCard>
  );
}
export 
function WakeConfirmationSheet({ log, setLog, onClose }) {
  const sleep = log.sleep || initialLog.sleep;
  const [editing, setEditing] = useState(false);
  const [wakeTime, setWakeTime] = useState(() => currentTimeHHMM());

  function confirmAwake() {
    const duration = minutesBetweenTimes(sleep.bedtime, wakeTime) || sleep.duration_minutes;
    const confirmedSleep = {
      ...sleep,
      date: todayISO,
      source: sleep.source || "estimated",
      wake_time: wakeTime,
      duration_minutes: duration,
      sleep_quality: sleep.sleep_quality || log.sleep_quality,
      confirmed_awake: true,
      confirmed_at: new Date().toISOString(),
    };

    saveSleepHistoryRecord(confirmedSleep);
    setLog({
      ...log,
      wake_up_time: wakeTime,
      sleep_quality: confirmedSleep.sleep_quality,
      sleep: confirmedSleep,
    });
    localStorage.removeItem("dayflow_wake_prompt_snoozed_at");
    onClose();
  }

  function dismissTemporarily() {
    localStorage.setItem("dayflow_wake_prompt_snoozed_at", new Date().toISOString());
    onClose();
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3">
      <div className="mx-auto max-w-2xl rounded-t-[2rem] rounded-b-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <p className="text-2xl font-bold">Are you awake?</p>
        <p className="mt-1 text-sm text-zinc-500">Confirm your wake-up time for today.</p>

        <div className="my-4 rounded-3xl bg-[hsl(24_80%_58%)]/10 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">Suggested wake time</p>
          {editing ? (
            <input
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-xl font-bold outline-none dark:bg-zinc-800"
            />
          ) : (
            <p className="mt-1 text-3xl font-bold">{wakeTime}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Button onClick={confirmAwake} className="rounded-2xl bg-[hsl(24_80%_58%)] py-4 text-white">
            Yes, I&apos;m awake
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={dismissTemporarily} className="rounded-2xl py-3">
              Not yet
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)} className="rounded-2xl py-3">
              Edit time
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
