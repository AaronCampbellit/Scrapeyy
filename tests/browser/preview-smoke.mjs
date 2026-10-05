// Exercises compiled pages and real IndexedDB. WebExtension window/storage/
// export APIs are bridged to Playwright; this is not an installed add-on test.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
        query: async () => [{ id: 1, url: "https://fixture.test/" }],
        sendMessage: async () => ({ active: false }),
      },
      permissions: { contains: async () => false },
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
  await popup.getByRole("tab", { name: "Inbox" }).click();
  await popup.getByAltText("Captured screenshot").waitFor();
  await popup.getByRole("button", { name: "Pop out preview" }).click();
  await popup.waitForFunction(
    () =>
      !document.querySelector("main").getAttribute("aria-busy") ||
      document.querySelector("main").getAttribute("aria-busy") === "false",
  );
  assert.equal(windows.length, 1);
  assert.equal(windows[0].type, "popup");
  assert.equal(
    new URL(windows[0].url).searchParams.get("run"),
    "preview & capture",
  );
  await preview.getByText("1600 × 4200 px").waitFor();
  await popup.close();
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
  await preview.screenshot({ path: path.join(output, "preview-window.png") });
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
  await preview.setViewportSize({ width: 500, height: 600 });
  assert.ok(
    (await image.evaluate((img) => img.getBoundingClientRect().width)) <= 472,
  );
  assert.equal(
    await preview.evaluate(
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
  await preview.goto(
    "https://extension.test/preview.html?run=expired&view=screenshot",
  );
  await preview
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
          "Compiled inbox opens selected capture in separate window",
          "Real IndexedDB screenshot survives inbox close",
          "Full-height image scrolling",
          "Native size and 125% zoom",
          "Horizontal scrolling",
          "Fit width on narrow window",
          "Text/screenshot switching",
          "Export command targets selected capture",
          "Expired capture message",
          "No browser page errors",
        ],
        windowAPIs:
          "Simulated with Playwright pages; installed Zen/Firefox window behavior remains unverified",
      },
      null,
      2,
    ),
  );
  console.log(
    "Preview browser checks passed: window opening, independent IndexedDB loading, long-image scrolling, zoom, resizing, text, export, expired captures.",
  );
} finally {
  await browser.close();
}
