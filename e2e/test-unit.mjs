// Node unit tests for merge-safe backup/restore and daily rollover.
// No browser and no live backend.
import { webcrypto } from "node:crypto";
if (!globalThis.crypto?.getRandomValues) globalThis.crypto = webcrypto;

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(String(k), String(v)); }
  removeItem(k) { this.map.delete(String(k)); }
  clear() { this.map.clear(); }
}
globalThis.localStorage = new MemoryStorage();

const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "PASS" : "FAIL"} ${name} ${extra}`); };

const { localDateISO } = await import("../src/lib/storage.js");
const { loadTodayLog } = await import("../src/lib/dailyLog.js");
const {
  mergeLogs, mergeIncomingDay, isSparseLog, logWeight, shouldSkipCloudDailyUpsert,
  applyBackupPackage, buildBackupPackage, parseBackupPackage, BACKUP_FORMAT,
} = await import("../src/lib/backup.js");

const TODAY = localDateISO();
const yesterday = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateISO(d);
})();

{
  const template = { Press: { done: true, weight: 30, reps: 8, sets: [{ done: true, weight: 30, reps: 8 }, { done: true, weight: 32, reps: 6 }] } };
  localStorage.setItem("dayflow_workout_Chest", JSON.stringify(template));
  localStorage.setItem("dayflow_log", JSON.stringify({ date: yesterday, meals: [{ name: "Yesterday ramen" }], snaps: [], workout: { type: "Chest" } }));
  const next = loadTodayLog();
  ok("U1 rollover archives yesterday", JSON.parse(localStorage.getItem("dayflow_daily_logs"))[yesterday].meals[0].name === "Yesterday ramen");
  ok("U1 new day log is today", next.date === TODAY);
  ok("U1 carried weight retained", next.workout.exercises.Press.weight === 30 && next.workout.exercises.Press.sets[1].weight === 32);
  ok("U1 exercise.done cleared", next.workout.exercises.Press.done === false);
  ok("U1 sets[].done cleared", next.workout.exercises.Press.sets.every((set) => set.done === false));
}

{
  const rich = { date: TODAY, notes: "irreplaceable diary", meals: [{ id: "m1", name: "Soup", date: TODAY }], snaps: [{ id: "s1", url: "xlife-photo:p1", caption: "Hi" }], mood: "happy" };
  const blank = { date: TODAY, notes: "", meals: [], snaps: [], workout: { type: "Chest", exercises: {} } };
  ok("U2 blank log is sparse", isSparseLog(blank) && logWeight(rich) > logWeight(blank));
  const merged = mergeLogs(blank, rich);
  ok("U2 merge fills blank local from richer incoming", merged.notes === "irreplaceable diary" && merged.meals.length === 1 && merged.snaps.length === 1);
  const kept = mergeLogs(rich, blank);
  ok("U2 merge never lets blank incoming overwrite richer local", kept.notes === "irreplaceable diary" && kept.meals.length === 1 && kept.mood === "happy");
  ok("U2 skip cloud upsert when local is blank and cloud is richer", shouldSkipCloudDailyUpsert(blank, rich) === true);
  ok("U2 do not skip upsert of a rich local log", shouldSkipCloudDailyUpsert(rich, blank) === false);
  const today = mergeIncomingDay(blank, rich);
  ok("U2 mergeIncomingDay reports a change for a blank same-day log", today.changed && today.value.notes === "irreplaceable diary");
  const noChange = mergeIncomingDay(rich, blank);
  ok("U2 mergeIncomingDay does not downgrade a rich same-day log", noChange.changed === false && noChange.value.notes === "irreplaceable diary");
}

{
  localStorage.clear();
  localStorage.setItem("dayflow_user", JSON.stringify({ id: "local", name: "Leo", email: "leo@example.invalid" }));
  localStorage.setItem("dayflow_log", JSON.stringify({ date: TODAY, notes: "", meals: [], snaps: [] }));
  localStorage.setItem("xlife_my_foods", JSON.stringify([{ id: "keep-me", name: "Local oats" }]));
  const pkg = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: "2026-11-18T00:00:00.000Z",
    keys: {
      dayflow_user: { encoding: "json", value: { id: "other", name: "Other", email: "other@example.invalid" } },
      dayflow_log: { encoding: "json", value: { date: TODAY, notes: "cloud diary", meals: [{ id: "m2", name: "Tea", date: TODAY }], snaps: [] } },
      xlife_my_foods: { encoding: "json", value: [{ id: "new-food", name: "Backup soup" }] },
      xlife_couple: { encoding: "json", value: { anniversary: "2020-01-01", countdowns: [{ id: "c1", title: "Trip", date: "2026-12-01" }] } },
      dayflow_active_session: { encoding: "text", value: "true" },
    },
    photos: {},
  };
  const report = await applyBackupPackage(pkg);
  const user = JSON.parse(localStorage.getItem("dayflow_user"));
  const log = JSON.parse(localStorage.getItem("dayflow_log"));
  const foods = JSON.parse(localStorage.getItem("xlife_my_foods"));
  const couple = JSON.parse(localStorage.getItem("xlife_couple"));
  ok("U3 restore keeps the existing local profile", user.email === "leo@example.invalid" && user.id === "local");
  ok("U3 blank same-day log receives richer backup notes and meals", log.notes === "cloud diary" && log.meals.some((meal) => meal.id === "m2"));
  ok("U3 My foods are added, not replaced", foods.some((food) => food.id === "keep-me") && foods.some((food) => food.id === "new-food"));
  ok("U3 Together / countdowns restored", couple.anniversary === "2020-01-01" && couple.countdowns[0].title === "Trip");
  ok("U3 restore report counts merges", report.updatedKeys >= 1 && report.addedKeys >= 2);
}

{
  localStorage.clear();
  localStorage.setItem("dayflow_user", JSON.stringify({ id: "u", name: "T" }));
  localStorage.setItem("xlife_couple", JSON.stringify({ anniversary: "2019-05-05", countdowns: [] }));
  const pkg = await buildBackupPackage();
  ok("U4 package is versioned", pkg.format === BACKUP_FORMAT && pkg.version === 1 && pkg.keys.xlife_couple);
  const parsed = parseBackupPackage(JSON.stringify(pkg));
  ok("U4 package round-trips", parsed.keys.xlife_couple.value.anniversary === "2019-05-05");
  let threw = false;
  try { parseBackupPackage({ format: "nope", version: 1, keys: {} }); } catch { threw = true; }
  ok("U4 rejects a foreign file", threw);
}

console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
