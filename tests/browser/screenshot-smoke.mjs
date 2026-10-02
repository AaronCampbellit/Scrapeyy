// Runs compiled Firefox scripts in isolated browser pages, with WebExtension
// transport/download APIs simulated. It does not automate an installed add-on.
// PLAYWRIGHT_MODULE can point to an existing Playwright installation.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const repo = fileURLToPath(new URL("../../", import.meta.url));
const build = path.resolve(repo, process.argv[2] || "work/build/firefox-mv2");
const output = path.join(repo, "work/screenshot-smoke");
const manifest = JSON.parse(await readFile(path.join(build, "manifest.json"), "utf8"));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const background = await context.newPage();
  const errors = [];
  for (const surface of [page, background]) surface.on("pageerror", (error) => errors.push(error.message));
  const fixture = '<!doctype html><style>html,body{margin:0}body{transform:translateZ(0)}section{height:700px;background:#e2e8f0}section:nth-child(2){background:#fbbf24}section:nth-child(3){background:#38bdf8}</style><section>Top</section><section>Middle</section><section>Bottom</section>';
  await context.route("https://fixture.test/**", (route) => route.fulfill({ body: fixture, contentType: "text/html" }));
  await context.route("https://extension.test/**", async (route) => {
    const file = new URL(route.request().url()).pathname;
    const body = file === "/background.html" ? "<!doctype html>" : await readFile(path.join(build, file));
    await route.fulfill({ body, contentType: file.endsWith(".css") ? "text/css" : "text/html",
      headers: { "access-control-allow-origin": "*" } });
  });
  await page.goto("https://fixture.test/");
  await background.goto("https://extension.test/background.html");
  const dispatch = (surface, message, sender = {}) => surface.evaluate(async ({ message, sender }) => {
    for (const fn of window.messageListeners) {
      const result = fn(message, sender);
      if (result !== undefined && result !== false) return await result;
    }
  }, { message, sender });
  await page.exposeFunction("sendBackground", (message) => dispatch(background, message, { tab: { id: 1 } }));
  await background.exposeFunction("sendPage", (message) => dispatch(page, message));
  let injections = 0;
  await background.exposeFunction("injectContent", async () => {
    injections++;
    await page.addScriptTag({ path: path.join(build, "content-scripts/content.js") });
  });
  await background.exposeFunction("capturePage", async () => {
    const bytes = await page.screenshot();
    return "data:image/png;base64," + bytes.toString("base64");
  });
  const savedFiles = [];
  await background.exposeFunction("savePng", async (filename, bytes) => {
    const file = path.join(output, path.basename(filename));
    await writeFile(file, Buffer.from(bytes));
    savedFiles.push(file);
    return file;
  });
  for (const [surface, isBackground] of [[page, false], [background, true]]) {
    await surface.evaluate(({ isBackground, version }) => {
      const event = () => {
        const listeners = new Set();
        return { addListener: (fn) => listeners.add(fn), removeListener: (fn) => listeners.delete(fn),
          fire: (value) => listeners.forEach((fn) => fn(value)) };
      };
      window.messageListeners = new Set();
      const changed = event();
      const downloads = new Map();
      window.browser = {
        runtime: { id: "scrapeyy@local", getURL: (url) => "https://extension.test/" + url.replace(/^\//, ""),
          getManifest: () => ({ version }), onInstalled: event(), onStartup: event(),
          onMessage: { addListener: (fn) => window.messageListeners.add(fn), removeListener: (fn) => window.messageListeners.delete(fn) },
          sendMessage: (message) => window.sendBackground(message) },
        storage: { local: { get: async () => ({ appSettings: { downloadBehavior: "automatic" } }), set: async () => {} } },
        alarms: { onAlarm: event() },
        tabs: { get: async () => ({ id: 1, windowId: 1, active: true, url: "https://fixture.test/" }),
          sendMessage: (_id, message) => window.sendPage(message), captureVisibleTab: () => window.capturePage() },
        scripting: { insertCSS: async () => {}, executeScript: () => window.injectContent() },
        downloads: { onChanged: changed, search: async ({ id }) => downloads.has(id) ? [downloads.get(id)] : [],
          download: async ({ url, filename }) => {
            const bytes = [...new Uint8Array(await (await fetch(url)).arrayBuffer())];
            const saved = await window.savePng(filename, bytes);
            const id = downloads.size + 1;
            downloads.set(id, { filename: saved, state: "in_progress", exists: true });
            setTimeout(() => { downloads.get(id).state = "complete"; changed.fire({ id }); }, 100);
            return id;
          } },
      };
      if (!isBackground) {
        // Reproduce an old page bridge: an unversioned ping must trigger reinjection.
        const stale = (message) => message.type === "SCRAPEYY_PING" ? Promise.resolve({ ok: true }) : undefined;
        window.messageListeners.add(stale);
        document.addEventListener("scrapeyy@local:content:wxt:content-script-started", () => window.messageListeners.delete(stale));
      }
    }, { isBackground, version: manifest.version });
  }
  await background.addScriptTag({ path: path.join(build, "background.js") });
  const ready = await dispatch(background, { type: "SCRAPEYY_START_SCREENSHOT_SELECTION", tabId: 1 });
  assert.deepEqual(ready, { status: "selection-ready", version: manifest.version });
  const layer = page.locator(".screenshot-selection");
  await layer.waitFor();
  assert.deepEqual(await layer.boundingBox(), { x: 0, y: 0, width: 1000, height: 700 });
  await page.mouse.move(450, 400); await page.mouse.down();
  await page.mouse.move(100, 150, { steps: 5 }); await page.mouse.up();
  assert.deepEqual(await page.locator(".screenshot-area").boundingBox(), { x: 100, y: 150, width: 350, height: 250 });
  assert.equal(savedFiles.length, 0, "drawing should leave the crop visible until Capture");
  await page.screenshot({ path: path.join(output, "crop-overlay.png") });
  await page.getByRole("button", { name: "Capture", exact: true }).click();
  await layer.waitFor({ state: "detached" });
  const selection = await readFile(savedFiles[0]);
  assert.equal(selection.readUInt32BE(16), 350);
  assert.equal(selection.readUInt32BE(20), 250);
  for (const kind of ["visible", "full-page"]) {
    const result = await dispatch(background, { type: "SCRAPEYY_SCREENSHOT", tabId: 1, kind });
    assert.equal(result.status, "saved");
    const png = await readFile(result.filename);
    assert.equal(png.readUInt32BE(16), 1000);
    assert.equal(png.readUInt32BE(20), kind === "visible" ? 700 : 2100);
  }
  assert.equal(await page.evaluate(() => scrollY), 0, "full-page capture restores original position");
  await dispatch(background, { type: "SCRAPEYY_START_SCREENSHOT_SELECTION", tabId: 1 });
  await page.keyboard.press("Escape");
  await layer.waitFor({ state: "detached" });
  assert.equal(savedFiles.length, 3, "Escape should not download");
  assert.equal(injections, 1, "the stale script is replaced once, then the current bridge is reused");
  assert.deepEqual(errors, []);
  console.log("Compiled-script smoke passed: stale bridge replacement, shadow overlay, reverse drag, Capture, Escape, all 3 PNG files and dimensions, scroll restoration.");
} finally {
  await browser.close();
}
