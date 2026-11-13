import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Dumbbell, Plus, Trash2, Download, Timer } from "lucide-react";
import { readLocalJSON, writeLocalJSON, createId } from "../lib/storage";
import { Button, SoftCard, SectionTitle } from "../components/ui.jsx";
import { todayISO } from "../lib/dates";
import { classNames, nowMs } from "../lib/utils";
import { getSets, doneSets, isExerciseDone, summarizeWorkout, readWorkoutHistory, previousSetsFor, personalBests, isPersonalRecord, workoutHistoryCsv, readRestSeconds, REST_SECONDS_KEY } from "../lib/gym";
import { exportTextFile } from "../lib/exportFile";
import { scheduleRestDone, cancelRestDone, readReminders, saveReminders, ensurePermission, notificationsSupported } from "../lib/notifications";
import { SummaryPill } from "./Dashboard.jsx";


const workoutTemplates = {
  Chest: [
    "Incline DB Press",
    "Incline BB Press",
    "Incline Machine",
    "Bench Press",
    "Machine Press",
    "Dips",
    "Declined Press",
  ],
  Back: [
    "Pull up",
    "Lat Pulldown",
    "Seated Row",
    "Single Arm Row",
    "Barbell Row",
    "Rear Delt Fly",
    "Chest Supported Row",
  ],
  "Shoulder/Arm": [
    "DB Shoulder Press",
    "Smith Shoulder Press",
    "Machine Shoulder Press",
    "DB Bicep Curl",
    "Machine Bicep Curl",
    "DB Hammer Curl",
    "Machine Hammer Curl",
    "Tricep Pushdown",
    "Overhead Tricep",
    "Forearm",
  ],
  "Chest/Back": [
    "Incline DB Press",
    "Incline BB Press",
    "Incline Machine",
    "Bench Press",
    "Machine Press",
    "Dips",
    "Declined Press",
    "Pull up",
    "Lat Pulldown",
    "Seated Row",
    "Single Arm Row",
    "Barbell Row",
    "Rear Delt Fly",
    "Chest Supported Row",
  ],
  Leg: [
    "Squat",
    "Smith Squat",
    "Hack Squat",
    "Hip Thrust",
    "Leg Press",
    "RDL",
    "Hip Abductor",
    "Hip Adductor",
    "Back Extension",
    "Leg Extension",
    "Leg Curl",
  ],
  Rest: [],
};

// Rest timer (Hevy/Strong style): starts when a set is ticked done. Stored as
// an end timestamp so it keeps counting across re-renders and app switches.
function RestTimer({ endAt, onAdjust, onSkip }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.ceil((endAt - now) / 1000));
  useEffect(() => {
    if (remaining === 0 && typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(200);
  }, [remaining]);
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");
  return (
    <div className="sticky top-[calc(5.75rem+env(safe-area-inset-top))] z-20 flex items-center gap-2 rounded-3xl bg-zinc-900 p-3 text-white shadow-lg dark:bg-white dark:text-zinc-900" role="timer" aria-live="polite">
      <Timer className="h-5 w-5" />
      <p className="flex-1 font-bold">{remaining ? `Rest ${mm}:${ss}` : "Rest over — next set!"}</p>
      <button className="rounded-2xl px-3 py-2 text-sm font-bold ring-1 ring-current" onClick={() => onAdjust(-15)} aria-label="Rest 15 seconds less">−15s</button>
      <button className="rounded-2xl px-3 py-2 text-sm font-bold ring-1 ring-current" onClick={() => onAdjust(15)} aria-label="Rest 15 seconds more">+15s</button>
      <button className="rounded-2xl px-3 py-2 text-sm font-bold ring-1 ring-current" onClick={onSkip}>{remaining ? "Skip" : "Close"}</button>
    </div>
  );
}

