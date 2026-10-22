// Run with Node and Playwright installed, or set PLAYWRIGHT_MODULE to its module URL.
// Every active icon is derived from the same approved master, without redrawing it.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const master = new URL("../docs/branding/scrapeyy-icon.png", import.meta.url);
const output = new URL("../public/icon/", import.meta.url);
await mkdir(output, { recursive: true });
const dataUrl = `data:image/png;base64,${(await readFile(master)).toString("base64")}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const size of [16, 32, 48, 96, 128]) {
    const png = await page.evaluate(async ({ dataUrl, size }) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, size, size);
      return canvas.toDataURL("image/png").split(",")[1];
    }, { dataUrl, size });
    const target = new URL(`${size}.png`, output);
    await writeFile(target, Buffer.from(png, "base64"));
    console.log(fileURLToPath(target));
  }
} finally {
  await browser.close();
}
