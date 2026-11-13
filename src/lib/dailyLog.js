import { readLocalJSON, writeLocalJSON, recordLocalDate } from "./storage";
import { todayISO, toLocalDate, toISODate } from "./dates";

export const moodOptions = [
  { id: "amazing", emoji: "🤩", label: "Amazing", score: 5 },
  { id: "happy", emoji: "😊", label: "Happy", score: 4 },
  { id: "neutral", emoji: "😐", label: "Neutral", score: 3 },
  { id: "tired", emoji: "😴", label: "Tired", score: 2 },
  { id: "stressed", emoji: "😵‍💫", label: "Stressed", score: 1 },
];

const emptySleep = {
  date: todayISO,
  source: "manual",
  bedtime: "",
  wake_time: "",
  duration_minutes: 0,
  sleep_quality: "",
  sleep_stages: {},
  last_synced_at: null,
  confirmed_awake: false,
  confirmed_at: null,
};

// A fresh, empty log for one calendar day. Earlier builds seeded this with demo
// meals/snaps/notes, which then showed up as if the user had logged them.
function createEmptyDailyLog(dateISO = todayISO, carryOver = {}) {
  const preferences = readLocalJSON("dayflow_user_preferences", {});
  return {
    date: dateISO,
    wake_up_time: "",
    sleep_quality: "",
    sleep: { ...emptySleep, date: dateISO },
    meals: [],
    calorie_goal: Number(carryOver.calorie_goal || preferences.daily_calorie_goal || 2000),
    mood: "",
    notes: "",
    workout: carryOver.workout || { type: "Chest", exercises: {} },
    snaps: [],
  };
}
export const initialLog = createEmptyDailyLog(todayISO);
// Loads today's working log from `dayflow_log`.
// Bug fixed here: `dayflow_log` used to be a single object that never rolled
// over, so yesterday's meals/snaps/mood stayed on "today" forever and every
// past date in the calendar fell back to the same data. Now, when the saved log
// belongs to an earlier date, it is archived (non-destructively) into
// `dayflow_daily_logs[date]` and a new empty log is started for today.
export function loadTodayLog() {
  const saved = readLocalJSON("dayflow_log", null);
  if (!saved || typeof saved !== "object") return initialLog;

  const savedDate = saved.date || todayISO;
  if (savedDate === todayISO) {
    return { ...initialLog, ...saved, date: todayISO };
  }

  const archive = readLocalJSON("dayflow_daily_logs", {});
  const archived = archive[savedDate];
  const archivedOk = writeLocalJSON("dayflow_daily_logs", {
    ...archive,
    [savedDate]: archived ? { ...archived, ...saved, snaps: mergeByUrl(archived.snaps, saved.snaps), meals: saved.meals || archived.meals || [] } : saved,
  });
  if (!archivedOk) {
    // Could not archive (storage full). Keep the old log as-is rather than
    // dropping it; the storage warning banner tells the user what happened.
    return { ...initialLog, ...saved };
  }

  const lastType = saved.workout?.type || "Chest";
  const template = readLocalJSON(`dayflow_workout_${lastType}`, {});
  const previousValues = Object.fromEntries(
    Object.entries(template || {}).map(([name, item]) => [name, { ...item, done: false }])
  );
  return createEmptyDailyLog(todayISO, {
    calorie_goal: saved.calorie_goal,
    workout: { type: lastType, exercises: previousValues },
  });
}

function mergeByUrl(first = [], second = []) {
  return [...(first || []), ...(second || [])].filter((item, index, all) => (
    item && all.findIndex((other) => other?.url === item.url) === index
  ));
}
// Consecutive days (ending today, or yesterday if nothing yet today) with at
// least one saved memory. Inspired by Snapchat/BeReal streaks.
export function getMemoryStreak(memorySnaps) {
  const dates = new Set(memorySnaps.map((snap) => recordLocalDate(snap)).filter(Boolean));
  const cursor = toLocalDate(todayISO);
  if (!dates.has(todayISO)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(toISODate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
// Memories from one week, one month, and one year ago ("On this day",
// inspired by Day One and Snapchat Memories). Only real saved memories.
export function getOnThisDayMemories(memorySnaps) {
  const today = toLocalDate(todayISO);
  const targets = [
    { label: "1 week ago", date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7) },
    { label: "1 month ago", date: new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()) },
    { label: "1 year ago", date: new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()) },
  ].map((target) => ({ ...target, iso: toISODate(target.date) }));
  return targets
    .map((target) => ({ ...target, snaps: memorySnaps.filter((snap) => recordLocalDate(snap) === target.iso) }))
    .filter((target) => target.snaps.length > 0);
}
// All saved memory snaps: today's working log plus every archived day.
export function getAllMemorySnaps(log) {
  const archive = readLocalJSON("dayflow_daily_logs", {});
  const archivedSnaps = Object.values(archive || {}).flatMap((day) => (day?.snaps || []).map((snap) => ({ date: day.date, ...snap })));
  return mergeByUrl(log.snaps || [], archivedSnaps)
    .filter((snap) => !snap.type || snap.type === "memory")
    .sort((a, b) => String(b.taken_at || b.date || "").localeCompare(String(a.taken_at || a.date || "")));
}

