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
  for (const scenario of ['maximum z-index menu', 'existing modal', 'existing popover', 'later modal', 'later popover', 'transformed document']) {
    await page.evaluate((scenario) => {
      document.documentElement.style.transform = scenario === 'transformed document' ? 'translateZ(0)' : '';
      const menu = document.createElement(scenario.includes('modal') ? 'dialog' : 'div');
      menu.id = 'site-menu';
      menu.setAttribute('style', 'position:fixed;inset:0;width:100vw;height:150px;max-width:none;max-height:none;margin:0;padding:0;border:0;background:orange;z-index:2147483647');
      if (scenario.includes('popover')) menu.setAttribute('popover', 'manual');
      document.body.append(menu);
      if (scenario === 'existing modal') menu.showModal();
      if (scenario === 'existing popover') menu.showPopover();
    }, scenario);
    await dispatch(background, { type: 'SCRAPEYY_START_SCREENSHOT_SELECTION', tabId: 1 });
    if (scenario.startsWith('later ')) {
      await page.evaluate(scenario => {
        const menu = document.querySelector('#site-menu');
        if (scenario.includes('modal')) menu.showModal(); else menu.showPopover();
      }, scenario);
    }
    await page.waitForTimeout(50);
    assert.equal(await layer.evaluate(node => node.matches(':modal')), true, scenario);
    assert.deepEqual(await layer.boundingBox(), { x: 0, y: 0, width: 1000, height: 700 }, scenario);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click({ trial: true });
    await page.mouse.move(450, 120); await page.mouse.down();
    await page.mouse.move(100, 80, { steps: 5 }); await page.mouse.up();
    assert.deepEqual(await page.locator('.screenshot-area').boundingBox(), { x: 100, y: 80, width: 350, height: 40 }, scenario);
    // Controls remain visible and clickable even when the selection shade
    // crosses their position or site top-layer menus open during drawing.
    await page.getByRole('button', { name: 'Capture', exact: true }).click({ trial: true });
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await layer.waitFor({ state: 'detached' });
    await page.evaluate(scenario => {
      const menu = document.querySelector('#site-menu');
      if (scenario.includes('modal') && !menu.open) throw new Error('Site modal was closed');
      if (scenario.includes('popover') && !menu.matches(':popover-open')) throw new Error('Site popover was closed');
      menu.remove(); document.documentElement.style.transform = '';
    }, scenario);
  }
  assert.equal(savedFiles.length, 3, 'Layering checks do not download screenshots');
  assert.equal(injections, 1, "the stale script is replaced once, then the current bridge is reused");
  assert.deepEqual(errors, []);
  const results = [];
  const samplePixel = async (file, x, y) => {
    const bytes = [...await readFile(file)];
    return background.evaluate(async ({ bytes, x, y }) => {
      const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
      const canvas = new OffscreenCanvas(image.width, image.height);
      const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
      const pixel = [...ctx.getImageData(x, y, 1, 1).data]; image.close(); return pixel;
    }, { bytes, x, y });
  };
  assert.deepEqual(await samplePixel(savedFiles[0], 20, 20), [226, 232, 240, 255], 'Selection dialog and backdrop must be absent from the saved PNG');
  const fixtureCapture = async (name, body, height, options = {}) => {
    await page.evaluate(({ body }) => {
      document.head.innerHTML = '<style>html,body{margin:0}body{background:white}</style>';
      document.body.innerHTML = body;
      window.scrollTo(0, 0);
    }, { body });
    if (options.setup) await options.setup();
    const before = await page.evaluate(() => ({
      styles: [...document.querySelectorAll("*")].map(node => node.getAttribute("style")),
      x: scrollX, y: scrollY, nestedTop: document.querySelector('#scroller')?.scrollTop,
    }));
    const result = await dispatch(background, { type: "SCRAPEYY_SCREENSHOT", tabId: 1, kind: "full-page" });
    assert.equal(result.status, "saved");
    const png = await readFile(result.filename);
    assert.equal(png.readUInt32BE(20), height, name + ': full PNG height');
    const after = await page.evaluate(() => ({
      styles: [...document.querySelectorAll("*")].map(node => node.getAttribute("style")),
      x: scrollX, y: scrollY, nestedTop: document.querySelector('#scroller')?.scrollTop,
    }));
    assert.equal(after.x, before.x); assert.equal(after.y, before.y);
    assert.equal(after.nestedTop, before.nestedTop);
    // Inline declaration serialization/order may change, but every original
    // inline property and priority must be restored.
    await page.evaluate(({ before, siteChangedHeight }) => {
      const nodes = [...document.querySelectorAll('*')];
      before.styles.forEach((style, index) => {
        const expected = document.createElement('div'); expected.setAttribute('style', style || '');
        const actual = nodes[index].style;
        for (const property of expected.style) {
          if (siteChangedHeight && nodes[index].tagName === 'MAIN' && property === 'height') continue;
          if (actual.getPropertyValue(property) !== expected.style.getPropertyValue(property) ||
              actual.getPropertyPriority(property) !== expected.style.getPropertyPriority(property)) {
            throw new Error('Style was not restored: ' + property);
          }
        }
        for (const property of actual) if (!expected.style.getPropertyValue(property)) throw new Error('Capture style was left behind: ' + property);
      });
    }, { before, siteChangedHeight: options.siteChangedHeight || false });
    if (options.sample) assert.deepEqual(await samplePixel(result.filename, ...options.sample.slice(0, 2)), options.sample[2], name);
    results.push({ name, width: png.readUInt32BE(16), height, file: result.filename });
  };
  await fixtureCapture('Nested scrolling panel', '<main id="scroller" style="height:700px;overflow:auto"><div style="height:2100px;background:blue"></div></main>', 2100, {
    setup: () => page.evaluate(() => { document.querySelector('#scroller').scrollTop = 300; }),
    sample: [20, 2050, [0, 0, 255, 255]],
  });
  await fixtureCapture('Fixed app scrolling panel', '<main id="scroller" style="position:fixed;inset:0;overflow:auto"><div style="height:2100px;background:blue"></div></main>', 2100, {
    sample: [20, 2050, [0, 0, 255, 255]],
  });
  await fixtureCapture('Flex dashboard scrolling panel', '<style>html,body{height:100%;overflow:hidden}body{display:flex;flex-direction:column}header{height:60px;flex-shrink:0}main{flex:1;min-height:0;overflow:auto}</style><header>Dashboard</header><main id="scroller"><div style="height:2100px;background:blue"></div></main>', 2160, {
    sample: [20, 2100, [0, 0, 255, 255]],
  });
  await fixtureCapture('Sticky section below first viewport', '<div style="height:800px;background:blue"></div><header style="position:sticky;top:0;height:100px;background:red"></header><div style="height:1200px;background:blue"></div>', 2100, {
    sample: [20, 850, [255, 0, 0, 255]],
  });
  await fixtureCapture('Overlapping last tile preserves initial header', '<header style="position:fixed;top:0;width:100%;height:150px;background:red"></header><div style="height:800px;background:blue"></div>', 800, {
    sample: [20, 120, [255, 0, 0, 255]],
  });
  await fixtureCapture('Content loaded while scrolling', '<main style="height:1400px;background:blue"></main>', 2100, {
    siteChangedHeight: true,
    setup: () => page.evaluate(() => {
      window.addEventListener('scroll', function grow() {
        if (!scrollY) return;
        window.removeEventListener('scroll', grow);
        document.querySelector('main').style.height = '2100px';
      });
    }),
    sample: [20, 2050, [0, 0, 255, 255]],
  });
  await writeFile(path.join(output, 'full-page-results.json'), JSON.stringify(results, null, 2));
  assert.deepEqual(errors, []);
  console.log("Compiled-script smoke passed: top-layer selection over high-z-index menus, existing/later dialogs and popovers, transformed roots, clean crop PNG, visible/full PNGs, nested/fixed panels, sticky content, overlap, lazy growth, style/scroll restoration.");
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
