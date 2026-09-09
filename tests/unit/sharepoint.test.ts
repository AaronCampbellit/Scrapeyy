import { describe, expect, it, vi } from "vitest";

import {
  isSharePointUrl,
  isSharePointMetadata,
  scrapeSharePointMetadata,
  sharePointMetadataText,
} from "../../src/sharepoint/scrape";

describe("SharePoint scraper", () => {
  it("extracts site, web, and library metadata from a library URL", async () => {
    const fetchJson = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/_api/site")
        ? { Id: "{site-id}" }
        : url.includes("/_api/web?")
          ? {
              Id: "{web-id}",
              Url: "https://tenant.sharepoint.com/sites/Finance",
              Title: "Finance",
            }
          : { Id: "{list-id}", Title: "Documents" };
      return new Response(JSON.stringify(body), { status: 200 });
    });

    const result = await scrapeSharePointMetadata(
      new URL(
        "https://tenant.sharepoint.com/sites/Finance/Shared%20Documents/Forms/AllItems.aspx",
      ),
      fetchJson,
    );

    expect(result).toEqual({
      SiteId: "site-id",
      WebId: "web-id",
      ListId: "list-id",
      WebUrl: "https://tenant.sharepoint.com/sites/Finance",
      WebTitle: "Finance",
      ListTitle: "Documents",
    });
    expect(fetchJson).toHaveBeenCalledWith(
      expect.stringContaining("%2Fsites%2FFinance%2FShared%20Documents"),
      expect.objectContaining({ credentials: "same-origin" }),
    );
    expect(sharePointMetadataText(result)).toContain("ListTitle: Documents");
    expect(isSharePointMetadata(result)).toBe(true);
  });

  it("rejects non-SharePoint pages and site homepages", async () => {
    expect(isSharePointUrl("https://example.test/list")).toBe(false);
    await expect(
      scrapeSharePointMetadata(
        new URL("https://tenant.sharepoint.com/sites/Finance"),
        vi.fn(),
      ),
    ).rejects.toThrow("document library");
  });
});
