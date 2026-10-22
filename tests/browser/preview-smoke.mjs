// Exercises compiled pages and real IndexedDB. WebExtension window/storage/
// export APIs are bridged to Playwright; this is not an installed add-on test.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decryptSession } from "../../scripts/decrypt-session.mjs";

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const repo = fileURLToPath(new URL("../../", import.meta.url));
const build = path.resolve(repo, process.argv[2] || ".output/firefox-mv2");
const output = path.join(repo, "work/preview-smoke");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1100, height: 800 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const errors = [];
  context.on("page", (page) =>
    page.on("pageerror", (error) => errors.push(error.message)),
  );
  await context.route("https://extension.test/**", async (route) => {
    const file = new URL(route.request().url()).pathname;
    const body =
      file === "/seed.html"
        ? "<!doctype html>"
        : await readFile(path.join(build, file));
    const contentType = file.endsWith(".js")
      ? "text/javascript"
      : file.endsWith(".css")
        ? "text/css"
        : file.endsWith(".png")
          ? "image/png"
          : "text/html";
    await route.fulfill({ body, contentType });
  });
  const exports = [];
  const windows = [];
  const sessionDownloads = [];
  await context.exposeFunction("saveSessionDownload", (options) => { sessionDownloads.push(options); return 1; });
  await context.exposeFunction("sendRuntime", (message) => {
    if (message.type === "SCRAPEYY_EXPORT_RUN") exports.push(message.runId);
    return {};
  });
  let preview;
  await context.exposeFunction("createPreviewWindow", async (options) => {
    windows.push(options);
    preview = await context.newPage();
    await preview.goto(options.url);
    return { id: 42 };
  });
  await context.addInitScript(() => {
    window.browser = {
      runtime: {
        id: "scrapeyy@local",
        getURL: (file) => "https://extension.test/" + file.replace(/^\//, ""),
        sendMessage: (message) => window.sendRuntime(message),
      },
      windows: { create: (options) => window.createPreviewWindow(options) },
      storage: {
        local: {
          get: async (key) => ({
            [key]: key === "appSettings" ? { theme: "dark" } : [],
          }),
          set: async () => {},
        },
      },
      tabs: {
        get: async (id) => ({ id, url: "https://fixture.test/" }),
        query: async () => [{ id: 1, url: "https://fixture.test/" }],
        sendMessage: async () => ({ active: false }),
      },
      permissions: { contains: async () => false, request: async () => true },
      downloads: { download: (options) => window.saveSessionDownload(options) },
      cookies: {
        getAllCookieStores: async () => [{ id: "fixture", tabIds: [1] }],
        getAll: async () => [{ name: "fixture-session", value: "synthetic-only", domain: "fixture.test", path: "/", hostOnly: true,
          secure: true, httpOnly: true, sameSite: "lax", session: true, storeId: "fixture" }],
      },
      scripting: { executeScript: async () => [{ result: { origin: "https://fixture.test", localStorage: [{ name: "fixture-local", value: "synthetic-storage" }], sessionStorage: [] } }] },
    };
  });
  const popup = await context.newPage();
  await popup.goto("https://extension.test/seed.html");
  await popup.evaluate(async () => {
    const request = indexedDB.open("scrapeyy-captures", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      const runs = db.createObjectStore("runs", { keyPath: "id" });
      runs.createIndex("recipeId", "recipeId");
      runs.createIndex("completedAt", "completedAt");
      const artifacts = db.createObjectStore("artifacts", { keyPath: "id" });
      artifacts.createIndex("runId", "runId");
    };
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 4200;
    const ctx = canvas.getContext("2d");
    for (const [index, color] of ["#e2e8f0", "#fbbf24", "#38bdf8"].entries()) {
      ctx.fillStyle = color;
      ctx.fillRect(0, index * 1400, 1600, 1400);
      ctx.fillStyle = "#172338";
      ctx.font = "bold 70px sans-serif";
      ctx.fillText(["Top", "Middle", "Bottom"][index], 80, index * 1400 + 160);
    }
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    const transaction = db.transaction(["runs", "artifacts"], "readwrite");
    transaction.objectStore("runs").put({
      id: "preview & capture",
      recipeId: "quick",
      projectId: "default",
      trigger: "manual",
      status: "success",
      startedAt: "2026-10-05T17:22:45.128Z",
      recordCount: 1,
      records: [{ text: "Saved article text <script> stays readable." }],
      errors: [],
      warnings: [],
      pinned: false,
      exportState: "none",
      screenshot: {
        kind: "full-page",
        title: "Full-page fixture",
        filename: "fixture.png",
        sourceUrl: "https://fixture.test/",
      },
    });
    transaction
      .objectStore("artifacts")
      .put({
        id: "preview & capture:screenshot",
        runId: "preview & capture",
        name: "screenshot.png",
        blob,
      });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  });
  await popup.goto("https://extension.test/popup.html");
  await popup.getByRole("tab", { name: "Borrow session", exact: true }).click();
  await popup.getByLabel("File protection", { exact: true }).waitFor();
  assert.equal(await popup.getByLabel("File protection", { exact: true }).inputValue(), "encrypted");
  assert.equal(await popup.getByLabel("Approved origins (one per line)", { exact: true }).inputValue(), "https://fixture.test");
  assert.equal(await popup.getByRole("tab").count(), 6, "Borrow session shares the existing navigation");
  assert.equal(context.pages().length, 1, "Borrow session opens no browser page or window");
  assert.equal(windows.length, 0);
  assert.equal(await popup.evaluate(() => document.body.scrollWidth <= 420), true, "Six tabs fit the popup width");
  await popup.locator("main.popup-shell").screenshot({ path: path.join(output, "borrow-session-tab.png") });
  await popup.getByRole("checkbox", { name: /I approve exporting cookies/ }).scrollIntoViewIfNeeded();
  await popup.getByRole("button", { name: "Export borrowed session" }).scrollIntoViewIfNeeded();
  await popup.locator("main.popup-shell").screenshot({ path: path.join(output, "borrow-session-export.png") });
  await popup.getByLabel("PIN or passphrase", { exact: true }).fill("fixture passphrase");
  await popup.getByLabel("Confirm PIN or passphrase", { exact: true }).fill("fixture passphrase");
  await popup.getByRole("checkbox", { name: /I approve exporting cookies/ }).check();
  await popup.getByRole("button", { name: "Export borrowed session" }).click();
  await popup.getByRole("status").filter({ hasText: "Download requested" }).waitFor();
  assert.equal(sessionDownloads.length, 1);
  assert.equal(sessionDownloads[0].saveAs, true);
  const sessionText = options => Buffer.from(options.url.split(",")[1], "base64").toString("utf8");
  const borrowed = await decryptSession(sessionText(sessionDownloads[0]), "fixture passphrase");
  assert.equal(borrowed.cookies[0].value, "synthetic-only");
  assert.equal(borrowed.storage[0].localStorage[0].value, "synthetic-storage");
  assert.equal(await popup.getByLabel("PIN or passphrase", { exact: true }).inputValue(), "");
  await popup.getByLabel("File protection", { exact: true }).selectOption("plaintext");
  await popup.getByRole("button", { name: "Export borrowed session" }).click();
  await popup.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.startsWith("Download requested"));
  assert.equal(sessionDownloads.length, 2);
  assert.deepEqual(JSON.parse(sessionText(sessionDownloads[1])).cookies, borrowed.cookies);
  assert.equal(context.pages().length, 1, "Session settings and both exports remain inside the same popup");
  await popup.getByRole("tab", { name: "Inbox" }).click();
  await popup.getByAltText("Captured screenshot").waitFor();
  const inlineCopy = popup.getByRole("button", { name: "Copy image", exact: true });
  assert.equal(await inlineCopy.evaluate((button) => button.nextElementSibling.getAttribute("aria-label")), "Save screenshot PNG");
  await inlineCopy.click();
  await popup.getByText("Screenshot copied — ready to paste.").waitFor();
  assert.deepEqual(await popup.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const image = await createImageBitmap(await item.getType("image/png"));
    const size = { width: image.width, height: image.height };
    image.close(); return size;
  }), { width: 1600, height: 4200 });
  await popup.evaluate(() => {
    window.resizeSamples = [];
    const start = performance.now();
    const sample = () => {
      window.resizeSamples.push(document.body.getBoundingClientRect().width);
      if (performance.now() - start < 800) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await popup.getByRole("button", { name: "Expand preview" }).click();
  preview = popup.locator('.preview-embedded');
  await popup.waitForFunction(
    () =>
      !document.querySelector("main").getAttribute("aria-busy") ||
      document.querySelector("main").getAttribute("aria-busy") === "false",
  );
  assert.equal(windows.length, 0, 'Preview stays in the existing pane');
  assert.equal(context.pages().length, 1, 'No extra tab or window');
  await popup.waitForFunction(() => Math.abs(document.body.getBoundingClientRect().width - 780) < 1);
  assert.ok(await popup.evaluate(() => resizeSamples.some(width => width > 420 && width < 779)), 'Pane animates through intermediate sizes');
  await preview.getByText("1600 × 4200 px").waitFor();
  await preview.getByRole("button", { name: "Copy image", exact: true }).click();
  await preview.getByText("Screenshot copied — ready to paste.").waitFor();
  const copiedImage = await preview.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const png = await item.getType("image/png");
    const image = await createImageBitmap(png);
    const size = { width: image.width, height: image.height, type: png.type };
    image.close();
    return size;
  });
  assert.deepEqual(copiedImage, { width: 1600, height: 4200, type: "image/png" });
  assert.equal(
    await preview.getByRole("heading", { level: 1 }).textContent(),
    "Screenshot · Full-page fixture",
  );
  const image = preview.getByAltText("Captured screenshot");
  assert.equal(await image.evaluate((img) => img.naturalHeight), 4200);
  const content = preview.locator(".preview-content");
  assert.equal(
    await content.evaluate((el) => el.scrollHeight > el.clientHeight),
    true,
  );
  await popup.locator('.popup-shell').screenshot({ path: path.join(output, "expanded-preview.png") });
  await preview.getByRole("button", { name: "Actual size" }).click();
  assert.equal(
    await image.evaluate((img) => img.getBoundingClientRect().width),
    1600,
  );
  await preview.getByRole("button", { name: "Zoom in" }).click();
  assert.equal(
    await image.evaluate((img) => img.getBoundingClientRect().width),
    2000,
  );
  assert.equal(
    await content.evaluate((el) => el.scrollWidth > el.clientWidth),
    true,
  );
  await content.evaluate((el) => (el.scrollTop = el.scrollHeight));
  assert.equal(await content.evaluate((el) => el.scrollTop > 0), true);
  await preview.getByRole("button", { name: "Fit width" }).click();
  await popup.setViewportSize({ width: 500, height: 600 });
  await popup.evaluate(() => Object.defineProperty(screen, 'availWidth', { configurable: true, value: 500 }));
  await preview.getByRole('button', { name: 'Text', exact: true }).click();
  await preview.getByRole('button', { name: 'Screenshot', exact: true }).click();
  await popup.waitForFunction(() => Math.abs(document.body.getBoundingClientRect().width - 480) < 1);
  assert.ok(
    (await image.evaluate((img) => img.getBoundingClientRect().width)) <= 472,
  );
  assert.equal(
    await popup.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await preview.getByRole("button", { name: "Text", exact: true }).click();
  await preview
    .getByText("Saved article text <script> stays readable.")
    .waitFor();
  await preview.getByRole("button", { name: "Save PNG…" }).click();
  await preview.getByText("Screenshot saved to device.").waitFor();
  assert.deepEqual(exports, ["preview & capture"]);
  await preview.getByRole('button', { name: '← Back to Inbox' }).click();
  await popup.waitForFunction(() => Math.abs(document.body.getBoundingClientRect().width - 420) < 1);
  assert.equal(await popup.getByRole('button', { name: 'Expand preview' }).evaluate(node => node === document.activeElement), true, 'Back restores focus');
  assert.equal(await popup.locator('.run-list-item.is-selected').count(), 1, 'Selected capture stays selected');
  await popup.getByRole('button', { name: 'Expand preview' }).click();
  await preview.getByRole('button', { name: '← Back to Inbox' }).waitFor();
  await popup.keyboard.press('Escape');
  await preview.waitFor({ state: 'detached' });
  await popup.emulateMedia({ reducedMotion: 'reduce' });
  await popup.getByRole('button', { name: 'Expand preview' }).click();
  assert.equal(await popup.evaluate(() => getComputedStyle(document.body).transitionDuration), '0s');
  assert.equal(await popup.locator('.popup-expanded-preview').evaluate(node => getComputedStyle(node).animationName), 'none');
  await popup.getByRole('button', { name: '← Back to Inbox' }).click();
  await popup.goto(
    "https://extension.test/preview.html?run=expired&view=screenshot",
  );
  await popup
    .getByRole("alert")
    .filter({ hasText: "no longer in the Inbox" })
    .waitFor();
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        build,
        checks: [
          "Compiled inbox expands selected capture in the same pane with zero window/tab creation",
          "Real IndexedDB screenshot loads inside the existing pane",
          "Animation passes through intermediate widths",
          "Back and Escape restore compact pane, selection and keyboard focus",
          "Reduced-motion disables expansion and reveal animation",
          "Copy image writes a 1600 by 4200 PNG to the real clipboard",
          "Full-height image scrolling",
          "Native size and 125% zoom",
          "Horizontal scrolling",
          "Fit width on narrow screen",
          "Text/screenshot switching",
          "Export command targets selected capture",
          "Expired capture message",
          "No browser page errors",
        ],
        windowAPIs:
          "Page-based popup resizing test; installed Zen/Firefox toolbar resizing remains unverified",
      },
      null,
      2,
    ),
  );
  console.log(
    "Preview browser checks passed: in-pane preview without new windows/tabs, animated sizing, reduced motion, Back/Escape, focus/selection restoration, IndexedDB, PNG clipboard copy, scrolling, zoom, text, export, expired captures.",
  );
} finally {
  await browser.close();
}
