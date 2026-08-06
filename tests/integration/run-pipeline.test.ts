// @vitest-environment node

import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";

import type { Project, Recipe } from "../../src/contracts/models";
import { RunService } from "../../src/run/run-service";

const project: Project = {
  id: "project-1",
  name: "Fixture project",
  createdAt: "2026-08-06T12:00:00.000Z",
  updatedAt: "2026-08-06T12:00:00.000Z",
};

const recipe: Recipe = {
  version: 1,
  id: "recipe-1",
  projectId: project.id,
  name: "Changed selector",
  origin: "http://127.0.0.1:4173",
  startUrl: "http://127.0.0.1:4173/changed-selector.html",
  mode: "both",
  containerSelector: "article.card",
  fields: [{ id: "title", name: "Title", kind: "text", selector: "h2" }],
  traversal: {
    kind: "next",
    nextSelector: "button.next",
    maxPages: 3,
    maxItems: 100,
    delayMs: 0,
    timeoutMs: 1_000,
  },
  destinations: { inbox: true, autoDownload: false },
  schedule: null,
  createdAt: "2026-08-06T12:00:00.000Z",
  updatedAt: "2026-08-06T12:00:00.000Z",
};

describe("RunService", () => {
  it("retains and exports partial data when page two changes structure", async () => {
    let page = 0;
    const saveRun = vi.fn();
    const result = await new RunService({
      now: () => new Date("2026-08-06T12:01:00.000Z"),
      createId: () => "run-1",
      saveRun,
    }).execute({
      project,
      recipe,
      trigger: "manual",
      page: {
        cancelled: () => false,
        wait: async () => {},
        advanceNext: async () => {
          page += 1;
          return "advanced";
        },
        advanceScroll: async () => "complete",
        capturePage: async () =>
          page === 0
            ? { selectorMatched: true, records: [{ title: "Alpha" }] }
            : { selectorMatched: false, records: [] },
        captureDesign: async () => ({
          html: '<article class="card"><h2>Alpha</h2></article>',
          css: '[data-scrapeyy-node="0"] { color: rgb(0, 0, 0); }',
          width: 240,
          height: 80,
          viewport: { width: 1280, height: 720, devicePixelRatio: 1 },
          assets: [],
        }),
      },
    });

    expect(result.run.status).toBe("partial");
    expect(result.run.records).toEqual([{ title: "Alpha" }]);
    expect(saveRun).toHaveBeenCalledWith(result.run);
    const zip = await JSZip.loadAsync(await result.bundle.arrayBuffer());
    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining([
        "manifest.json",
        "data.json",
        "data.csv",
        "snapshot.html",
        "styles.css",
      ]),
    );
  });
});
