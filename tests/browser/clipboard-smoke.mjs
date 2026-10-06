// Compiled Chrome copy page with real PNG clipboard writes. Runtime messaging
// is bridged; this does not claim acceptance of an installed Chrome extension.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const repo = fileURLToPath(new URL("../../", import.meta.url));
const build = path.resolve(repo, process.argv[2] || ".output/chrome-mv3");
const { version } = JSON.parse(await readFile(path.join(build, "manifest.json"), "utf8"));
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  await context.route("https://extension.test/**", async (route) => {
    const file = new URL(route.request().url()).pathname;
    await route.fulfill({
      body: file === "/seed.html" ? "<!doctype html><title>Clipboard check</title>" : await readFile(path.join(build, file)),
      contentType: file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html",
    });
  });
  const seed = await context.newPage();
  await seed.goto("https://extension.test/seed.html");
  const png = await seed.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 80; canvas.height = 40;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#00ff00"; ctx.fillRect(0, 0, 80, 40);
    return canvas.toDataURL("image/png");
  });
  const receipts = [];
  await context.exposeFunction("clipboardRuntime", (message) => {
    if (message.type === "SCRAPEYY_CLIPBOARD_IMAGE") return { png, version };
    if (message.type === "SCRAPEYY_CLIPBOARD_RESULT") receipts.push(message);
    return { received: true };
  });
  await context.addInitScript(() => {
    window.browser = { runtime: { id: "scrapeyy-test", sendMessage: (message) => window.clipboardRuntime(message) } };
  });
  const copy = await context.newPage();
  await copy.goto("https://extension.test/clipboard.html?copy=check-1");
  await copy.getByText("Screenshot copied — ready to paste.").waitFor();
  await copy.waitForTimeout(1000);
  assert.equal(receipts.at(-1)?.status, "copied");
  await seed.bringToFront();
  const actual = await seed.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const blob = await item.getType("image/png");
    const image = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
    const result = { width: image.width, height: image.height, pixel: [...ctx.getImageData(20, 20, 1, 1).data] };
    image.close(); return result;
  });
  assert.deepEqual(actual, { width: 80, height: 40, pixel: [0, 255, 0, 255] });
  await copy.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { write: async () => { throw new Error("Clipboard access denied"); } } });
  });
  await copy.goto("https://extension.test/clipboard.html?copy=check-2");
  await copy.getByText("Clipboard access denied").waitFor();
  assert.equal(receipts.at(-1)?.error, "Clipboard access denied");
  assert.equal(receipts.at(-1)?.status, undefined);
  console.log("Compiled Chrome copy page passed: actual PNG clipboard, dimensions/pixels, success receipt, denied-write error.");
} finally {
  await browser.close();
}