function WorkoutTracker({ log, setLog }) {
  const selectedType = log.workout?.type || "Chest";
  const exercises = workoutTemplates[selectedType] || [];
  const loggedExercises = log.workout?.exercises || {};
  const history = useMemo(() => readWorkoutHistory(), []);
  const bests = useMemo(() => personalBests(history, todayISO), [history]);
  const [restEndAt, setRestEndAt] = useState(null);
  const [restSeconds, setRestSeconds] = useState(readRestSeconds);

  function selectWorkoutType(type) {
    const savedTemplate = readLocalJSON(`dayflow_workout_${type}`, {});
    // Start from last time's weights/reps but with nothing ticked yet.
    const fresh = Object.fromEntries(Object.entries(savedTemplate || {}).map(([name, item]) => {
      const sets = getSets(item).map((set) => ({ weight: set.weight ?? "", reps: set.reps ?? "", done: false }));
      return [name, { ...item, done: false, sets, weight: sets[0]?.weight ?? "", reps: sets[0]?.reps ?? "" }];
    }));
    setLog((current) => ({ ...current, workout: { ...current.workout, type, exercises: fresh } }));
  }

  function writeSets(name, sets) {
    setLog((current) => {
      const currentExercises = current.workout?.exercises || {};
      return {
        ...current,
        workout: {
          ...current.workout,
          type: selectedType,
          exercises: {
            ...currentExercises,
            [name]: {
              ...(currentExercises[name] || {}),
              sets,
              done: sets.some((set) => set.done),
              weight: sets[0]?.weight ?? "",
              reps: sets[0]?.reps ?? "",
            },
          },
        },
      };
    });
  }

  function updateSet(name, index, field, value) {
    const sets = getSets(loggedExercises[name]);
    const base = sets.length ? sets : [{ weight: "", reps: "", done: false }];
    const next = base.map((set, i) => (i === index ? { ...set, [field]: value } : set));
    writeSets(name, next);
    if (field === "done" && value) startRest();
  }

  function addSet(name) {
    const sets = getSets(loggedExercises[name]);
    const last = sets[sets.length - 1] || { weight: "", reps: "" };
    writeSets(name, [...(sets.length ? sets : [{ weight: "", reps: "", done: false }]), { weight: last.weight, reps: last.reps, done: false }]);
  }

  function removeSet(name, index) {
    const sets = getSets(loggedExercises[name]).filter((_, i) => i !== index);
    writeSets(name, sets.length ? sets : [{ weight: "", reps: "", done: false }]);
  }

  function startRest() {
    const endAt = nowMs() + restSeconds * 1000;
    setRestEndAt(endAt);
    scheduleRestDone(endAt);
  }

  function adjustRest(delta) {
    setRestEndAt((current) => {
      const next = Math.max(nowMs(), (current || nowMs()) + delta * 1000);
      scheduleRestDone(next);
      return next;
    });
  }

  function skipRest() {
    setRestEndAt(null);
    cancelRestDone();
  }

  function changeRestSeconds(value) {
    const seconds = Number(value);
    setRestSeconds(seconds);
    localStorage.setItem(REST_SECONDS_KEY, String(seconds));
  }

  return (
    <SoftCard>
      <SectionTitle icon={Dumbbell} title="Workout" />
      {restEndAt && <RestTimer endAt={restEndAt} onAdjust={adjustRest} onSkip={skipRest} />}

      <div className="grid grid-cols-2 gap-2 my-4">
        {Object.keys(workoutTemplates).map((type) => (
          <button
            key={type}
            onClick={() => selectWorkoutType(type)}
            aria-pressed={selectedType === type}
            className={classNames(
              "rounded-2xl py-3 text-sm font-semibold",
              selectedType === type
                ? "bg-[hsl(160_50%_45%)] text-white"
                : "bg-zinc-100 dark:bg-zinc-800"
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {selectedType !== "Rest" && (
        <label className="mb-3 flex items-center justify-between gap-3 text-sm font-semibold text-zinc-500">
          Rest timer after each set
          <select className="rounded-2xl bg-zinc-100 px-3 py-2 dark:bg-zinc-800" value={restSeconds} onChange={(e) => changeRestSeconds(e.target.value)} aria-label="Rest timer length">
            {[30, 45, 60, 90, 120, 150, 180, 240, 300].map((sec) => <option key={sec} value={sec}>{sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`}</option>)}
          </select>
        </label>
      )}

      {selectedType === "Rest" ? (
        <div className="rounded-3xl bg-zinc-100 dark:bg-zinc-800 p-5 text-center">
          <p className="text-3xl mb-2">😌</p>
          <p className="font-bold">Rest day</p>
          <p className="text-sm text-zinc-500 mt-1">Recovery is part of the program.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exercises.map((exercise) => {
            const item = loggedExercises[exercise];
            const sets = getSets(item).length ? getSets(item) : [{ weight: "", reps: "", done: false }];
            const done = isExerciseDone(item);
            const previous = previousSetsFor(exercise, history, todayISO);
            return (
              <div
                key={exercise}
                className={classNames(
                  "rounded-3xl p-3 transition",
                  done ? "bg-[hsl(160_50%_45%)]/10" : "bg-zinc-100 dark:bg-zinc-800"
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <p className="flex-1 font-semibold">{exercise}</p>
                  {done && <span className="text-xs font-bold text-[hsl(160_50%_35%)]">✓ done</span>}
                </div>
                {previous && (
                  <p className="mb-2 text-xs text-zinc-500">Previous ({previous.date}): {previous.sets.map((set) => `${set.weight || 0}×${set.reps || 0}`).join(", ")}</p>
                )}
                <div className="space-y-2">
                  {sets.map((set, index) => {
                    const prev = previous?.sets[index];
                    const pr = isPersonalRecord(set, bests[exercise]);
                    return (
                      <div key={index} className="grid grid-cols-[2rem_1fr_1fr_2.5rem_2rem] items-center gap-2">
                        <span className="text-center text-xs font-bold text-zinc-400">{index + 1}</span>
                        <input type="number" inputMode="decimal" value={set.weight} onChange={(e) => updateSet(exercise, index, "weight", e.target.value)} placeholder={prev ? String(prev.weight) : "Weight"} aria-label={`${exercise} set ${index + 1} weight`} className="w-full min-w-0 rounded-2xl bg-white px-3 py-3 text-sm outline-none dark:bg-zinc-900" />
                        <input type="number" inputMode="numeric" value={set.reps} onChange={(e) => updateSet(exercise, index, "reps", e.target.value)} placeholder={prev ? String(prev.reps) : "Reps"} aria-label={`${exercise} set ${index + 1} reps`} className="w-full min-w-0 rounded-2xl bg-white px-3 py-3 text-sm outline-none dark:bg-zinc-900" />
                        <button
                          onClick={() => updateSet(exercise, index, "done", !set.done)}
                          aria-label={`Mark ${exercise} set ${index + 1} ${set.done ? "not done" : "done"}`}
                          aria-pressed={Boolean(set.done)}
                          className={classNames(
                            "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold",
                            set.done ? "border-[hsl(160_50%_45%)] bg-[hsl(160_50%_45%)] text-white" : "border-zinc-300 bg-white dark:bg-zinc-900"
                          )}
                        >
                          {set.done ? "✓" : ""}
                        </button>
                        {sets.length > 1 ? (
                          <button onClick={() => removeSet(exercise, index)} aria-label={`Remove ${exercise} set ${index + 1}`} className="text-zinc-400"><Trash2 className="h-4 w-4" /></button>
                        ) : <span />}
                        {pr && <span className="col-span-5 -mt-1 text-xs font-black text-amber-600">🏆 New personal record</span>}
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => addSet(exercise)} className="mt-2 flex items-center gap-1 text-sm font-bold text-[hsl(160_50%_35%)]" aria-label={`Add set to ${exercise}`}>
                  <Plus className="h-4 w-4" /> Add set
                </button>
              </div>
            );
          })}
        </div>
      )}
    </SoftCard>
  );
}

function WorkoutTools() {
  const [message, setMessage] = useState("");
  const [restNotify, setRestNotify] = useState(() => readReminders().restTimer.enabled);

  async function exportCsv() {
    const history = readWorkoutHistory();
    if (!history.length) {
      setMessage("No finished workouts to export yet.");
      return;
    }
    await exportTextFile(`xlife-workouts-${todayISO}.csv`, workoutHistoryCsv(history), "text/csv");
    setMessage(`Exported ${history.length} workout${history.length === 1 ? "" : "s"}.`);
  }

  async function toggleRestNotify() {
    const next = !restNotify;
    if (next && !(await ensurePermission())) {
      setMessage("Allow notifications for Xlife in iPhone Settings to get rest alerts.");
      return;
    }
    const reminders = readReminders();
    saveReminders({ ...reminders, restTimer: { enabled: next } });
    setRestNotify(next);
  }

  return (
    <SoftCard>
      <div className="grid gap-2">
        <Button variant="secondary" onClick={exportCsv} className="w-full rounded-2xl py-3"><Download className="mr-2 h-4 w-4" />Export workouts (CSV)</Button>
        {notificationsSupported() && (
          <Button variant="secondary" onClick={toggleRestNotify} aria-pressed={restNotify} className="w-full rounded-2xl py-3">
            {restNotify ? "Rest-over notifications: on" : "Notify me when rest is over"}
          </Button>
        )}
        {message && <p className="text-sm text-zinc-500" role="status">{message}</p>}
      </div>
    </SoftCard>
  );
}

// Encouragements from local-latest; one is picked when the workout is saved.
const ENCOURAGEMENTS = [
  "Strong work — consistency builds the body you want.",
  "You showed up today. That’s the win.",
  "Great session. Your future self will thank you.",
  "Another step stronger.",
  "Discipline logged. Keep going.",
];

export function Gym({ log, setLog }) {
  const [error, setError] = useState("");
  const completed = log.workout?.completed_at ? log.workout : null;
  const prCount = useMemo(() => {
    if (!completed) return 0;
    const bests = personalBests(readWorkoutHistory(), todayISO);
    return Object.entries(completed.exercises || {}).reduce((count, [name, item]) => count + getSets(item).filter((set) => isPersonalRecord(set, bests[name])).length, 0);
  }, [completed]);

  function doneWorkout() {
    const type = log.workout?.type || "Chest";
    const exercises = log.workout?.exercises || {};
    const summary = {
      ...summarizeWorkout(exercises),
      message: ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)],
    };
    if (type !== "Rest" && summary.doneCount === 0) {
      setError("Tick at least one set as done before finishing.");
      return;
    }
    setError("");
    const history = readLocalJSON("dayflow_workout_history", []);
    const sessionId = log.workout?.session_id || null;
    const now = new Date().toISOString();
    const newWorkout = {
      date: todayISO,
      type,
      exercises,
      summary,
      savedAt: now,
      ...(sessionId ? { session_id: sessionId } : {}),
    };

    // Pressing Done twice on the same day used to add duplicate history rows.
    // "Start another workout" gives the new session a session_id so a second
    // session of the same split on the same day is kept as its own entry.
    const withoutToday = (Array.isArray(history) ? history : []).filter((item) => sessionId
      ? item.session_id !== sessionId
      : !(item.date === todayISO && item.type === type && !item.session_id));
    writeLocalJSON("dayflow_workout_history", [newWorkout, ...withoutToday]);
    writeLocalJSON(`dayflow_workout_${type}`, exercises);
    cancelRestDone();
    setLog((current) => ({ ...current, workout: { ...current.workout, type, completed_at: now, summary } }));
  }

  function editWorkout() {
    setLog((current) => ({ ...current, workout: { ...current.workout, completed_at: null } }));
  }

  // From local-latest: start a fresh session (the finished one is already in
  // dayflow_workout_history and its weights are remembered per split).
  function startAnotherWorkout() {
    setLog((current) => ({ ...current, workout: { type: current.workout?.type || "Chest", exercises: {}, session_id: createId() } }));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {completed ? (
        <SoftCard>
          <SectionTitle icon={Dumbbell} title="Workout" />
          <div className="rounded-3xl bg-[hsl(160_50%_45%)]/10 p-5 text-center" role="status">
            <p className="text-2xl font-black">Workout Complete 💪</p>
            <p className="mt-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">{completed.summary?.message || "Another step stronger. Consistency builds progress."}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <SummaryPill label="Split" value={completed.type} />
              <SummaryPill label="Sets" value={completed.summary?.setCount ?? completed.summary?.doneCount ?? 0} />
              <SummaryPill label="Volume" value={`${completed.summary?.volume ?? 0}`} />
            </div>
            {prCount > 0 && <p className="mt-3 font-black text-amber-600">🏆 {prCount} new personal record{prCount === 1 ? "" : "s"}</p>}
          </div>
          {Object.keys(completed.exercises || {}).some((name) => doneSets(completed.exercises[name]).length) && (
            <div className="mt-3 rounded-3xl bg-zinc-100 p-4 dark:bg-zinc-800">
              <p className="font-bold">Logged exercises</p>
              <div className="mt-2 space-y-2">
                {Object.entries(completed.exercises || {}).filter(([, item]) => doneSets(item).length).map(([name, item]) => (
                  <div key={name} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 text-sm dark:bg-zinc-900">
                    <span className="font-semibold">{name}</span>
                    <span className="text-right text-zinc-500">{doneSets(item).map((set) => `${set.weight || 0} × ${set.reps || 0}`).join(", ")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="mt-2 text-center text-xs text-zinc-500">Completed {new Date(completed.completed_at).toLocaleString()}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={editWorkout} className="w-full rounded-2xl py-3">Edit workout</Button>
            <Button onClick={startAnotherWorkout} className="w-full rounded-2xl bg-[hsl(24_80%_58%)] py-3 text-white">Start another workout</Button>
          </div>
        </SoftCard>
      ) : (
        <>
          <WorkoutTracker log={log} setLog={setLog} />
          {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-200" role="alert">{error}</p>}
          <Button
            onClick={doneWorkout}
            className="w-full rounded-2xl py-6 bg-[hsl(24_80%_58%)] text-white"
          >
            Done Workout
          </Button>
        </>
      )}
      <WorkoutTools />
    </motion.div>
  );
}
