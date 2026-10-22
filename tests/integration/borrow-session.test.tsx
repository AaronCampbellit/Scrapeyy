import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { BorrowSessionView } from "../../src/features/popup/BorrowSessionView";

const site = { origin: "https://shop.example.test", access: "one-time" as const, tabId: 7 };
const result = { cookieCount: 2, storageOriginCount: 1, warnings: ["Device-bound sessions may not transfer."] };
function setup(request = vi.fn().mockResolvedValue(true)) {
  const exported = vi.fn().mockResolvedValue(result);
  render(<BorrowSessionView site={site} onRequestAccess={request} onExport={exported} />);
  return { user: userEvent.setup(), request, exported };
}
async function approve(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("checkbox", { name: /I approve exporting cookies/ }));
}
async function fillSecret(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("PIN or passphrase", { exact: true }), "portable secret");
  await user.type(screen.getByLabelText("Confirm PIN or passphrase", { exact: true }), "portable secret");
}

it("exports from the embedded form with a synchronous permission request and clears the secret", async () => {
  let gesture = false;
  const request = vi.fn(() => { expect(gesture).toBe(true); return Promise.resolve(true); });
  const { user, exported } = setup(request);
  expect(screen.getByLabelText(/Approved origins/)).toHaveValue(site.origin);
  expect(screen.getByLabelText("File protection")).toHaveValue("encrypted");
  expect(screen.getByRole("button", { name: "Export borrowed session" })).toBeDisabled();
  await fillSecret(user); await approve(user);
  gesture = true; fireEvent.click(screen.getByRole("button", { name: "Export borrowed session" })); gesture = false;
  await waitFor(() => expect(exported).toHaveBeenCalledWith({ tabId: 7, origins: [site.origin], protection: "encrypted", passphrase: "portable secret" }));
  expect(request).toHaveBeenCalledWith([site.origin]);
  expect(screen.getByLabelText("PIN or passphrase", { exact: true })).toHaveValue("");
  expect(await screen.findByRole("status")).toHaveTextContent("2 cookies, 1 storage origins");
});

it("rejects mismatched secrets and invalid or missing-source origins before permissions", async () => {
  const { user, request, exported } = setup();
  await approve(user);
  await user.type(screen.getByLabelText("PIN or passphrase", { exact: true }), "one");
  await user.type(screen.getByLabelText("Confirm PIN or passphrase", { exact: true }), "two");
  await user.click(screen.getByRole("button", { name: "Export borrowed session" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("matching");
  await user.clear(screen.getByLabelText(/Approved origins/));
  await user.type(screen.getByLabelText(/Approved origins/), "https://other.example.test");
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  await approve(user);
  await user.click(screen.getByRole("button", { name: "Export borrowed session" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("current website");
  await user.clear(screen.getByLabelText(/Approved origins/));
  await user.type(screen.getByLabelText(/Approved origins/), "https://shop.example.test/orders");
  await approve(user);
  await user.click(screen.getByRole("button", { name: "Export borrowed session" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("exact HTTP(S) origins");
  expect(request).not.toHaveBeenCalled(); expect(exported).not.toHaveBeenCalled();
});

it("keeps permission denial retryable without exporting anything", async () => {
  const request = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const { user, exported } = setup(request);
  await fillSecret(user); await approve(user);
  await user.click(screen.getByRole("button", { name: "Export borrowed session" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("try again");
  expect(exported).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Export borrowed session" }));
  await waitFor(() => expect(exported).toHaveBeenCalledOnce());
  expect(request).toHaveBeenCalledTimes(2);
});

it("requires explicit plaintext selection and omits the cleared passphrase", async () => {
  const { user, exported } = setup();
  await fillSecret(user);
  await user.selectOptions(screen.getByLabelText("File protection"), "plaintext");
  expect(screen.queryByLabelText("PIN or passphrase", { exact: true })).not.toBeInTheDocument();
  expect(screen.getByText(/Plaintext contains readable account secrets/)).toBeVisible();
  await approve(user); await user.click(screen.getByRole("button", { name: "Export borrowed session" }));
  await waitFor(() => expect(exported).toHaveBeenCalledWith({ tabId: 7, origins: [site.origin], protection: "plaintext" }));
  await user.selectOptions(screen.getByLabelText("File protection"), "encrypted");
  expect(screen.getByLabelText("PIN or passphrase", { exact: true })).toHaveValue("");
});

it("disables export on browser pages without a website source", () => {
  render(<BorrowSessionView site={{ origin: "Browser page", access: "unavailable" }} onRequestAccess={vi.fn()} onExport={vi.fn()} />);
  expect(screen.getByText("Open a website first")).toBeVisible();
  expect(screen.getByRole("button", { name: "Export borrowed session" })).toBeDisabled();
});
