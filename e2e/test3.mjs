// Integration of local-latest (~/dayflow) features into the split app.
import { browser, ok, results, newPage, URL, IMG } from "./harness.mjs";
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
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
async function dismissWake(page) {
  for (const name of ["Don't ask again today", "Not yet"]) {
    const btn = page.getByRole("button", { name });
    if (await btn.count() && await btn.first().isVisible()) { await btn.first().click(); return; }
  }
}

// L1. Full-screen Snaps: no header, review step with 3 stacked choices + Retake
{
  const { page, errors, ctx } = await newPage();
  await seeded(page);
  await dismissWake(page);
  ok("L1 Snaps has no visible header", await page.locator("header").count() === 0);
  ok("L1 Snaps keeps an accessible title", (await page.locator("h1").first().textContent()) === "Snaps");
  const bg = await page.locator("main").evaluate((el) => getComputedStyle(el).backgroundColor);
  ok("L1 Snaps surface is black", bg === "rgb(0, 0, 0)", bg);
  await page.locator('input[type=file]:not([capture])').setInputFiles(IMG);
  await page.getByRole("button", { name: "Save Memory" }).waitFor();
  ok("L1 review shows choices, no form yet", await page.getByPlaceholder("Add a caption").count() === 0 && await page.getByRole("button", { name: "Retake" }).isVisible());
  await page.getByRole("button", { name: "Mark Food" }).click();
  ok("L1 food sheet opens", await page.getByPlaceholder("Food name").isVisible());
  ok("L1 no fabricated AI estimate", !(await page.content()).includes("Grilled chicken rice bowl"));
  await page.getByRole("button", { name: "Retake" }).click();
  ok("L1 retake returns to shutter", await page.getByRole("button", { name: "Take photo" }).isVisible());
  await page.getByRole("button", { name: "Home" }).click();
  ok("L1 header back on other tabs", await page.locator("header h1").isVisible());
  ok("L1 no errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// L2. Gym completion: encouragement, logged exercises, start another workout
{
  const { page, errors, ctx } = await newPage();
  await seeded(page);
  await page.getByRole("button", { name: "Fun" }).click();
  await dismissWake(page);
  await page.getByLabel("Incline DB Press set 1 weight").fill("30");
  await page.getByLabel("Incline DB Press set 1 reps").fill("10");
  await page.getByRole("button", { name: "Mark Incline DB Press set 1 done" }).click();
  const skip = page.getByRole("button", { name: "Skip" }); if (await skip.count()) await skip.click();
  await page.getByRole("button", { name: "Done Workout" }).click();
  const msgs = ["Strong work", "You showed up today", "Great session", "Another step stronger", "Discipline logged"];
  const text = await page.locator("[role=status]").first().textContent();
  ok("L2 encouragement shown", msgs.some((m) => text.includes(m)), text.slice(0, 120));
  ok("L2 logged exercises list", await page.getByText("Logged exercises").isVisible() && await page.getByText("30 × 10").isVisible());
  await page.getByRole("button", { name: "Start another workout" }).click();
  ok("L2 tracker back", await page.getByRole("button", { name: "Done Workout" }).isVisible());
  await page.getByLabel("Incline DB Press set 1 weight").fill("32");
  await page.getByLabel("Incline DB Press set 1 reps").fill("8");
  await page.getByRole("button", { name: "Mark Incline DB Press set 1 done" }).click();
  if (await skip.count()) await skip.click();
  await page.getByRole("button", { name: "Done Workout" }).click();
  const hist = await page.evaluate(() => JSON.parse(localStorage.getItem("dayflow_workout_history")));
  ok("L2 second same-day session kept separately", hist.length === 2 && hist.filter((h) => h.session_id).length === 1, JSON.stringify(hist.map((h) => [h.date, h.type, h.session_id])));
  await page.getByRole("button", { name: "Edit workout" }).click();
  await page.getByRole("button", { name: "Done Workout" }).click();
  const hist2 = await page.evaluate(() => JSON.parse(localStorage.getItem("dayflow_workout_history")));
  ok("L2 re-finishing a session doesn't duplicate", hist2.length === 2, String(hist2.length));
  ok("L2 no errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// L3. Partner connection (xlife_partner_connection)
{
  const { page, errors, ctx } = await newPage();
  await seeded(page);
  await page.getByRole("button", { name: "Fun" }).click();
  await dismissWake(page);
  await page.getByRole("button", { name: "Invite Partner" }).click();
  const code = await page.getByLabel("Partner invite code").textContent();
  ok("L3 invite code generated", /^XLIFE-[A-Z0-9]{4}$/.test(code), code);
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem("xlife_partner_connection")));
  ok("L3 invite stored", stored.status === "invite_created" && stored.inviteCode === code && stored.local === true);
  ok("L3 local-only notice", await page.getByText(/codes only work on this phone/).isVisible());
  await page.getByLabel("Partner code").fill("XLIFE-ABCD");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  ok("L3 connected (local)", await page.getByText("Connected with Partner").isVisible() && await page.getByText(/Paired on this phone only/).isVisible());
  await page.reload(); await page.locator("h1").first().waitFor();
  await page.getByRole("button", { name: "Fun" }).click();
  ok("L3 connection survives reload", await page.getByText("Connected with Partner").isVisible());
  await page.getByRole("button", { name: "Disconnect Partner" }).click();
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem("xlife_partner_connection")));
  ok("L3 disconnect", stored.status === "none" && await page.getByRole("button", { name: "Invite Partner" }).isVisible());
  ok("L3 demo still available", await page.getByRole("button", { name: "Preview with demo partner" }).isVisible());
  ok("L3 no errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// L4. Existing local-latest / onboarding data is read
{
  const { page, ctx } = await newPage();
  await seeded(page, { xlife_partner_connection: { id: "c1", ownerUserId: "u1", inviteCode: "XLIFE-QWER", partnerName: "Partner", partnerEmail: null, status: "connected", createdAt: "2026-11-10T00:00:00Z", connectedAt: "2026-11-10T01:00:00Z" } });
  await page.getByRole("button", { name: "Fun" }).click();
  await dismissWake(page);
  ok("L4 local-latest connection shown", await page.getByText("Connected with Partner").isVisible());
  await ctx.close();
  const p2 = await newPage();
  await seeded(p2.page, { dayflow_partner_connection: { inviteCode: "XL-ONB123", partnerName: null, connected: false, createdAt: "2026-11-10T00:00:00Z" } });
  await p2.page.getByRole("button", { name: "Fun" }).click();
  await dismissWake(p2.page);
  ok("L4 onboarding invite shown as pending", (await p2.page.getByLabel("Partner invite code").textContent()) === "XL-ONB123");
  await p2.page.getByRole("button", { name: "Cancel invite" }).click();
  await p2.page.reload(); await p2.page.locator("h1").first().waitFor();
  await p2.page.getByRole("button", { name: "Fun" }).click();
  const legacy = await p2.page.evaluate(() => localStorage.getItem("dayflow_partner_connection"));
  ok("L4 cancel hides it but keeps legacy key", await p2.page.getByRole("button", { name: "Invite Partner" }).isVisible() && legacy !== null);
  await p2.ctx.close();
}

// L5. Nearby restaurants: real Maps hand-off, no fabricated places
{
  const { page, errors, ctx } = await newPage();
  await seeded(page);
  await page.getByRole("button", { name: "Meals" }).click();
  await dismissWake(page);
  const browseTab = page.getByRole("button", { name: /^Browse/ });
  if (await browseTab.count()) await browseTab.first().click();
  await page.getByRole("button", { name: "Japanese", exact: true }).first().click();
  await page.getByLabel("Nearby location").fill("Causeway Bay");
  const href = await page.getByRole("link", { name: "Open in Apple Maps" }).getAttribute("href");
  ok("L5 Apple Maps search link", href === "https://maps.apple.com/?q=Japanese%20restaurants%20near%20Causeway%20Bay", href);
  const html = await page.content();
  ok("L5 no fabricated restaurants/ratings", !["Din Tai Fung", "Sushi House", "Ramen Bar", "Curry Palace", "Thai Garden"].some((s) => html.includes(s)));
  ok("L5 no errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// L6. Readable inputs in dark mode + safe-area classes
{
  const { page, ctx } = await newPage("dark");
  await page.goto(URL); await page.locator("h1").first().waitFor();
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.locator("h1").first().waitFor();
  ok("L6 onboarding has safe-area padding", await page.locator(".safe-top.safe-bottom").count() > 0);
  await page.getByRole("button", { name: "Create Account" }).first().click();
  const color = await page.getByPlaceholder("Name").evaluate((el) => getComputedStyle(el).color);
  ok("L6 dark-mode input text is light", color === "rgb(244, 244, 245)", color);
  await ctx.close();
}

// L7. Branding: app title
{
  const { page, ctx } = await newPage();
  await page.goto(URL); await page.locator("h1").first().waitFor();
  ok("L7 document title Xlife", (await page.title()) === "Xlife");
  await ctx.close();
}

await browser.close();
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
