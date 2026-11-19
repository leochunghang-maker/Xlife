// Pass 3 reliability: confirmed snap saves, offline backup/restore, blank same-day merge.
import { browser, ok, results, newPage, URL, IMG } from "./harness.mjs";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TODAY = iso(new Date());

async function seeded(page, extra = {}) {
  await page.goto(URL); await page.locator("h1").first().waitFor();
  await page.evaluate(([extra, today]) => {
    localStorage.clear();
    localStorage.setItem("dayflow_user", JSON.stringify({ id: "u1", name: "T", email: "t@t.t" }));
    localStorage.setItem("xlife_wake_prompt_state", JSON.stringify({ date: today, snoozes: 0, skipped: true }));
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }, [extra, TODAY]);
  await page.reload(); await page.locator("h1").first().waitFor();
  await page.waitForTimeout(300);
}

{
  const { page, errors, ctx } = await newPage();
  await seeded(page);
  await page.locator('input[type=file]:not([capture])').setInputFiles(IMG);
  await page.getByRole("button", { name: "Save Memory" }).click();
  await page.getByRole("button", { name: "Save as Memory" }).click();
  await page.getByText("Memory saved").waitFor();
  const stored = await page.evaluate(() => {
    const log = JSON.parse(localStorage.getItem("dayflow_log"));
    return { n: log.snaps.length, ref: log.snaps[0]?.url, pending: localStorage.getItem("xlife_pending_snap") };
  });
  ok("R1 successful save persists a snap", stored.n === 1 && !stored.ref?.startsWith("blob:"), JSON.stringify(stored));
  ok("R1 successful save clears pending", !stored.pending);
  ok("R1 no errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

{
  const { page, errors, ctx } = await newPage();
  await seeded(page, {
    dayflow_log: { date: TODAY, notes: "", meals: [], snaps: [] },
    xlife_my_foods: [{ id: "f1", name: "Local oats" }],
    xlife_couple: { anniversary: "2018-06-01", countdowns: [{ id: "c1", title: "Anniversary", date: "2027-06-01" }] },
  });
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  ok("R2 backup card is in Settings", await page.getByTestId("offline-backup").isVisible());
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export backup" }).click(),
  ]);
  const path = await download.path();
  const fs = await import("node:fs");
  const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
  ok("R2 export is a versioned Xlife backup", pkg.format === "xlife-backup" && pkg.version === 1);
  ok("R2 export includes My foods and Together", Boolean(pkg.keys.xlife_my_foods && pkg.keys.xlife_couple));
  pkg.keys.dayflow_log = { encoding: "json", value: { date: TODAY, notes: "diary from backup", meals: [{ id: "bm1", name: "Backup tea", date: TODAY }], snaps: [] } };
  pkg.keys.xlife_my_foods = { encoding: "json", value: [...(pkg.keys.xlife_my_foods.value || []), { id: "f2", name: "Backup soup" }] };
  const restorePath = "/tmp/xlife-restore-test.json";
  fs.writeFileSync(restorePath, JSON.stringify(pkg));
  await page.locator('input[aria-label="Choose an Xlife backup file"]').setInputFiles(restorePath);
  await page.waitForTimeout(1200);
  await page.locator("h1").first().waitFor();
  const after = await page.evaluate(() => ({
    notes: JSON.parse(localStorage.getItem("dayflow_log") || "{}").notes,
    meals: (JSON.parse(localStorage.getItem("dayflow_log") || "{}").meals || []).map((m) => m.name),
    foods: (JSON.parse(localStorage.getItem("xlife_my_foods") || "[]")).map((f) => f.name),
    anniversary: JSON.parse(localStorage.getItem("xlife_couple") || "{}").anniversary,
  }));
  ok("R2 restore fills a blank same-day log", after.notes === "diary from backup" && after.meals.includes("Backup tea"), JSON.stringify(after));
  ok("R2 restore adds My foods without dropping local ones", after.foods.includes("Local oats") && after.foods.includes("Backup soup"), JSON.stringify(after.foods));
  ok("R2 Together anniversary kept", after.anniversary === "2018-06-01");
  ok("R2 no errors", errors.filter((e) => !e.includes("Failed to load resource")).length === 0, errors.join(" | "));
  await ctx.close();
}

{
  const { page, ctx } = await newPage();
  const y = iso(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1));
  await seeded(page, {
    dayflow_log: { date: y, meals: [], snaps: [], workout: { type: "Chest" } },
    dayflow_workout_Chest: { "Incline DB Press": { done: true, weight: "30", reps: "8", sets: [{ weight: "30", reps: "8", done: true }] } },
  });
  const state = await page.evaluate(() => {
    const log = JSON.parse(localStorage.getItem("dayflow_log") || "{}");
    const sets = log.workout?.exercises?.["Incline DB Press"]?.sets || [];
    return { date: log.date, done: log.workout?.exercises?.["Incline DB Press"]?.done, setDone: sets[0]?.done, weight: sets[0]?.weight };
  });
  ok("R3 rollover is today", state.date === TODAY, JSON.stringify(state));
  ok("R3 yesterday's set checkmarks are cleared", state.done === false && state.setDone === false && state.weight === "30", JSON.stringify(state));
  await ctx.close();
}

await browser.close();
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
