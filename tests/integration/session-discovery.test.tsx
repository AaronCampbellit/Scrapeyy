import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BorrowSessionView } from "../../src/features/popup/BorrowSessionView";
import type { DiscoveryClient, DiscoveryState } from "../../src/session/discovery";
const site = { origin: "https://manage.example.com", tabId: 7, access: "one-time" as const };
const saved: DiscoveryState = { id: "job", sourceTabId: 7, sourceOrigin: site.origin, storeId: "0", tabIds: [7],
  candidates: [{ origin: site.origin, evidence: ["current site"] }, { origin: "https://auth.example.com", evidence: ["cookie"] }],
  selected: [site.origin, "https://auth.example.com"], excluded: [], warnings: [], status: "ready", updatedAt: 1, expiresAt: Date.now() + 600000 };
it("starts from a direct button gesture, fills origins and restores after closing with no PIN or approval", async () => {
  let state: DiscoveryState | undefined;
  let gesture = false;
  const client: DiscoveryClient = {
    get: vi.fn(async () => state), start: vi.fn(async () => { expect(gesture).toBe(true); return state = saved; }),
    update: vi.fn(async (_tab, _id, selected) => state = { ...saved, selected }), stop: vi.fn(), clear: vi.fn(),
  };
  const props = { site, discovery: client, onRequestAccess: vi.fn(), onExport: vi.fn() };
  const first = render(<BorrowSessionView {...props} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Scan sites" })).toBeEnabled());
  gesture = true; fireEvent.click(screen.getByRole("button", { name: "Scan sites" })); gesture = false;
  await waitFor(() => expect(screen.getByLabelText(/Approved origins/)).toHaveValue(saved.selected.join("\n")));
  fireEvent.change(screen.getByLabelText("PIN or passphrase", { exact: true }), { target: { value: "NEVER-PERSIST" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /I approve exporting/ }));
  first.unmount();
  render(<BorrowSessionView {...props} />);
  await waitFor(() => expect(screen.getByLabelText(/Approved origins/)).toHaveValue(saved.selected.join("\n")));
  expect(screen.getByLabelText("PIN or passphrase", { exact: true })).toHaveValue("");
  expect(screen.getByRole("checkbox", { name: /I approve exporting/ })).not.toBeChecked();
  expect(JSON.stringify(state)).not.toContain("NEVER-PERSIST");
});
it("restores recording, retains editable origins, and stops before export", async () => {
  let state = { ...saved, status: "recording" as DiscoveryState["status"] };
  const client: DiscoveryClient = { get: vi.fn(async () => state), start: vi.fn(), clear: vi.fn(),
    update: vi.fn(async (_tab, _id, selected) => state = { ...state, selected, updatedAt: 2 }),
    stop: vi.fn(async () => state = { ...state, status: "ready", updatedAt: 3 }) };
  render(<BorrowSessionView site={site} discovery={client} onRequestAccess={vi.fn()} onExport={vi.fn()} />);
  expect(await screen.findByText(/Recording sign-in/)).toBeVisible();
  fireEvent.change(screen.getByLabelText(/Approved origins/), { target: { value: site.origin + "\nhttps://manual.test" } });
  await waitFor(() => expect(client.update).toHaveBeenCalledWith(7, "job", [site.origin, "https://manual.test"]));
  fireEvent.click(screen.getByRole("checkbox", { name: /I approve exporting/ }));
  expect(screen.getByRole("button", { name: "Export borrowed session" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Stop discovery" }));
  await waitFor(() => expect(client.stop).toHaveBeenCalledWith(7, "job"));
  expect(await screen.findByText(/Discovery saved for this browser session/)).toBeVisible();
});
