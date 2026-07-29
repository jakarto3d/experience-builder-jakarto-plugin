#!/usr/bin/env node
// Downloads the ArcGIS Experience Builder Developer Edition SDK zip for a
// given <major>.<minor> version (e.g. "1.14") from Esri's downloads page.
//
// There is no stable, static URL for these zips: the page's Download button
// is a JS component that mints a per-click, time-limited Akamai-signed URL
// (a `__gdb__` token) client-side. Requesting the zip without that token
// gets a 403 from Akamai, even with no Esri/ArcGIS account involved
// (confirmed: `agolUsername=NA` in the resulting URL). So this script drives
// a real headless browser against the actual downloads page and captures
// the URL the click produces, rather than guessing at the token format.
//
// Usage: node scripts/fetch-exb-sdk.mjs <version, e.g. 1.14> <output-zip-path>

import { chromium } from "playwright";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const [, , version, outputPath] = process.argv;

if (!version || !outputPath) {
  console.error("Usage: fetch-exb-sdk.mjs <version, e.g. 1.14> <output-zip-path>");
  process.exit(1);
}

const downloadsUrl = "https://developers.arcgis.com/experience-builder/guide/downloads/";
const testId = `download-button-arcgis-experience-builder-${version.replace(/\./g, "-")}-zip`;

const browser = await chromium.launch();
const page = await browser.newPage();

let zipUrl;
page.on("response", (response) => {
  if (response.url().includes(`arcgis-experience-builder-${version}.zip`)) {
    zipUrl = response.url();
  }
});

await page.goto(downloadsUrl, { waitUntil: "networkidle" });

// Cookie consent banner intercepts clicks until dismissed; "Reject All" is
// the privacy-preserving choice and doesn't affect the download itself.
await page.waitForTimeout(2500);
await page.click("#onetrust-reject-all-handler", { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(500);

const button = page.locator(`[data-testid="${testId}"]`);
await button.waitFor({ state: "visible", timeout: 15000 });
await button.click({ timeout: 10000 });
await page.waitForTimeout(3000);
await browser.close();

if (!zipUrl) {
  console.error(
    `Could not resolve a download URL for ArcGIS Experience Builder ${version}. ` +
      "Esri may have changed the downloads page's markup (selector: " +
      `[data-testid="${testId}"]) or dropped that version.`
  );
  process.exit(1);
}

console.error(`Resolved SDK URL for ${version}, downloading to ${outputPath}`);
const response = await fetch(zipUrl);
if (!response.ok || !response.body) {
  console.error(`Download failed: HTTP ${response.status}`);
  process.exit(1);
}
await pipeline(Readable.fromWeb(response.body), createWriteStream(outputPath));
