import { chromium } from "playwright-core";
const IMG = new globalThis.URL("../src/assets/hero.png", import.meta.url).pathname;
const URL = process.env.XLIFE_URL || "http://localhost:4173/";
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "PASS" : "FAIL"} ${name} ${extra}`); };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox"] });

async function dismissWake(page) {
  const btn = page.getByRole("button", { name: "Not yet" });
  if (await btn.count() && await btn.isVisible()) await btn.click();
}
async function newPage(colorScheme = "light") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  return { ctx, page, errors };
}

// 1. Fresh onboarding -> lands on Snaps
{
  const { page, errors, ctx } = await newPage();
  await page.goto(URL); await page.locator("h1").first().waitFor();
  ok("welcome shows Xlife", await page.getByRole("heading", { name: "Xlife" }).isVisible());
  await page.getByRole("button", { name: "Create Account" }).first().click();
  await page.getByPlaceholder("Name").fill("Leo Test");
  await page.getByPlaceholder("Email").fill("leo@example.com");
  await page.getByPlaceholder("Password").fill("pw-not-stored");
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(400);
  const title = await page.locator("header h1").textContent();
  ok("opens on Snaps after onboarding", title === "Snaps", `title=${title}`);
  const scroll = await page.evaluate(() => [document.scrollingElement.scrollHeight, window.innerHeight]);
  ok("snaps camera screen fits viewport (no scroll)", scroll[0] <= scroll[1] + 1, JSON.stringify(scroll));
  const pw = await page.evaluate(() => JSON.stringify(localStorage).includes("pw-not-stored"));
  ok("password not stored in localStorage", !pw);
  await page.screenshot({ path: "/tmp/xlife-01-snaps.png" });

  // 2. FIRST capture shows the review screen
  await page.locator('input[type=file]:not([capture])').setInputFiles(IMG);
  await page.getByRole("button", { name: "Save Memory" }).waitFor({ timeout: 5000 });
  ok("first capture shows 3 options", await page.getByRole("button", { name: "Mark Food" }).isVisible() && await page.getByRole("button", { name: "Track Spending" }).isVisible());
  const pending = await page.evaluate(() => (JSON.parse(localStorage.getItem("xlife_pending_snap")) || {}).url?.slice(0, 15));
  ok("pending snap persisted as photo ref", pending.startsWith("xlife-photo:"), pending);
  await page.screenshot({ path: "/tmp/xlife-02-review.png" });

  // 3. Reload mid-review -> review still there
  await page.reload(); await page.locator("h1").first().waitFor();
  await page.waitForTimeout(500);
  ok("review survives reload", await page.getByRole("button", { name: "Save Memory" }).isVisible());

  await page.getByPlaceholder("Add a caption").fill("Beach day");
  await page.getByRole("button", { name: "Save as Memory" }).click();
  ok("memory saved message", await page.getByText("Memory saved").isVisible());

  // 4. Mark food
  await page.locator('input[type=file]:not([capture])').setInputFiles(IMG);
  await page.getByRole("button", { name: "Mark Food" }).click();
  await page.getByPlaceholder("Food name").fill("Char siu rice");
  await page.getByPlaceholder("Calories").fill("650");
  await page.getByRole("button", { name: "Save meal" }).click();
  ok("meal saved", await page.getByText("Meal saved: Char siu rice").isVisible());

  // 5. Spending
  await page.locator('input[type=file]:not([capture])').setInputFiles(IMG);
  await page.getByRole("button", { name: "Track Spending" }).click();
  await page.getByPlaceholder("Item / what I bought").fill("Coffee");
  await page.getByPlaceholder("Amount spent").fill("38");
  await page.getByRole("button", { name: "Save spending" }).click();
  ok("spending saved", await page.getByText("You spent $38.00 on Coffee").isVisible());

  // Home shows the snap + meal
  await page.getByRole("button", { name: "Home" }).click();
  await page.waitForTimeout(300);
  { const m = new Date().getHours() * 60 + new Date().getMinutes(); if (m >= 330 && m < 690) ok("wake prompt shown on Home in the morning", await page.getByText("Are you awake?").count() > 0); }
  await dismissWake(page);
  const snapSrc = await page.locator('img[alt="Beach day"]').first().getAttribute("src");
  ok("home shows saved memory (data URL)", snapSrc?.startsWith("data:image/jpeg"));
  ok("home shows meal", await page.getByText("Char siu rice").first().isVisible());
  const demo = await page.getByText("Greek yogurt bowl").count();
  ok("no fabricated demo meals for new user", demo === 0);

  // 6. Day rollover: pretend the saved log is from yesterday
  await page.waitForTimeout(400);
  const today = await page.evaluate(() => JSON.parse(localStorage.getItem("dayflow_log")).date);
  const y = new Date(today + "T00:00:00"); y.setDate(y.getDate() - 1);
  const yISO = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,"0")}-${String(y.getDate()).padStart(2,"0")}`;
  await page.evaluate((yISO) => {
    const log = JSON.parse(localStorage.getItem("dayflow_log"));
    log.date = yISO; log.mood = "tired"; log.notes = "yesterday note";
    log.meals = log.meals.map((m) => ({ ...m, date: yISO, createdAt: yISO + "T12:00:00" }));
    log.snaps = log.snaps.map((s) => ({ ...s, date: yISO }));
    localStorage.setItem("dayflow_log", JSON.stringify(log));
  }, yISO);
  await page.reload(); await page.locator("h1").first().waitFor();
  await page.getByRole("button", { name: "Home" }).click();
  await page.waitForTimeout(300);
  await dismissWake(page);
  const state = await page.evaluate((yISO) => {
    const log = JSON.parse(localStorage.getItem("dayflow_log"));
    const arch = JSON.parse(localStorage.getItem("dayflow_daily_logs") || "{}");
    return { date: log.date, meals: log.meals.length, notes: log.notes, archived: Boolean(arch[yISO]), archMeals: arch[yISO]?.meals?.length, archNotes: arch[yISO]?.notes };
  }, yISO);
  ok("rollover: today's log fresh", state.date === today && state.meals === 0 && state.notes === "", JSON.stringify(state));
  ok("rollover: yesterday archived", state.archived && state.archMeals === 1 && state.archNotes === "yesterday note");
  ok("today's summary does not show yesterday's meal", (await page.locator("text=Char siu rice").count()) === 0);
  // select yesterday in day calendar
  const dayNum = String(y.getDate());
  if (y.getMonth() !== new Date(today + "T00:00:00").getMonth()) await page.getByRole("button", { name: "‹" }).first().click();
  const cal = page.locator("div.grid-cols-7.gap-1.text-center.text-sm button");
  await cal.filter({ hasText: new RegExp(`^${dayNum}$`) }).first().click();
  await page.waitForTimeout(200);
  ok("history: yesterday shows its meal", await page.getByText("Char siu rice").first().isVisible());
  ok("history: yesterday shows its note", await page.getByText("yesterday note").first().isVisible());
  // pick an older date with no data
  const other = y.getDate() > 3 ? String(y.getDate() - 2) : String(y.getDate() + 3);
  await cal.filter({ hasText: new RegExp(`^${other}$`) }).first().click();
  ok("history: empty date shows no logs", await page.getByText("No logs for this day yet.").isVisible());

  // Memories in Fun include archived snaps
  await page.getByRole("button", { name: "Fun" }).click();
  await page.getByRole("button", { name: "Memories" }).click();
  ok("fun memories include archived memory", await page.getByText("Beach day").first().isVisible());
  ok("no page errors (flow 1)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 7. Legacy user from old build (single never-rolling dayflow_log)
{
  const { page, errors, ctx } = await newPage("dark");
  await page.goto(URL); await page.locator("h1").first().waitFor();
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("dayflow_user", JSON.stringify({ id: "u1", name: "Legacy User", email: "a@b.c" }));
    localStorage.setItem("dayflow_active_session", "true");
    localStorage.setItem("dayflow_log", JSON.stringify({
      date: "2026-05-19", wake_up_time: "08:15", sleep_quality: "good", mood: "happy", notes: "old", calorie_goal: 1800,
      sleep: { date: "2026-05-19", bedtime: "23:45", wake_time: "08:15", duration_minutes: 510, sleep_stages: { rem: 92 } },
      meals: [{ type: "lunch", name: "Old lunch", calories: 500, time: "12:00" }],
      workout: { type: "Leg", exercises: { Squat: { done: true, weight: "100", reps: "5" } } },
      snaps: [{ url: "data:image/png;base64,iVBORw0KGgo=", caption: "Old memory", date: "2026-05-20", type: "memory" }],
    }));
    localStorage.setItem("dayflow_workout_Leg", JSON.stringify({ Squat: { done: true, weight: "100", reps: "5" } }));
    localStorage.setItem("dayflow_restaurants", JSON.stringify([{ name: "My place", cuisine: "Thai", menu_items: [] }]));
  });
  await page.reload(); await page.locator("h1").first().waitFor();
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => ({ log: JSON.parse(localStorage.getItem("dayflow_log")), arch: JSON.parse(localStorage.getItem("dayflow_daily_logs") || "{}"), keys: Object.keys(localStorage).sort() }));
  ok("legacy: old log archived under its date", Boolean(st.arch["2026-05-19"]) && st.arch["2026-05-19"].meals.length === 1);
  ok("legacy: calorie goal + workout carried, done reset", st.log.calorie_goal === 1800 && st.log.workout.type === "Leg" && st.log.workout.exercises.Squat.weight === "100" && st.log.workout.exercises.Squat.done === false, JSON.stringify(st.log.workout));
  ok("legacy: restaurants untouched", JSON.parse(await page.evaluate(() => localStorage.getItem("dayflow_restaurants")))[0].name === "My place");
  ok("legacy: opens on Snaps", (await page.locator("header h1").textContent()) === "Snaps");
  await page.getByRole("button", { name: "Fun" }).click();
  await page.getByRole("button", { name: "Memories" }).click();
  ok("legacy: old memory still visible", await page.getByText("Old memory").isVisible());

  // 8. Dark-mode input contrast on Meals
  await page.getByRole("button", { name: "Meals" }).click();
  const colors = await page.getByPlaceholder("Meal name").evaluate((el) => { const cs = getComputedStyle(el); return [cs.color, cs.backgroundColor]; });
  ok("dark-mode .field has light text on dark bg", colors[0] !== colors[1] && /250|244|228/.test(colors[0]) && !/244, 244, 245/.test(colors[1]), JSON.stringify(colors));
  await page.screenshot({ path: "/tmp/xlife-03-dark-meals.png" });
  await page.getByRole("button", { name: "Health" }).click();
  await page.getByRole("button", { name: "Wellness" }).click();
  ok("wellness shows empty state instead of mock stats", await page.getByText("No cycle or mood logs yet").isVisible() || await page.getByText("Mood by phase").isVisible());
  ok("no page errors (legacy)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 10. Extra fixes (pass 2) + iOS 15.0 without crypto.randomUUID
{
  const { page, errors, ctx } = await newPage();
  await ctx.addInitScript(() => { try { Object.defineProperty(Crypto.prototype, "randomUUID", { value: undefined, configurable: true }); } catch (e) { void e; } });
  await page.goto(URL); await page.locator("h1").first().waitFor();
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("dayflow_user", JSON.stringify({ id: "u1", name: "P2", email: "p@p.p" })); });
  await page.reload(); await page.locator("h1").first().waitFor();
  ok("randomUUID unavailable in this context", await page.evaluate(() => typeof crypto.randomUUID !== "function"));
  // spending clears the review (no duplicate)
  await page.locator('input[type=file]:not([capture])').setInputFiles(IMG);
  await page.getByRole("button", { name: "Track Spending" }).click();
  await page.getByPlaceholder("Item / what I bought").fill("Tea");
  await page.getByPlaceholder("Amount spent").fill("12");
  await page.getByRole("button", { name: "Save spending" }).click();
  ok("spending saves without randomUUID and clears review", await page.getByText("You spent $12.00 on Tea").isVisible() && (await page.getByRole("button", { name: "Save spending" }).count()) === 0);
  ok("one spending record", await page.evaluate(() => JSON.parse(localStorage.getItem("dayflow_spending")).length) === 1);
  // Meals: suggestion Add to Meal logs directly
  await page.getByRole("button", { name: "Meals" }).click();
  await page.getByRole("button", { name: "Add to Meal" }).first().click();
  ok("Add to Meal logs a meal", await page.getByText(/^Added .* to today's/).isVisible());
  await page.waitForTimeout(400);
  const counts = await page.evaluate(() => [JSON.parse(localStorage.getItem("dayflow_log")).meals.length, JSON.parse(localStorage.getItem("dayflow_meal_history")).length]);
  ok("meal in today's log and history once", counts[0] === 1 && counts[1] === 1, JSON.stringify(counts));
  await page.getByRole("button", { name: /^Remove / }).first().click();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => [JSON.parse(localStorage.getItem("dayflow_log")).meals.length, JSON.parse(localStorage.getItem("dayflow_meal_history")).length]);
  ok("remove meal also removes history copy", after[0] === 0 && after[1] === 0, JSON.stringify(after));
  // Gym: done requires an exercise, summary, dedupe
  await page.getByRole("button", { name: "Fun" }).click();
  await page.getByRole("button", { name: "Done Workout" }).click();
  ok("done workout requires a ticked exercise", await page.getByText("Tick at least one set").isVisible());
  await page.getByPlaceholder("Weight").first().fill("40");
  await page.getByPlaceholder("Reps").first().fill("10");
  await page.getByRole("button", { name: /^Mark .* set 1 done$/ }).first().click();
  await page.getByRole("button", { name: "Done Workout" }).click();
  ok("workout complete summary", await page.getByText("Workout Complete 💪").isVisible() && await page.getByText("400").isVisible());
  await page.getByRole("button", { name: "Edit workout" }).click();
  await page.getByRole("button", { name: "Done Workout" }).click();
  ok("no duplicate workout history", await page.evaluate(() => JSON.parse(localStorage.getItem("dayflow_workout_history")).length) === 1);
  // Plans: empty optional middle choice -> choosing C works
  await page.getByRole("button", { name: "Plans" }).click();
  await page.getByPlaceholder("Plan title").fill("Sat date");
  await page.getByPlaceholder("Choice A").fill("Movie");
  await page.getByPlaceholder("Add another option (optional)").fill("Climbing");
  await page.getByRole("button", { name: "Send to Partner" }).click();
  await page.getByRole("button", { name: "Confirm Partner Choices" }).click();
  ok("confirm requires answers", await page.getByText("Pick an option for every question").isVisible());
  await page.getByRole("button", { name: /C\. Climbing/ }).click();
  await page.getByRole("button", { name: "Confirm Partner Choices" }).click();
  ok("final plan uses choice C", await page.getByText("What should we do first?: Climbing").isVisible());
  // Cycle: mark then unmark
  await page.getByRole("button", { name: "Health" }).click();
  ok("cycle shows estimate label", await page.getByText("(estimate)").isVisible());
  await page.getByRole("button", { name: "Mark as Period" }).click();
  ok("marked as period", await page.getByRole("button", { name: "Marked as Period ✓" }).isVisible());
  await page.getByRole("button", { name: "Marked as Period ✓" }).click();
  ok("period mark can be undone", await page.getByRole("button", { name: "Mark as Period" }).isVisible() && await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("dayflow_period_logs") || "{}")).length) === 0);
  // Home weekly nutrition label honest
  await page.getByRole("button", { name: "Home" }).click();
  await dismissWake(page);
  ok("weekly nutrition empty-state text", await page.getByText("Log meals to see your 7-day averages.").isVisible());
  // Notes debounce persists
  await page.getByPlaceholder("How was your day?").fill("typed note");
  await page.waitForTimeout(500);
  ok("notes persisted after debounce", await page.evaluate(() => JSON.parse(localStorage.getItem("dayflow_log")).notes) === "typed note");
  await page.getByPlaceholder("How was your day?").fill("typed note 2");
  await page.reload(); await page.locator("h1").first().waitFor();
  await page.waitForTimeout(300);
  ok("notes flushed on reload", await page.evaluate(() => JSON.parse(localStorage.getItem("dayflow_log")).notes) === "typed note 2");
  // Corrupted storage doesn't crash
  await page.evaluate(() => { localStorage.setItem("dayflow_restaurants", "{bad json"); localStorage.setItem("dayflow_fun_plans", "nope"); });
  await page.reload(); await page.locator("h1").first().waitFor();
  await page.getByRole("button", { name: "Meals" }).click();
  await page.getByRole("button", { name: "Fun" }).click();
  ok("corrupted restaurants/plans JSON does not crash", await page.getByText("Stay connected through daily moments.").isVisible());
  ok("no page errors (pass 2)", errors.length === 0, errors.join(" | "));
  await page.screenshot({ path: "/tmp/xlife-04-fun.png", fullPage: false });
  await ctx.close();
}

