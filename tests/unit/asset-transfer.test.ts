// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { fetchReferenceAssets } from "../../src/platform/asset-transfer";

const image = (url: string) => ({ url, kind: "image" as const });
const png = () => new Response("image bytes", { headers: { "content-type": "image/png" } });
describe("asset transport", () => {
  it("upgrades HTTP without cookies, referrer, redirects or plaintext fallback", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("redirect with a secret"));
    const result = await fetchReferenceAssets([image("http://intranet.test/photo.png?token=secret")], 100, fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("https://intranet.test/photo.png?token=secret", expect.objectContaining({
      credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
    }));
    expect(result.assets).toEqual([]);
    expect(result.warnings.join()).not.toContain("secret");
    expect(result.warnings.join()).toContain("reference retained");
  });
  it("keeps authenticated HTTPS assets, preserving the original reference", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => png());
    const result = await fetchReferenceAssets([image("https://intranet.test/photo.png")], 100, fetcher);
    expect(fetcher).toHaveBeenCalledWith("https://intranet.test/photo.png", expect.objectContaining({ credentials: "include", redirect: "error" }));
    expect(atob(result.assets[0]!.base64)).toBe("image bytes");
  });
  it("recovers loaded HTTP pixels without loading another image", async () => {
    const drawImage = vi.fn();
    const node = { src: "http://intranet.test/image.svg", currentSrc: "", complete: true, naturalWidth: 40, naturalHeight: 20 };
    const doc = { images: [node], createElement: vi.fn(() => ({ getContext: () => ({ drawImage }), toDataURL: () => "data:image/png;base64,cG5n" })) } as unknown as Document;
    const result = await fetchReferenceAssets([image(node.src)], 100, vi.fn().mockRejectedValue(new Error()), doc);
    expect(drawImage).toHaveBeenCalledWith(node, 0, 0);
    expect(result.assets[0]).toMatchObject({ mimeType: "image/png", base64: "cG5n", rendered: true });
    expect(result.warnings.join()).toContain("not the original");
  });
  it("retains references when loaded pixels are cross-origin/tainted", async () => {
    const doc = { images: [{ src: "http://cdn.test/a.png", complete: true, naturalWidth: 1, naturalHeight: 1 }],
      createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL() { throw new Error("tainted"); } }) } as unknown as Document;
    const result = await fetchReferenceAssets([image("http://cdn.test/a.png")], 100, vi.fn().mockRejectedValue(new Error()), doc);
    expect(result.assets).toEqual([]);
    expect(result.warnings.join()).toContain("reference retained");
  });
  it("rejects userinfo and non-network schemes without a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await fetchReferenceAssets([image("https://user:password@example.test/a.png"), image("file:///secret"), image("data:image/png,secret")], 100, fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.warnings).toHaveLength(3);
  });
  it("enforces size while streaming even without content-length", async () => {
    const result = await fetchReferenceAssets([image("https://site.test/a.png")], 2, vi.fn().mockImplementation(async () => png()));
    expect(result.assets).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });
  it("runs after serialization without module closures", async () => {
    const injected = new Function(`return (${fetchReferenceAssets.toString()})`)() as typeof fetchReferenceAssets;
    const result = await injected([image("https://site.test/a.png")], 100, vi.fn().mockImplementation(async () => png()));
    expect(result.assets).toHaveLength(1);
  });
});
