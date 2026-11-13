import { browser, ok, results, dismissWake, newPage, URL, IMG } from "./harness.mjs";
const PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const TODAY = iso(new Date());
async function seeded(page, extra = {}) {
  await page.goto(URL); await page.locator("h1").first().waitFor();
  await page.evaluate(([extra]) => {
    localStorage.clear();
    localStorage.setItem("dayflow_user", JSON.stringify({ id: "u1", name: "T", email: "t@t.t" }));
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  }, [extra]);
  await page.reload(); await page.locator("h1").first().waitFor();
  await page.waitForTimeout(300);
}

// P1. Legacy inline photos migrate out of localStorage, still render
{
  const { page, errors, ctx } = await newPage();
  await seeded(page, { dayflow_log: { date: TODAY, meals: [], snaps: [{ url: PX, caption: "Legacy pic", date: TODAY, type: "memory" }] } });
  const ls = await page.evaluate(() => JSON.stringify(localStorage));
  ok("P1 inline photo removed from localStorage", !ls.includes("data:image/"));
  ok("P1 reference stored", ls.includes("xlife-photo:"));
  await page.getByRole("button", { name: "Home" }).click();
  await dismissWake(page);
  await page.waitForTimeout(300);
  ok("P1 migrated photo renders", await page.locator('img[alt="Legacy pic"]').count() > 0);
  // New capture goes to the photo store too
  await page.getByRole("button", { name: "Snaps" }).click();
  await page.locator('input[type=file]:not([capture])').setInputFiles(IMG);
  await page.getByRole("button", { name: "Save Memory" }).click();
  await page.getByRole("button", { name: "Save as Memory" }).click();
  await page.waitForTimeout(300);
  ok("P1 new capture not inline", !(await page.evaluate(() => JSON.stringify(localStorage))).includes("data:image/"));
  ok("P1 no errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// A1. Create Account does not overwrite an existing profile
{
  const { page, errors, ctx } = await newPage();
  await seeded(page, { dayflow_active_session: "false" });
  await page.getByRole("button", { name: "Create Account" }).first().click();
  ok("A1 existing profile warning shown", await page.getByText("is already saved on this phone").isVisible());
  await page.getByPlaceholder("Name").fill("Other");
  await page.getByPlaceholder("Email").fill("other@x.y");
  await page.getByPlaceholder("Password").fill("pw");
  await page.getByRole("button", { name: "Create Account" }).last().click();
  const u = await page.evaluate(() => JSON.parse(localStorage.getItem("dayflow_user")));
  ok("A1 profile not overwritten", u.email === "t@t.t", u.email);
  await page.getByRole("button", { name: "Sign in instead" }).click();
  ok("A1 sign-in prefilled", (await page.getByPlaceholder("Email").inputValue()) === "t@t.t");
  ok("A1 no errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// A2. Wake prompt: uses preferred wake time; snooze cap + skip today
{
  const { page, ctx } = await newPage();
  const now = new Date(); const hh = String(now.getHours()).padStart(2, "0"); const mm = String(now.getMinutes()).padStart(2, "0");
  await seeded(page, { dayflow_user_preferences: { preferred_wake_time: `${hh}:${mm}` } });
  await page.getByRole("button", { name: "Home" }).click();
  ok("A2 prompt uses preferred wake time window", await page.getByText("Are you awake?").isVisible());
  await page.getByRole("button", { name: "Not yet" }).click();
  // pretend the 1h snooze expired twice
  await page.evaluate(() => localStorage.setItem("dayflow_wake_prompt_snoozed_at", new Date(Date.now() - 2 * 36e5).toISOString()));
  await page.getByRole("button", { name: "Snaps" }).click(); await page.getByRole("button", { name: "Home" }).click();
  ok("A2 prompt returns after snooze", await page.getByText("Are you awake?").isVisible());
  await page.getByRole("button", { name: "Not yet" }).click();
  await page.evaluate(() => localStorage.setItem("dayflow_wake_prompt_snoozed_at", new Date(Date.now() - 2 * 36e5).toISOString()));
  await page.getByRole("button", { name: "Snaps" }).click(); await page.getByRole("button", { name: "Home" }).click();
  ok("A2 prompt stops after 2 snoozes", !(await page.getByText("Are you awake?").isVisible()));
  const far = (now.getHours() + 12) % 24;
  await seeded(page, { dayflow_user_preferences: { preferred_wake_time: `${String(far).padStart(2, "0")}:00` }, dayflow_last_active_at: new Date().toISOString() });
  await page.getByRole("button", { name: "Home" }).click();
  ok("A2 no prompt far from preferred wake time", !(await page.getByText("Are you awake?").isVisible()));
  await ctx.close();
}

// A3. Sample restaurants: labelled, seeded once, not re-seeded after delete
{
  const { page, errors, ctx } = await newPage();
  await seeded(page, {});
  await page.getByRole("button", { name: "Meals" }).click();
  const tabs = page.getByRole("button", { name: /Restaurants|Browse|Catalog/ });
  if (await tabs.count()) await tabs.first().click();
  ok("A3 sample badge shown", await page.getByText("Sample", { exact: true }).first().isVisible().catch(() => false));
  const del = page.getByRole("button", { name: /^Delete (Daily Green Bowl|Sunny Cafe)/ });
  const n = await del.count();
  for (let i = 0; i < n; i++) await page.getByRole("button", { name: /^Delete (Daily Green Bowl|Sunny Cafe)/ }).first().click();
  await page.reload(); await page.locator("h1").first().waitFor();
  const r = await page.evaluate(() => JSON.parse(localStorage.getItem("dayflow_restaurants")));
  ok("A3 samples not re-seeded after delete", n === 2 && r.length === 0, `deleted=${n} left=${r.length}`);
  await page.evaluate(() => localStorage.removeItem("dayflow_restaurants"));
  await page.reload(); await page.locator("h1").first().waitFor();
  await page.getByRole("button", { name: "Meals" }).click();
  ok("A3 not re-seeded even if key missing", (await page.evaluate(() => JSON.parse(localStorage.getItem("dayflow_restaurants")))).length === 0);
  ok("A3 no errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// A4. Partner demo persists across restart
{
  const { page, ctx } = await newPage();
  await seeded(page, {});
  await page.getByRole("button", { name: "Fun" }).click();
  const us = page.getByRole("button", { name: /Us/ });
  if (await us.count()) await us.first().click();
  await page.getByRole("button", { name: "Preview with demo partner" }).click();
  await page.reload(); await page.locator("h1").first().waitFor();
  await page.getByRole("button", { name: "Fun" }).click();
  if (await us.count()) await us.first().click();
  ok("A4 demo partner persisted", await page.getByText("Demo partner preview is on").isVisible());
  await page.getByRole("button", { name: "End demo" }).click();
  ok("A4 demo can be ended", await page.getByRole("button", { name: "Preview with demo partner" }).isVisible());
  await ctx.close();
}

// A5. Midnight rollover waits for dirty forms
{
  const { page, ctx } = await newPage();
  const t = new Date(); t.setHours(23, 59, 0, 0);
  await page.clock.install({ time: t });
  await seeded(page, {});
  await page.getByRole("button", { name: "Meals" }).click();
  const nameField = page.getByPlaceholder(/meal name|Meal name|What did you eat|Food name/i).first();
  await nameField.fill("Half typed");
  await nameField.blur();
  await page.clock.runFor("02:30");
  ok("A5 new-day banner instead of reload", await page.getByText("A new day has started").isVisible());
  ok("A5 typed text kept", (await nameField.inputValue()) === "Half typed");
  await ctx.close();
}

// B1. Gym: multi-set, previous values, rest timer, PR, CSV
{
  const { page, errors, ctx } = await newPage();
  await seeded(page, { dayflow_workout_history: [{ date: "2026-01-05", type: "Chest", exercises: { "Incline DB Press": { done: true, weight: "30", reps: "8" } }, savedAt: "2026-01-05T10:00:00Z" }] });
  await page.getByRole("button", { name: "Fun" }).click();
  ok("B1 previous values shown", await page.getByText("Previous (2026-01-05): 30×8").isVisible());
  await page.getByLabel("Incline DB Press set 1 weight").fill("32.5");
  await page.getByLabel("Incline DB Press set 1 reps").fill("8");
  await page.getByRole("button", { name: "Mark Incline DB Press set 1 done" }).click();
  ok("B1 rest timer starts", await page.getByRole("timer").isVisible());
  ok("B1 PR badge", await page.getByText("New personal record").isVisible());
  await page.getByRole("button", { name: "Add set to Incline DB Press" }).click();
  ok("B1 second set prefilled", (await page.getByLabel("Incline DB Press set 2 weight").inputValue()) === "32.5");
  await page.getByRole("button", { name: "Mark Incline DB Press set 2 done" }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "Done Workout" }).click();
  ok("B1 summary counts sets + volume", await page.getByText("520").isVisible() && await page.getByText("2 new personal records").isVisible());
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export workouts (CSV)" }).click()]);
  const path = await dl.path(); const csv = (await import("node:fs")).readFileSync(path, "utf8");
  ok("B1 CSV export has sets", csv.startsWith("date,split,exercise,set,weight,reps,volume") && csv.split("\r\n").length === 4, JSON.stringify(csv.slice(0, 200)));
  const legacy = await page.evaluate(() => JSON.parse(localStorage.getItem("dayflow_workout_history"))[0].exercises["Incline DB Press"]);
  ok("B1 legacy weight/reps mirrored", legacy.weight === "32.5" && legacy.reps === "8" && legacy.sets.length === 2);
  ok("B1 no errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// B2. Cycle predictions from own history + report
{
  const { page, errors, ctx } = await newPage();
  const t = new Date();
  const d = (n) => iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - n));
  const logs = {};
  for (const start of [70, 40, 10]) for (let k = 0; k < 4; k++) logs[d(start - k)] = { date: d(start - k), phase: "period", flow: "medium", symptoms: k === 0 ? ["cramps"] : [] };
  await seeded(page, { dayflow_period_logs: logs });
  await page.getByRole("button", { name: "Health" }).click();
  const est = page.getByTestId("cycle-estimates");
  ok("B2 estimates shown", await est.isVisible());
  const txt = await est.textContent();
  ok("B2 learned 30-day cycle and 4-day period", txt.includes("Average cycle 30 days") && txt.includes("period 4 days") && txt.includes("last 2 logged cycles"), txt.slice(0, 300));
  ok("B2 next period in 20 days", txt.includes("in 20 days"));
  ok("B2 estimate disclaimer", txt.includes("not a method of contraception"));
  await page.getByRole("button", { name: "Cycle report for my doctor" }).click();
  const dlg = page.getByRole("dialog", { name: "Cycle report" });
  ok("B2 report lists 3 periods", (await dlg.locator("tbody tr").count()) === 3);
  ok("B2 report symptom counts", await dlg.getByText("cramps: 3 days").isVisible());
  const [dl] = await Promise.all([page.waitForEvent("download"), dlg.getByRole("button", { name: "Share / save report" }).click()]);
  const html = (await import("node:fs")).readFileSync(await dl.path(), "utf8");
  ok("B2 report file", html.includes("Average cycle length: <b>30 days</b>") && !html.includes("intimacy"));
  ok("B2 no errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// B3. Journal prompt, on-this-day notes, settings (privacy defaults, cloud off), Together
{
  const { page, errors, ctx } = await newPage();
  const t = new Date();
  const weekAgo = iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 7));
  await seeded(page, { dayflow_daily_logs: { [weekAgo]: { date: weekAgo, notes: "Old reflection text", meals: [], snaps: [] } } });
  await page.getByRole("button", { name: "Home" }).click();
  await dismissWake(page);
  await page.getByRole("button", { name: /^Use prompt:/ }).click();
  const notes = await page.getByLabel("Journal notes").inputValue();
  ok("B3 prompt inserted into notes", notes.trim().endsWith("?"), notes);
  ok("B3 on-this-day note shown", await page.getByText("Old reflection text").isVisible());
  await page.getByRole("button", { name: "Settings" }).click();
  ok("B3 cloud shows local-only mode", await page.getByTestId("cloud-disabled").isVisible());
  ok("B3 cycle private by default", (await page.getByRole("switch", { name: "Share Cycle & period" }).getAttribute("aria-checked")) === "false");
  ok("B3 journal private by default", (await page.getByRole("switch", { name: "Share Journal notes" }).getAttribute("aria-checked")) === "false");
  ok("B3 memories shared by default", (await page.getByRole("switch", { name: "Share Memories (snaps)" }).getAttribute("aria-checked")) === "true");
  await page.getByRole("switch", { name: "Share Meals" }).click();
  ok("B3 privacy toggle saved", (await page.evaluate(() => JSON.parse(localStorage.getItem("xlife_partner_privacy")).meals)) === true);
  ok("B3 face id disabled on web", await page.getByRole("switch", { name: "Lock with Face ID" }).isDisabled());
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByRole("button", { name: "Fun" }).click();
  const us = page.getByRole("button", { name: /Us/ });
  if (await us.count()) await us.first().click();
  const card = page.getByTestId("together-card");
  await card.getByRole("button", { name: "Edit" }).click();
  const since = iso(new Date(t.getFullYear() - 2, t.getMonth(), t.getDate() + 10));
  await card.getByLabel("Together since").fill(since);
  const txt = await card.textContent();
  ok("B3 together counter + anniversary", /\d[\d,]* days/.test(txt) && txt.includes("2-year anniversary in 10 days"), txt.slice(0, 160));
  await card.getByPlaceholder(/Countdown/).fill("Tokyo trip");
  await card.getByLabel("Countdown date").fill(iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 5)));
  await card.getByRole("button", { name: "Add countdown" }).click();
  ok("B3 countdown added", await card.getByText("Tokyo trip").isVisible() && await card.getByText("5d").isVisible());
  ok("B3 no errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// B4. Quick add / My foods, barcode via Open Food Facts (mocked), AI hidden when unconfigured
{
  const { page, errors, ctx } = await newPage();
  await page.route("https://world.openfoodfacts.org/**", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ status: 1, product: { code: "3017620422003", product_name: "Hazelnut spread", brands: "BrandX", serving_size: "15 g", serving_quantity: 15, nutriments: { "energy-kcal_100g": 539, proteins_100g: 6.3, sugars_100g: 56.3 } } }) }));
  await seeded(page, { dayflow_meal_history: [
    { id: "h1", date: "2026-11-01", name: "Oatmeal", calories: 350, protein_g: 12, type: "breakfast" },
    { id: "h2", date: "2026-11-02", name: "Oatmeal", calories: 350, protein_g: 12, type: "breakfast" },
    { id: "h3", date: "2026-11-03", name: "Ramen", calories: 800, protein_g: 30, type: "dinner" } ] });
  await page.getByRole("button", { name: "Meals" }).click();
  const qa = page.getByTestId("quick-add");
  ok("B4 frequent meals listed (most frequent first)", (await qa.getByRole("button", { name: /^Quick add/ }).first().textContent()).includes("Oatmeal"));
  await qa.getByRole("button", { name: "Quick add Ramen" }).click(); await page.waitForTimeout(500);
  const meals = await page.evaluate(() => JSON.parse(localStorage.getItem("dayflow_log")).meals);
  ok("B4 quick add logs meal", meals.length === 1 && meals[0].name === "Ramen" && meals[0].calories === 800);
  await qa.getByRole("button", { name: "Save Oatmeal to My foods" }).click();
  ok("B4 saved to My foods", (await page.evaluate(() => JSON.parse(localStorage.getItem("xlife_my_foods")).length)) === 1);
  const bc = page.getByTestId("barcode-lookup");
  await bc.getByLabel("Barcode number").fill("3017620422003");
  await bc.getByRole("button", { name: "Look up" }).click();
  await bc.getByText("Hazelnut spread · BrandX").waitFor({ timeout: 5000 });
  ok("B4 barcode per-serving values", await bc.getByText("81 kcal · 0.9g protein · 8.4g sugar").isVisible());
  await bc.getByRole("button", { name: "Use in meal form" }).click();
  ok("B4 barcode fills meal form", (await page.getByPlaceholder("Meal name").inputValue()) === "Hazelnut spread · BrandX" && (await page.getByPlaceholder("Calories").inputValue()) === "81");
  await bc.getByLabel("Barcode number").fill("123");
  await bc.getByRole("button", { name: "Look up" }).click();
  ok("B4 invalid barcode message", await bc.getByText("8–14 digit").isVisible());
  ok("B4 AI hidden when not configured", await page.getByText("AI photo estimates turn on when Xlife Cloud").isVisible() && !(await page.getByRole("button", { name: "Estimate with AI" }).count()));
  ok("B4 no errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// B5. Daily couple question (local)
{
  const { page, errors, ctx } = await newPage();
  await seeded(page, {});
  await page.getByRole("button", { name: "Fun" }).click();
  const us = page.getByRole("button", { name: /Us/ });
  if (await us.count()) await us.first().click();
  const dq = page.getByTestId("daily-question");
  await dq.getByLabel("Your answer").fill("Hiking together");
  await dq.getByRole("button", { name: "Answer" }).click();
  ok("B5 answer saved and shown", await dq.getByText("Hiking together").isVisible() && (await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("xlife_daily_answers")))[0].answer)) === "Hiking together");
  ok("B5 explains pairing needed", await dq.getByText("Pair with your partner").isVisible());
  ok("B5 no errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// __MORE__

await browser.close();
console.log(results.join("\n"));
