import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  PopupServices,
  PopupWorkspaceData,
} from "../../src/features/popup/PopupApp";
import { PopupApp } from "../../src/features/popup/PopupApp";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../../src/storage/app-settings";
import { CAPTURE_VERSION, type ScreenshotResult } from "../../src/platform/screenshot-messages";

const data: PopupWorkspaceData = {
  site: { origin: "https://example.test", access: "one-time" },
  projects: [
    {
      id: "project-1",
      name: "Research",
      createdAt: "2026-08-06T12:00:00.000Z",
      updatedAt: "2026-08-06T12:00:00.000Z",
    },
  ],
  recipes: [
    {
      version: 1,
      id: "recipe-1",
      projectId: "project-1",
      name: "Product cards",
      origin: "https://example.test",
      startUrl: "https://example.test/products",
      mode: "data",
      containerSelector: "article.card",
      fields: [{ id: "title", name: "Title", kind: "text", selector: "h2" }],
      traversal: {
        kind: "none",
        maxPages: 1,
        maxItems: 100,
        delayMs: 0,
        timeoutMs: 10_000,
      },
      destinations: { inbox: true, autoDownload: false },
      schedule: null,
      createdAt: "2026-08-06T12:00:00.000Z",
      updatedAt: "2026-08-06T12:00:00.000Z",
    },
  ],
  runs: [
    {
      id: "run-1",
      recipeId: "recipe-1",
      projectId: "project-1",
      trigger: "manual",
      status: "success",
      startedAt: "2026-08-06T12:05:00.000Z",
      completedAt: "2026-08-06T12:05:01.000Z",
      recordCount: 1,
      records: [{ title: "Alpha" }],
      warnings: ["One reference image could not be downloaded."],
      errors: [],
      pinned: false,
      exportState: "none",
    },
  ],
  permissions: { "https://example.test": false },
  retentionLimit: 20,
  settings: {
    ...DEFAULT_APP_SETTINGS,
    theme: "dark",
    downloadBehavior: "ask",
    downloadSubfolder: "Scrapeyy",
  },
};

function services(
  overrides: Partial<PopupServices> = {},
): PopupServices {
  return {
    load: vi.fn().mockResolvedValue(data),
    startQuickCapture: vi.fn(),
    takeScreenshot: vi.fn().mockResolvedValue(undefined),
    inspectVideos: vi.fn().mockResolvedValue({ pageUrl: "https://example.test", videos: [], notes: [] }),
    downloadVideo: vi.fn().mockResolvedValue(undefined),
    exportVideoDetails: vi.fn().mockResolvedValue(undefined),
    startRecipeCapture: vi.fn(),
    resumePicker: vi.fn(),
    scrapeSharePoint: vi.fn().mockResolvedValue({
      SiteId: "site-id",
      WebId: "web-id",
      ListId: "list-id",
      WebUrl: "https://tenant.sharepoint.com/sites/Finance",
      WebTitle: "Finance",
      ListTitle: "Documents",
    }),
    runRecipe: vi.fn().mockResolvedValue(data.runs[0]),
    deleteRecipe: vi.fn(),
    saveProject: vi.fn(),
    exportRun: vi.fn(),
    deleteRun: vi.fn(),
    clearInbox: vi.fn(),
    loadRunScreenshot: vi
      .fn()
      .mockResolvedValue("data:image/png;base64,c2NyZWVuc2hvdA=="),
    openPreview: vi.fn().mockResolvedValue(undefined),
    pinRun: vi.fn(),
    requestOriginAccess: vi.fn().mockResolvedValue(true),
    revokeOriginAccess: vi.fn(),
    exportConfiguration: vi.fn(),
    importConfiguration: vi.fn(),
    saveSettings: vi.fn().mockImplementation(async (settings: AppSettings) => settings),
    ...overrides,
  };
}

