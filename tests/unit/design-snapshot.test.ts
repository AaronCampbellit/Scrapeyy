import { beforeEach, describe, expect, it } from "vitest";

import { collectAssetReferences } from "../../src/design/assets";
import { sanitizeElement } from "../../src/design/sanitize";
import { createDesignSnapshot } from "../../src/design/snapshot";

describe("design reference capture", () => {
  beforeEach(() => {
    document.head.innerHTML = '<base href="https://example.test/catalog/">';
    document.body.innerHTML = "";
  });

  it("removes executable and secret-bearing content", () => {
    document.body.innerHTML = `
      <section onclick="steal()">
        <script>steal()</script>
        <iframe src="https://evil.test"></iframe>
        <input type="password" value="secret">
        <input type="hidden" name="csrf_token" value="token">
        <input type="text" value="private form value">
        <a href="javascript:steal()">Bad</a>
        <img src="/safe.png" alt="Safe">
      </section>`;

    const html = sanitizeElement(document.querySelector("section")!);

    expect(html).not.toMatch(
      /script|onclick|iframe|secret|csrf|token|private form value|javascript:/i,
    );
    expect(html).toContain("/safe.png");
  });

  it("resolves safe image and source assets without duplicates", () => {
    document.body.innerHTML = `
      <picture>
        <source srcset="./hero.webp 1x, ./hero@2x.webp 2x">
        <img src="./hero.webp" alt="Hero">
      </picture>`;

    expect(collectAssetReferences(document.querySelector("picture")!)).toEqual([
      {
        kind: "image",
        url: "https://example.test/catalog/hero.webp",
      },
      {
        kind: "image",
        url: "https://example.test/catalog/hero@2x.webp",
      },
    ]);
  });

  it("creates a non-executable snapshot with dimensions and viewport metadata", async () => {
    document.body.innerHTML =
      '<article style="color: rgb(10, 20, 30)"><h2>Alpha</h2></article>';
    const element = document.querySelector("article")!;
    Object.defineProperty(element, "getBoundingClientRect", {
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 320,
        bottom: 180,
        width: 320,
        height: 180,
        toJSON: () => ({}),
      }),
    });

    const snapshot = await createDesignSnapshot(element);

    expect(snapshot.html).toContain("data-scrapeyy-node");
    expect(snapshot.css).toContain("color: rgb(10, 20, 30)");
    expect(snapshot.width).toBe(320);
    expect(snapshot.height).toBe(180);
    expect(snapshot.viewport.width).toBe(window.innerWidth);
    expect(snapshot.screenshot).toBeUndefined();
  });
});
