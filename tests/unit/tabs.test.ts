import { beforeEach, describe, expect, it, vi } from "vitest";

const tabApi = vi.hoisted(() => ({
  query: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
  onUpdated: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
}));

vi.mock("../../src/platform/browser-api", () => ({
  extensionBrowser: { tabs: tabApi },
}));

import {
  acquireRecipeTab,
  releaseRecipeTab,
} from "../../src/platform/tabs";

describe("recipe tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tabApi.get.mockResolvedValue({ id: 42, status: "complete" });
  });

  it("always creates and later closes a dedicated inactive worker tab", async () => {
    tabApi.create.mockResolvedValue({ id: 42, status: "complete" });

    const acquired = await acquireRecipeTab(
      "https://example.test/list",
      "https://example.test",
      { dedicated: true },
    );
    await releaseRecipeTab(acquired);

    expect(tabApi.query).not.toHaveBeenCalled();
    expect(tabApi.create).toHaveBeenCalledWith({
      url: "https://example.test/list",
      active: false,
    });
    expect(tabApi.remove).toHaveBeenCalledWith(42);
  });

  it("continues to reuse an existing origin tab without the worker option", async () => {
    tabApi.query.mockResolvedValue([
      { id: 7, url: "https://example.test/list", status: "complete" },
    ]);
    tabApi.get.mockResolvedValue({ id: 7, status: "complete" });

    const acquired = await acquireRecipeTab(
      "https://example.test/list",
      "https://example.test",
    );

    expect(acquired).toEqual({ tabId: 7, created: false });
    expect(tabApi.create).not.toHaveBeenCalled();
  });
});