describe("PopupApp", () => {
  it("persists screenshot destinations separately and previews an inbox PNG without recipe retry", async () => {
    const user = userEvent.setup();
    const run = { ...data.runs[0]!, id: "png", recordCount: 0, records: [], screenshot: {
      kind: "visible" as const, title: "Example page", filename: "example.png", sourceUrl: "https://example.test/",
    } };
    const api = services({ load: vi.fn().mockResolvedValue({ ...data, runs: [run] }) });
    render(<PopupApp services={api} />);
    await screen.findByText("Current site");
    await user.selectOptions(screen.getByRole("combobox", { name: "Save screenshots to" }), "inbox");
    expect(api.saveSettings).toHaveBeenCalledWith({ ...data.settings, screenshotDestination: "inbox" });
    await user.click(screen.getByRole("tab", { name: "Inbox" }));
    expect(await screen.findByAltText("Captured screenshot")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Pop out preview" }));
    expect(api.openPreview).toHaveBeenCalledWith("png", "screenshot");
    await user.click(screen.getByRole("button", { name: /^Text$/ }));
    await user.click(screen.getByRole("button", { name: "Pop out preview" }));
    expect(api.openPreview).toHaveBeenLastCalledWith("png", "text");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save screenshot PNG" }));
    expect(api.exportRun).toHaveBeenCalledWith("png");
  });

  it("lets automatic screenshots use a separate folder and rejects absolute paths", async () => {
    const user = userEvent.setup();
    const api = services();
    render(<PopupApp services={api} />);
    await screen.findByText("Current site");
    await user.click(screen.getByRole("tab", { name: "Settings" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Save screenshots to" }), "automatic");
    const folder = screen.getByRole("textbox", { name: "Screenshot subfolder" });
    await user.clear(folder); await user.type(folder, "C:/Pictures");
    expect(screen.getByRole("button", { name: "Save screenshot location" })).toBeDisabled();
    await user.clear(folder); await user.type(folder, "Screenshots/Research");
    await user.click(screen.getByRole("button", { name: "Save screenshot location" }));
    expect(api.saveSettings).toHaveBeenLastCalledWith({ ...data.settings, screenshotDestination: "automatic", screenshotSubfolder: "Screenshots/Research" });
  });

  it("shows the real screenshot path only after saving completes", async () => {
    const user = userEvent.setup();
    let finish!: (result: ScreenshotResult) => void;
    const api = services({ takeScreenshot: () => new Promise<ScreenshotResult>((resolve) => { finish = resolve; }) });
    render(<PopupApp services={api} />);
    await screen.findByText("Current site");
    await user.click(screen.getByRole("button", { name: "Visible page" }));
    expect(screen.getByText("Saving screenshot…")).toBeVisible();
    expect(screen.queryByText(/Screenshot saved:/)).not.toBeInTheDocument();
    finish({ status: "saved", version: CAPTURE_VERSION, downloadId: 1, filename: "C:/Downloads/Scrapeyy/Screenshots/test.png" });
    expect(await screen.findByText("Screenshot saved: C:/Downloads/Scrapeyy/Screenshots/test.png")).toBeVisible();
  });

  it("shows screenshot failures without claiming a download", async () => {
    const user = userEvent.setup();
    render(<PopupApp services={services({ takeScreenshot: vi.fn().mockRejectedValue(new Error("Reload Scrapeyy in Zen.")) })} />);
    await screen.findByText("Current site");
    await user.click(screen.getByRole("button", { name: "Draw selection" }));
    expect(await screen.findByText("Reload Scrapeyy in Zen.")).toBeVisible();
    expect(screen.queryByText(/Screenshot saved:/)).not.toBeInTheDocument();
  });

  it("automatically restores a minimized on-page recipe", async () => {
    const resumePicker = vi.fn().mockResolvedValue(undefined);
    const appServices = services({
      load: vi.fn().mockResolvedValue({
        ...data,
        activePicker: { variant: "recipe", minimized: true },
      }),
      resumePicker,
    });

    render(<PopupApp services={appServices} />);

    await waitFor(() => expect(resumePicker).toHaveBeenCalledOnce());
  });

  it("starts simple and advanced capture without a dashboard action", async () => {
    const user = userEvent.setup();
    const api = services();
    render(<PopupApp services={api} />);

    expect(await screen.findByText("Current site")).toBeVisible();
    expect(screen.queryByText(/Open Dashboard/i)).toBeNull();
    expect(
      screen.getByText("Click an element, drag a region, or choose the full page"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Quick Capture" }));
    expect(api.startQuickCapture).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Create Recipe" }));
    await waitFor(() => expect(api.startRecipeCapture).toHaveBeenCalledWith());
    expect(api.requestOriginAccess).toHaveBeenCalledWith("https://example.test");

    await user.click(screen.getByRole("tab", { name: "SharePoint" }));
    await user.click(screen.getByRole("button", { name: "Scrape SharePoint details" }));
    expect(api.scrapeSharePoint).toHaveBeenCalledOnce();
    expect(await screen.findByText("Documents")).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy ListTitle" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Copy all SharePoint details" }),
    ).toBeVisible();
  });

  it("requests website access before starting a manual worker-tab run", async () => {
    const user = userEvent.setup();
    const requestOriginAccess = vi.fn().mockResolvedValue(true);
    const runRecipe = vi.fn().mockResolvedValue(data.runs[0]);
    const api = services({
      load: vi.fn().mockResolvedValue({
        ...data,
        recipes: [{ ...data.recipes[0]!, manualRunInWorkerTab: true }],
        permissions: { "https://example.test": false },
      }),
      requestOriginAccess,
      runRecipe,
    });
    render(<PopupApp services={api} />);

    await user.click(await screen.findByRole("tab", { name: "Recipes" }));
    await user.click(screen.getByRole("button", { name: "Run Product cards" }));

    await waitFor(() => {
      expect(requestOriginAccess).toHaveBeenCalledWith("https://example.test");
      expect(runRecipe).toHaveBeenCalledWith("recipe-1");
    });
  });

  it("restores saved SharePoint output and copies individual values", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const saved = {
      SiteId: "saved-site-id",
      WebId: "saved-web-id",
      ListId: "saved-list-id",
      WebUrl: "https://tenant.sharepoint.com/sites/Finance",
      WebTitle: "Finance",
      ListTitle: "Documents",
    };
    render(
      <PopupApp
        services={services({
          load: vi.fn().mockResolvedValue({
            ...data,
            sharePointMetadata: saved,
          }),
        })}
      />,
    );

    await user.click(await screen.findByRole("tab", { name: "SharePoint" }));
    await user.click(await screen.findByRole("button", { name: "Copy ListId" }));
    expect(writeText).toHaveBeenCalledWith("saved-list-id");

    await user.click(
      screen.getByRole("button", { name: "Copy all SharePoint details" }),
    );
    expect(writeText).toHaveBeenLastCalledWith(
      expect.stringContaining("ListTitle: Documents"),
    );
  });

  it("orders inbox before recipes and keeps SharePoint in its own tab", async () => {
    const user = userEvent.setup();
    const api = services();
    render(<PopupApp services={api} />);
    await screen.findByText("Current site");

    expect(
      screen.getAllByRole("tab").map((tab) => tab.getAttribute("aria-label")),
    ).toEqual(["Capture", "Inbox", "Recipes", "SharePoint", "Settings"]);

    await user.click(screen.getByRole("tab", { name: "Inbox" }));
    expect(screen.getByLabelText("Selected capture")).toBeVisible();
    expect(screen.getByLabelText("Capture list")).toBeVisible();
    expect(
      screen.getByLabelText("Selected capture").compareDocumentPosition(
        screen.getByLabelText("Capture list"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Preview")).toBeVisible();
    expect(screen.getByText(/title: Alpha/)).toBeVisible();
    expect(
      screen.getByText("One reference image could not be downloaded."),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Screenshot" }));
    expect(
      await screen.findByRole("img", { name: "Captured screenshot" }),
    ).toHaveAttribute(
      "src",
      "data:image/png;base64,c2NyZWVuc2hvdA==",
    );

    await user.click(screen.getByRole("button", { name: "Export run" }));
    expect(api.exportRun).toHaveBeenCalledWith("run-1");

    await user.click(screen.getByRole("tab", { name: "Recipes" }));
    expect(screen.getByText("Product cards")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Run Product cards" }));
    expect(api.runRecipe).toHaveBeenCalledWith("recipe-1");

    await user.click(screen.getByRole("tab", { name: "Settings" }));
    expect(screen.getByText("Website access")).toBeVisible();
    expect(screen.getByText("Keep the latest 20 runs")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Allow access" }));
    expect(api.requestOriginAccess).toHaveBeenCalledWith("https://example.test");
  });

  it("clears unpinned inbox runs after confirmation", async () => {
    const user = userEvent.setup();
    const api = services();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PopupApp services={api} />);
    await screen.findByText("Current site");

    await user.click(screen.getByRole("tab", { name: "Inbox" }));
    await user.click(screen.getByRole("button", { name: "Clear inbox" }));

    expect(confirm).toHaveBeenCalledWith(
      "Delete every unpinned capture from the inbox? This cannot be undone.",
    );
    expect(api.clearInbox).toHaveBeenCalledOnce();
  });

  it("clears one specific capture from the bottom capture list", async () => {
    const user = userEvent.setup();
    const api = services();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PopupApp services={api} />);
    await screen.findByText("Current site");

    await user.click(screen.getByRole("tab", { name: "Inbox" }));
    await user.click(
      screen.getByRole("button", { name: "Clear capture Product cards" }),
    );

    expect(confirm).toHaveBeenCalledWith(
      "Clear “Product cards” from the inbox? This cannot be undone.",
    );
    expect(api.deleteRun).toHaveBeenCalledWith("run-1");
  });

  it("deletes one saved recipe after confirmation", async () => {
    const user = userEvent.setup();
    const api = services();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PopupApp services={api} />);
    await screen.findByText("Current site");

    await user.click(screen.getByRole("tab", { name: "Recipes" }));
    await user.click(screen.getByRole("button", { name: "Delete Product cards" }));

    expect(confirm).toHaveBeenCalledWith(
      "Delete “Product cards”? Scheduled runs for this recipe will also stop. This cannot be undone.",
    );
    expect(api.deleteRecipe).toHaveBeenCalledWith("recipe-1");
  });

  it("defaults to dark mode and persists appearance and download choices", async () => {
    const user = userEvent.setup();
    const api = services();
    const { container } = render(<PopupApp services={api} />);

    await screen.findByText("Current site");
    expect(container.querySelector(".popup-shell")).toHaveAttribute(
      "data-theme",
      "dark",
    );

    await user.click(screen.getByRole("tab", { name: "Settings" }));
    await user.click(screen.getByRole("switch", { name: "Dark mode" }));
    await waitFor(() =>
      expect(api.saveSettings).toHaveBeenCalledWith({
        ...DEFAULT_APP_SETTINGS,
        theme: "light",
        downloadBehavior: "ask",
        downloadSubfolder: "Scrapeyy",
      }),
    );
    expect(container.querySelector(".popup-shell")).toHaveAttribute(
      "data-theme",
      "light",
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Download behavior" }),
      "automatic",
    );
    await user.clear(screen.getByRole("textbox", { name: "Download subfolder" }));
    await user.type(
      screen.getByRole("textbox", { name: "Download subfolder" }),
      "Client Reports",
    );
    await user.click(screen.getByRole("button", { name: "Save download location" }));

    await waitFor(() =>
      expect(api.saveSettings).toHaveBeenLastCalledWith({
        ...DEFAULT_APP_SETTINGS,
        theme: "light",
        downloadBehavior: "automatic",
        downloadSubfolder: "Client Reports",
      }),
    );
  });

  it("keeps the popup open and explains picker-start failures", async () => {
    const user = userEvent.setup();
    const api = services({
      startQuickCapture: vi
        .fn()
        .mockRejectedValue(new Error("Scrapeyy could not start on this page")),
    });
    render(<PopupApp services={api} />);
    await screen.findByText("Current site");

    await user.click(screen.getByRole("button", { name: "Quick Capture" }));

    await waitFor(() =>
      expect(
        screen.getByText("Scrapeyy could not start on this page"),
      ).toBeVisible(),
    );
  });
});
