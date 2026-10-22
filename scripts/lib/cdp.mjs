// Minimal Chrome DevTools Protocol driver (no extra packages): launch a local
// headless Chrome/Edge, then send commands over its WebSocket.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const candidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ port = 9333 } = {}) {
  const browserPath = process.env.CHROME_PATH ?? candidates.find((p) => existsSync(p));
  if (!browserPath) throw new Error("No Chrome/Edge found. Set CHROME_PATH.");
  const profile = mkdtempSync(join(tmpdir(), "wv-cdp-"));
  const chrome = spawn(browserPath, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--hide-scrollbars",
    "--no-first-run",
    "about:blank",
  ]);

  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
      if (res.ok) target = await res.json();
    } catch {
      await sleep(200);
    }
  }
  if (!target) throw new Error("Chrome did not start");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
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

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };

  const errors = [];
  listeners.push((m) => {
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
    }
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text);
  });
  await send("Runtime.enable");
  await send("Page.enable");

  async function close() {
    ws.close();
    chrome.kill();
    await sleep(300);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {}
  }

  return { send, evaluate, errors, close };
}

/** Navigate, scroll through so reveal animations run, then measure. */
export async function loadAndMeasure(cdp, url, { settleMs = 3500 } = {}) {
  await cdp.send("Page.navigate", { url });
  await sleep(settleMs);
  await cdp.evaluate(
    "(async()=>{for(let y=0;y<document.body.scrollHeight;y+=400){scrollTo(0,y);await new Promise(r=>setTimeout(r,60))}scrollTo(0,0)})()",
  );
  await sleep(600);
  return JSON.parse(
    await cdp.evaluate(
      "JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})",
    ),
  );
}

export async function capture(cdp, width, height) {
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  return Buffer.from(shot.data, "base64");
}

export async function setViewport(cdp, width, { reduced = false } = {}) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
  if (reduced) {
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  }
}
