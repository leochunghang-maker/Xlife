import { useState } from "react";
import { motion } from "framer-motion";
import { Dumbbell } from "lucide-react";
import { readLocalJSON, writeLocalJSON } from "../lib/storage";
import { Button, SoftCard, SectionTitle } from "../components/ui.jsx";
import { todayISO } from "../lib/dates";
import { classNames } from "../lib/utils";
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

function WorkoutTracker({ log, setLog }) {
  const selectedType = log.workout?.type || "Chest";
  const exercises = workoutTemplates[selectedType] || [];
  const loggedExercises = log.workout?.exercises || {};

  function selectWorkoutType(type) {
    const savedTemplate = readLocalJSON(`dayflow_workout_${type}`, {});

    setLog({
      ...log,
      workout: {
        ...log.workout,
        type,
        exercises: savedTemplate,
      },
    });
  }

  function updateExercise(name, field, value) {
    setLog({
      ...log,
      workout: {
        ...log.workout,
        type: selectedType,
        exercises: {
          ...loggedExercises,
          [name]: {
            done: false,
            weight: "",
            reps: "",
            ...(loggedExercises[name] || {}),
            [field]: value,
          },
        },
      },
    });
  }

  function toggleDone(name) {
    const current = loggedExercises[name] || { done: false, weight: "", reps: "" };
    updateExercise(name, "done", !current.done);
  }

  return (
    <SoftCard>
      <SectionTitle icon={Dumbbell} title="Workout" />

      <div className="grid grid-cols-2 gap-2 mb-4">
        {Object.keys(workoutTemplates).map((type) => (
          <button
            key={type}
            onClick={() => selectWorkoutType(type)}
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

      {selectedType === "Rest" ? (
        <div className="rounded-3xl bg-zinc-100 dark:bg-zinc-800 p-5 text-center">
          <p className="text-3xl mb-2">😌</p>
          <p className="font-bold">Rest day</p>
          <p className="text-sm text-zinc-500 mt-1">Recovery is part of the program.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exercises.map((exercise) => {
            const item = loggedExercises[exercise] || { done: false, weight: "", reps: "" };
            return (
              <div
                key={exercise}
                className={classNames(
                  "rounded-3xl p-3 transition",
                  item.done ? "bg-[hsl(160_50%_45%)]/10" : "bg-zinc-100 dark:bg-zinc-800"
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => toggleDone(exercise)}
                    className={classNames(
                      "h-7 w-7 rounded-full border flex items-center justify-center text-sm font-bold",
                      item.done
                        ? "bg-[hsl(160_50%_45%)] text-white border-[hsl(160_50%_45%)]"
                        : "bg-white dark:bg-zinc-900 border-zinc-300"
                    )}
                  >
                    {item.done ? "✓" : ""}
                  </button>
                  <p className="font-semibold flex-1">{exercise}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={item.weight}
                    onChange={(e) => updateExercise(exercise, "weight", e.target.value)}
                    placeholder="Weight"
                    className="rounded-2xl bg-white dark:bg-zinc-900 px-4 py-3 outline-none text-sm"
                  />
                  <input
                    type="number"
                    value={item.reps}
                    onChange={(e) => updateExercise(exercise, "reps", e.target.value)}
                    placeholder="Reps"
                    className="rounded-2xl bg-white dark:bg-zinc-900 px-4 py-3 outline-none text-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SoftCard>
  );
}

function summarizeWorkout(exercises = {}) {
  const done = Object.entries(exercises).filter(([, item]) => item?.done);
  const volume = done.reduce((sum, [, item]) => sum + Number(item.weight || 0) * Number(item.reps || 0), 0);
  const reps = done.reduce((sum, [, item]) => sum + Number(item.reps || 0), 0);
  return { doneCount: done.length, volume: Math.round(volume), reps, doneNames: done.map(([name]) => name) };
}
export 
function Gym({ log, setLog }) {
  const [error, setError] = useState("");
  const completed = log.workout?.completed_at ? log.workout : null;

  function doneWorkout() {
    const type = log.workout?.type;
    const exercises = log.workout?.exercises || {};
    const summary = summarizeWorkout(exercises);
    if (type !== "Rest" && summary.doneCount === 0) {
      setError("Tick at least one exercise as done before finishing.");
      return;
    }
    setError("");
    const history = readLocalJSON("dayflow_workout_history", []);
    const now = new Date().toISOString();
    const newWorkout = {
      date: todayISO,
      type,
      exercises,
      summary,
      savedAt: now,
    };

    // Pressing Done twice on the same day used to add duplicate history rows.
    const withoutToday = (Array.isArray(history) ? history : []).filter((item) => !(item.date === todayISO && item.type === type));
    writeLocalJSON("dayflow_workout_history", [newWorkout, ...withoutToday]);
    writeLocalJSON(`dayflow_workout_${type}`, exercises);
    setLog((current) => ({ ...current, workout: { ...current.workout, completed_at: now, summary } }));
  }

  function editWorkout() {
    setLog((current) => ({ ...current, workout: { ...current.workout, completed_at: null } }));
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
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Another step stronger. Consistency builds progress.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <SummaryPill label="Split" value={completed.type} />
              <SummaryPill label="Exercises" value={completed.summary?.doneCount ?? 0} />
              <SummaryPill label="Volume" value={`${completed.summary?.volume ?? 0}`} />
            </div>
            {completed.summary?.doneNames?.length > 0 && (
              <p className="mt-3 text-xs text-zinc-500">{completed.summary.doneNames.join(" · ")}</p>
            )}
          </div>
          <Button variant="secondary" onClick={editWorkout} className="mt-3 w-full rounded-2xl py-3">Edit workout</Button>
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
    </motion.div>
  );
}