// 11. On this day + streak
{
  const { page, errors, ctx } = await newPage();
  await page.goto(URL); await page.locator("h1").first().waitFor();
  await page.evaluate(() => {
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const t = new Date(); const ago = (n) => { const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - n); return iso(d); };
    const px = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    localStorage.clear();
    localStorage.setItem("dayflow_user", JSON.stringify({ id: "u1", name: "S", email: "s@s.s" }));
    localStorage.setItem("dayflow_daily_logs", JSON.stringify({
      [ago(7)]: { date: ago(7), snaps: [{ url: px + "#a", caption: "Week ago pic", date: ago(7), type: "memory" }] },
      [ago(1)]: { date: ago(1), snaps: [{ url: px + "#b", caption: "Yday", date: ago(1), type: "memory" }] },
      [ago(2)]: { date: ago(2), snaps: [{ url: px + "#c", caption: "2d", date: ago(2), type: "memory" }] },
    }));
    localStorage.setItem("dayflow_log", JSON.stringify({ date: iso(t), meals: [], snaps: [{ url: px + "#d", caption: "Today", date: iso(t), type: "memory" }] }));
  });
  await page.reload(); await page.locator("h1").first().waitFor();
  ok("streak shown on Snaps", await page.getByText("3-day streak · 1 today").isVisible());
  await page.getByRole("button", { name: "Home" }).click();
  await dismissWake(page);
  ok("On this day shows 1 week ago memory", await page.getByText("On this day").isVisible() && await page.getByAltText("Week ago pic").isVisible());
  ok("no page errors (on this day)", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// 9. Storage quota -> warning banner, no crash
{
  const { page, errors, ctx } = await newPage();
  await page.goto(URL); await page.locator("h1").first().waitFor();
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("dayflow_user", JSON.stringify({ id: "u1", name: "Q", email: "q@q.q" }));
  });
  await page.reload(); await page.locator("h1").first().waitFor();
  await page.evaluate(() => { const orig = Storage.prototype.setItem; window.__orig = orig; Storage.prototype.setItem = function (k, v) { if (k === "dayflow_log") { throw new DOMException("quota", "QuotaExceededError"); } return orig.call(this, k, v); }; });
  await page.locator('input[type=file]:not([capture])').setInputFiles(IMG);
  await page.getByRole("button", { name: "Save as Memory" }).click();
  await page.waitForTimeout(300);
  ok("quota error shows banner instead of crashing", await page.getByText("Storage is full").isVisible());
  ok("app still rendered after quota error", await page.locator("header h1").isVisible());
  await ctx.close();
}

await browser.close();
console.log(results.join("\n"));
