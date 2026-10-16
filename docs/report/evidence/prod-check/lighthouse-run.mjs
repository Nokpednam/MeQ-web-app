// Lighthouse (mobile, performance) on the deployed site, signed in with the cookie in MEQ_COOKIE.
// The cookie is set for the MeQ host only, so it is never sent to LINE's image servers or other hosts.
// Usage: node lighthouse-run.mjs <output dir>
import fs from "node:fs";
import path from "node:path";
import lighthouse from "lighthouse";
import puppeteer from "puppeteer-core";

const APP = "https://meq-starter-v01.vercel.app";
const HOST = new URL(APP).hostname;
const PAGES = ["/courts/3x3-a", "/profile", "/courts", "/admin"];
const RUNS = 3;
const out = process.argv[2];
const cookie = process.env.MEQ_COOKIE;
if (!out || !cookie) throw new Error("Usage: MEQ_COOKIE=... node lighthouse-run.mjs <output dir>");
fs.mkdirSync(out, { recursive: true });

const cookies = cookie.split(";").map((pair) => {
  const i = pair.indexOf("=");
  return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim(), domain: HOST, path: "/", secure: true, httpOnly: false };
}).filter((c) => c.name);

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const rows = ["page\trun\tscore\tFCP ms\tLCP ms\tTBT ms\tSI ms"];
try {
  for (const p of PAGES) {
    for (let run = 1; run <= RUNS; run++) {
      const page = await browser.newPage();
      await browser.setCookie(...cookies);
      const result = await lighthouse(`${APP}${p}`, { output: "json", onlyCategories: ["performance"], disableStorageReset: true, logLevel: "error" }, undefined, page);
      const lhr = result.lhr;
      if (new URL(lhr.finalDisplayedUrl).pathname.startsWith("/login")) throw new Error(`Session not accepted on ${p}: ended at /login`);
      const a = lhr.audits;
      const name = `${p.slice(1).replaceAll("/", "-")}-${run}`;
      fs.writeFileSync(path.join(out, `${name}.json`), result.report);
      rows.push([p, run, Math.round(lhr.categories.performance.score * 100),
        ...["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "speed-index"].map((k) => Math.round(a[k].numericValue))].join("\t"));
      console.log(rows.at(-1));
      await page.close();
    }
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(out, "summary.txt"), rows.join("\n") + "\n");
