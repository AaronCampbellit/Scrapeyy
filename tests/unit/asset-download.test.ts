// @vitest-environment node

import { describe, expect, it } from "vitest";

import { downloadReferencedAssets } from "../../src/platform/asset-download";

describe("reference asset downloads", () => {
  it("downloads referenced images with deterministic filenames and reports failures", async () => {
    const requested: string[] = [];
    const result = await downloadReferencedAssets(
      [
        { kind: "image", url: "https://example.test/other/logo" },
        { kind: "image", url: "https://example.test/missing.png" },
        {
          kind: "image",
          url: "https://example.test/hero.png?version=2",
        },
      ],
      async (url) => {
        requested.push(String(url));
        if (String(url).includes("missing")) {
          return new Response("missing", { status: 404 });
        }
        const jpeg = String(url).endsWith("/logo");
        return new Response(jpeg ? "jpeg-bytes" : "png-bytes", {
          headers: {
            "content-type": jpeg ? "image/jpeg" : "image/png",
          },
        });
      },
    );

    expect(requested).toEqual([
      "https://example.test/hero.png?version=2",
      "https://example.test/missing.png",
      "https://example.test/other/logo",
    ]);
    expect(
      await Promise.all(
        result.assets.map(async (asset) => ({
          filename: asset.filename,
          url: asset.url,
          contents: await asset.blob.text(),
        })),
      ),
    ).toEqual([
      {
        filename: "001-hero.png",
        url: "https://example.test/hero.png?version=2",
        contents: "png-bytes",
      },
      {
        filename: "002-logo.jpg",
        url: "https://example.test/other/logo",
        contents: "jpeg-bytes",
      },
    ]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("https://example.test/missing.png");
  });
});
