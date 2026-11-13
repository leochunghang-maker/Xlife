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
export { browser, ok, results, dismissWake, newPage, URL, IMG };