function recordsForDate(source, dateISO) {
  if (!source) return [];
  if (Array.isArray(source)) {
    return source.filter((item) => item && typeof item === "object" && recordLocalDate(item) === dateISO);
  }
  if (source[dateISO]) return Array.isArray(source[dateISO]) ? source[dateISO] : [source[dateISO]];
  return Object.values(source).flat().filter((item) => item && typeof item === "object" && recordLocalDate(item) === dateISO);
}
// Read every history source once (instead of once per calendar cell).
export function readHistorySources() {
  return {
    dailyLogs: readLocalJSON("dayflow_daily_logs", {}),
    sleepHistory: readLocalJSON("dayflow_sleep_history", []),
    periodLogs: readLocalJSON("dayflow_period_logs", {}),
    workoutHistory: readLocalJSON("dayflow_workout_history", []),
    spendingRecords: readLocalJSON("dayflow_spending", []),
    mealHistory: readLocalJSON("dayflow_meal_history", []),
    storedSnaps: [
      ...readLocalJSON("dayflow_snaps", []),
      ...readLocalJSON("dayflow_memories", []),
    ],
  };
}

function hasSleepData(sleep) {
  return Boolean(sleep && (sleep.wake_time || sleep.bedtime || Number(sleep.duration_minutes || 0) > 0));
}
export function buildDailyLogSummary(log, selectedDate, sources = readHistorySources()) {
  const { dailyLogs, sleepHistory, periodLogs, workoutHistory, spendingRecords, mealHistory, storedSnaps } = sources;
  const isToday = selectedDate === todayISO;
  // Today always comes from the live log; past dates come only from archives
  // and history, never from today's log.
  const savedLog = isToday ? {} : (recordsForDate(dailyLogs, selectedDate)[0] || {});

  const historySleep = recordsForDate(sleepHistory, selectedDate)[0];
  const sleepCandidate = isToday ? (log.sleep || historySleep) : (historySleep || savedLog.sleep);
  const sleep = hasSleepData(sleepCandidate) ? sleepCandidate : null;

  const archivedMeals = (savedLog.meals || []).filter((meal) => {
    const mealDate = recordLocalDate(meal);
    return !mealDate || mealDate === selectedDate;
  });
  const meals = isToday
    ? (log.meals || [])
    : (archivedMeals.length ? archivedMeals : recordsForDate(mealHistory, selectedDate));

  const todayWorkoutHasEntries = Object.keys(log.workout?.exercises || {}).length > 0;
  const workoutRecords = isToday
    ? [
        ...recordsForDate(workoutHistory, selectedDate),
        ...(todayWorkoutHasEntries && !recordsForDate(workoutHistory, selectedDate).length ? [{ date: todayISO, ...log.workout }] : []),
      ]
    : recordsForDate(workoutHistory, selectedDate);

  const allArchivedSnaps = Object.values(dailyLogs || {}).flatMap((day) => (day?.snaps || []).map((snap) => ({ date: day.date, ...snap })));
  const snaps = mergeByUrl(
    isToday ? (log.snaps || []) : [],
    [...allArchivedSnaps, ...storedSnaps].filter((snap) => recordLocalDate(snap) === selectedDate)
  );
  const spending = recordsForDate(spendingRecords, selectedDate);
  const cycle = periodLogs[selectedDate] || savedLog.cycle;
  const mood = isToday ? log.mood : savedLog.mood;
  const notes = isToday ? log.notes : savedLog.notes;
  const totals = meals.reduce((sum, meal) => ({
    calories: sum.calories + Number(meal.calories || 0),
    protein: sum.protein + Number(meal.protein_g || 0),
    sugar: sum.sugar + Number(meal.sugar_g || 0),
  }), { calories: 0, protein: 0, sugar: 0 });

  return {
    date: selectedDate,
    sleep,
    wakeUp: sleep?.wake_time || savedLog.wake_up_time || (isToday ? log.wake_up_time : ""),
    sleepQuality: sleep?.sleep_quality || savedLog.sleep_quality || (isToday ? log.sleep_quality : ""),
    mood,
    notes,
    meals,
    totals,
    workoutRecords,
    snaps,
    cycle,
    spending,
    hasData: Boolean(sleep || meals.length || workoutRecords.length || snaps.length || cycle || spending.length || mood || notes),
  };
}
