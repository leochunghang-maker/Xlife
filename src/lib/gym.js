import { readLocalJSON } from "./storage";
import { toCsv } from "./exportFile";

// Exercise entries: legacy { done, weight, reps } and the multi-set form
// { done, weight, reps, sets: [{ weight, reps, done }] }. weight/reps on the
// entry mirror the first set so older readers keep working.
export function getSets(item) {
  if (Array.isArray(item?.sets) && item.sets.length) return item.sets;
  if (!item) return [];
  return [{ weight: item.weight ?? "", reps: item.reps ?? "", done: Boolean(item.done) }];
}

export function isExerciseDone(item) {
  if (!item) return false;
  if (Array.isArray(item.sets) && item.sets.length) return item.sets.some((set) => set.done);
  return Boolean(item.done);
}

export function doneSets(item) {
  if (Array.isArray(item?.sets) && item.sets.length) return item.sets.filter((set) => set.done);
  return item?.done ? getSets(item) : [];
}

export function estimateOneRepMax(weight, reps) {
  const w = Number(weight || 0);
  const r = Number(reps || 0);
  if (!w || !r) return 0;
  return r === 1 ? w : w * (1 + r / 30); // Epley
}

export function summarizeWorkout(exercises = {}) {
  const done = Object.entries(exercises).filter(([, item]) => isExerciseDone(item));
  let volume = 0;
  let reps = 0;
  let setCount = 0;
  done.forEach(([, item]) => {
    doneSets(item).forEach((set) => {
      volume += Number(set.weight || 0) * Number(set.reps || 0);
      reps += Number(set.reps || 0);
      setCount += 1;
    });
  });
  return { doneCount: done.length, setCount, volume: Math.round(volume), reps, doneNames: done.map(([name]) => name) };
}

export function readWorkoutHistory() {
  const history = readLocalJSON("dayflow_workout_history", []);
  return Array.isArray(history) ? history : [];
}

// Most recent earlier session that included this exercise.
export function previousSetsFor(exercise, history, beforeDate) {
  for (const session of history) {
    if (session.date >= beforeDate) continue;
    const item = session.exercises?.[exercise];
    const sets = doneSets(item);
    if (sets.length) return { date: session.date, sets };
  }
  return null;
}

// Personal bests from earlier sessions only (so today's sets can beat them).
export function personalBests(history, beforeDate) {
  const bests = {};
  history.forEach((session) => {
    if (session.date >= beforeDate) return;
    Object.entries(session.exercises || {}).forEach(([name, item]) => {
      doneSets(item).forEach((set) => {
        const best = bests[name] || { weight: 0, e1rm: 0 };
        bests[name] = {
          weight: Math.max(best.weight, Number(set.weight || 0)),
          e1rm: Math.max(best.e1rm, estimateOneRepMax(set.weight, set.reps)),
        };
      });
    });
  });
  return bests;
}

export function isPersonalRecord(set, best) {
  if (!set?.done || !Number(set.weight) || !Number(set.reps)) return false;
  if (!best) return false; // first time doing it isn't a "record"
  return Number(set.weight) > best.weight || estimateOneRepMax(set.weight, set.reps) > best.e1rm + 0.01;
}

export function workoutHistoryCsv(history) {
  const rows = [["date", "split", "exercise", "set", "weight", "reps", "volume"]];
  [...history].sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((session) => {
    Object.entries(session.exercises || {}).forEach(([name, item]) => {
      doneSets(item).forEach((set, index) => {
        const volume = Number(set.weight || 0) * Number(set.reps || 0);
        rows.push([session.date, session.type, name, index + 1, set.weight, set.reps, volume || ""]);
      });
    });
  });
  return toCsv(rows);
}

export const REST_SECONDS_KEY = "xlife_rest_seconds";
export function readRestSeconds() {
  const value = Number(localStorage.getItem(REST_SECONDS_KEY));
  return value >= 15 && value <= 600 ? value : 90;
}
