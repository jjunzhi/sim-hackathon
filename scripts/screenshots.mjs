#!/usr/bin/env node
// Full-page screenshots of a route at exact viewport widths, in both themes,
// using a local Chrome/Edge over the DevTools protocol (no extra packages).
// Also reports console errors and horizontal overflow for each capture.
//
// Usage (dev server running):
//   node scripts/screenshots.mjs [path=/design] [outDir=docs/screenshots/phase0]
// Env: SCREENSHOT_BASE_URL (default http://localhost:3000), REDUCED_MOTION=1
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const route = process.argv[2] ?? "/design";
const outDir = process.argv[3] ?? "docs/screenshots/phase0";
const base = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const reduced = process.env.REDUCED_MOTION === "1";
const widths = [390, 768, 1366];
const themes = ["couple", "vendor"];

const candidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
const browserPath = process.env.CHROME_PATH ?? candidates.find((p) => existsSync(p));
if (!browserPath) throw new Error("No Chrome/Edge found. Set CHROME_PATH.");

const port = 9333;
const profile = mkdtempSync(join(tmpdir(), "wv-shots-"));
const chrome = spawn(browserPath, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--hide-scrollbars",
  "--no-first-run",
  "about:blank",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
      if (res.ok) return res.json();
    } catch {}
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      listeners.forEach((l) => l(msg));
    }
  };
  return new Promise((resolve) => {
    ws.onopen = () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((res, rej) => {
            const mid = ++id;
            pending.set(mid, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ id: mid, method, params }));
          }),
        on: (fn) => listeners.push(fn),
        close: () => ws.close(),
      });
  });
}

mkdirSync(outDir, { recursive: true });
const target = await getTarget();
const cdp = await connect(target.webSocketDebuggerUrl);
const errors = [];
cdp.on((m) => {
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  }
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text);
});
await cdp.send("Runtime.enable");
await cdp.send("Page.enable");
if (reduced) {
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
}

const report = [];
for (const theme of themes) {
  for (const width of widths) {
    const before = errors.length;
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await cdp.send("Page.navigate", { url: `${base}${route}?theme=${theme}` });
    await sleep(3500);
    // Scroll through so whileInView reveals run, then back to top.
    await cdp.send("Runtime.evaluate", {
      expression: "(async()=>{for(let y=0;y<document.body.scrollHeight;y+=400){scrollTo(0,y);await new Promise(r=>setTimeout(r,60))}scrollTo(0,0)})()",
      awaitPromise: true,
    });
    await sleep(800);
    const { result } = await cdp.send("Runtime.evaluate", {
      expression: "JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})",
      returnByValue: true,
    });
    const m = JSON.parse(result.value);
    const shot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: m.h, scale: 1 },
    });
    const name = `design-${theme}-${width}${reduced ? "-reduced" : ""}.png`;
    writeFileSync(join(outDir, name), Buffer.from(shot.data, "base64"));
    const row = {
      file: name,
      overflowX: m.sw > m.cw ? `YES (${m.sw}px > ${m.cw}px)` : "no",
      consoleErrors: errors.length - before,
    };
    report.push(row);
  }
}

console.table(report);
if (errors.length) console.log("Console errors:\n" + [...new Set(errors)].join("\n"));
cdp.close();
chrome.kill();
await sleep(300);
try {
  rmSync(profile, { recursive: true, force: true });
} catch {}
