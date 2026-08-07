import { describe, expect, it, vi } from "vitest";

import { downloadReferencedAssetsFromPage } from "../../src/platform/page-asset-download";

describe("page asset download", () => {
  it("fetches referenced assets in the page world and decodes them for storage", async () => {
    const executeScript = vi.fn().mockResolvedValue([
      {
        result: {
          assets: [
            {
              url: "https://example.test/reference-image.svg",
              mimeType: "image/svg+xml",
              base64: btoa("<svg></svg>"),
            },
          ],
          warnings: ["Could not download https://example.test/missing.png"],
        },
      },
    ]);

    const result = await downloadReferencedAssetsFromPage(
      42,
      [
        { url: "https://example.test/missing.png", kind: "image" },
        { url: "https://example.test/reference-image.svg", kind: "image" },
        { url: "https://example.test/reference-image.svg", kind: "image" },
      ],
      { executeScript },
    );

    expect(executeScript).toHaveBeenCalledOnce();
    expect(executeScript.mock.calls[0]![0]).toMatchObject({
      target: { tabId: 42 },
      world: "MAIN",
      args: [
        [
          { url: "https://example.test/missing.png", kind: "image" },
          {
            url: "https://example.test/reference-image.svg",
            kind: "image",
          },
        ],
        25 * 1024 * 1024,
      ],
    });
    expect(result.warnings).toEqual([
      "Could not download https://example.test/missing.png",
    ]);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).toMatchObject({
      url: "https://example.test/reference-image.svg",
      filename: "001-reference-image.svg",
    });
    expect(await result.assets[0]!.blob.text()).toBe("<svg></svg>");
  });

  it("does not inject a page script when there are no references", async () => {
    const executeScript = vi.fn();

    await expect(
      downloadReferencedAssetsFromPage(42, [], { executeScript }),
    ).resolves.toEqual({ assets: [], warnings: [] });
    expect(executeScript).not.toHaveBeenCalled();
  });
});
