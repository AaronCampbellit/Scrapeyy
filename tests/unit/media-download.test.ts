// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("../../src/platform/browser-api", () => ({ extensionBrowser: {} }));
import { downloadMediaFile } from "../../src/platform/media-download";
describe("media download transport", () => {
  it("upgrades HTTP anonymously and saves only retrieved bytes locally", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("video"));
    const save = vi.fn().mockResolvedValue(5);
    expect(await downloadMediaFile("http://site.test/video.mp4", "video.mp4", true, fetcher, save)).toBe(5);
    expect(fetcher).toHaveBeenCalledWith("https://site.test/video.mp4", expect.objectContaining({ credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" }));
    expect(await (save.mock.calls[0]![0] as Blob).text()).toBe("video");
  });
  it("does not create a browser download after a rejected redirect or oversized response", async () => {
    const save = vi.fn();
    for (const fetcher of [vi.fn().mockRejectedValue(new Error("redirect")), vi.fn().mockResolvedValue(new Response("video", { headers: { "content-length": String(513 * 1024 * 1024) } }))]) {
      await expect(downloadMediaFile("https://site.test/video.mp4", "video.mp4", true, fetcher, save)).rejects.toThrow("link remains");
    }
    expect(save).not.toHaveBeenCalled();
  });
  it("rejects embedded credentials without making a network request", async () => {
    const fetcher = vi.fn();
    await expect(downloadMediaFile("https://user:secret@site.test/a.mp4", "a.mp4", true, fetcher)).rejects.toThrow("Unsupported");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
