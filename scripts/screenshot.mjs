#!/usr/bin/env node
/** Capture README screenshot — requires: npx playwright install chromium */

import { chromium } from "playwright";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "docs", "screenshot.png");
const url = process.env.SCREENSHOT_URL ?? "http://localhost:8765/index.html";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle" });

await page.evaluate(() => localStorage.removeItem("circuit-sim-autosave"));
await page.reload({ waitUntil: "networkidle" });

await page.selectOption("#sample-select", "ripple-counter");
await page.click("#btn-run");
await page.waitForTimeout(1200);

await page.screenshot({ path: out, fullPage: false });
await browser.close();
console.log("Wrote", out);
