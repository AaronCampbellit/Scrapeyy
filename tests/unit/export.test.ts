// @vitest-environment node

import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import type {
  CaptureRun,
  FieldDefinition,
  Project,
  Recipe,
} from "../../src/contracts/models";
import type { DesignSnapshot } from "../../src/design/snapshot";
import { buildRunBundle } from "../../src/export/bundle";
import { serializeCsv } from "../../src/export/csv";
import { buildDownloadPath } from "../../src/export/filename";

const fields: FieldDefinition[] = [
  { id: "title", name: "Title", kind: "text", selector: "h2" },
  { id: "url", name: "URL", kind: "link", selector: "a" },
];
const project: Project = {
  id: "project-1",
  name: "../Acme",
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
};
const recipe: Recipe = {
  version: 1,
  id: "recipe-1",
  projectId: "project-1",
  name: "Products/2026",
  origin: "https://example.test",
  startUrl: "https://example.test/list",
  mode: "both",
  containerSelector: ".card",
  fields,
  traversal: {
    kind: "none",
    maxPages: 1,
    maxItems: 100,
    delayMs: 0,
    timeoutMs: 10_000,
  },
  destinations: { inbox: true, autoDownload: false },
  schedule: null,
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
};
const run: CaptureRun = {
  id: "run-1",
  recipeId: "recipe-1",
  projectId: "project-1",
  trigger: "manual",
  status: "success",
  startedAt: "2026-08-06T12:00:00.000Z",
  completedAt: "2026-08-06T12:00:01.000Z",
  recordCount: 1,
  records: [{ title: 'A, "B"', url: null }],
  errors: [],
  pinned: false,
  exportState: "none",
};
const design: DesignSnapshot = {
  html: '<article data-scrapeyy-node="1">A</article>',
  css: '[data-scrapeyy-node="1"] { color: red; }',
  width: 320,
  height: 180,
  viewport: { width: 1280, height: 720, devicePixelRatio: 2 },
  assets: [{ kind: "image", url: "https://example.test/hero.png" }],
  screenshot: new Blob(["png"], { type: "image/png" }),
};

describe("capture exports", () => {
  it("escapes CSV values and preserves recipe field order", () => {
    expect(serializeCsv(run.records, fields)).toBe(
      'Title,URL\r\n"A, ""B""",\r\n',
    );
  });

  it("neutralizes spreadsheet formulas in captured values", () => {
    expect(
      serializeCsv([{ title: "=HYPERLINK(\"bad\")", url: null }], fields),
    ).toBe('Title,URL\r\n"\'=HYPERLINK(""bad"")",\r\n');
  });

  it("creates a safe relative download path", () => {
    expect(buildDownloadPath(project, recipe, run)).toBe(
      "Scrapeyy/Acme/Products-2026/2026-08-06T12-00-00Z/scrapeyy-run.zip",
    );
  });

  it("includes structured and design artifacts for Both mode", async () => {
    const bundle = await buildRunBundle({ project, recipe, run, design });
    const zip = await JSZip.loadAsync(await bundle.arrayBuffer());

    expect(Object.keys(zip.files).sort()).toEqual([
      "assets.json",
      "data.csv",
      "data.json",
      "manifest.json",
      "screenshot.png",
      "snapshot.html",
      "styles.css",
    ]);
    expect(await zip.file("data.csv")?.async("string")).toBe(
      'Title,URL\r\n"A, ""B""",\r\n',
    );
  });

  it("produces byte-identical bundles for the same run", async () => {
    const first = new Uint8Array(
      await (await buildRunBundle({ project, recipe, run, design })).arrayBuffer(),
    );
    const second = new Uint8Array(
      await (await buildRunBundle({ project, recipe, run, design })).arrayBuffer(),
    );

    expect(second).toEqual(first);
  });
});
