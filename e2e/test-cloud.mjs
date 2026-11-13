import { browser, ok, results, newPage, IMG } from "./harness.mjs";
const URL = process.env.XLIFE_CLOUD_URL || "http://localhost:4174/";
{
  const { page, errors, ctx } = await newPage();
  await page.goto(URL); await page.locator("h1").first().waitFor();
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("dayflow_user", JSON.stringify({ id: "u1", name: "T", email: "t@t.t" })); });
  await page.reload(); await page.locator("h1").first().waitFor();
  await page.getByRole("button", { name: "Settings" }).click();
  ok("C1 cloud sign-in form shown when configured", await page.getByRole("button", { name: "Create account" }).isVisible());
  await page.getByRole("button", { name: "Close settings" }).click();
  await page.getByRole("button", { name: "Meals" }).click();
  await page.locator('label:has-text("Attach a food photo") input[type=file]').setInputFiles(IMG);
  await page.getByRole("button", { name: "Estimate with AI" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Estimate with AI" }).click();
  await page.getByText("Sign in to Xlife Cloud").waitFor({ timeout: 5000 });
  ok("C1 AI requires cloud sign-in", true);
  ok("C1 no page errors", errors.filter((e) => !e.includes("Failed to load resource")).length === 0, errors.join(" | "));
  await ctx.close();
}
await browser.close();
console.log(results.join("\n"));
