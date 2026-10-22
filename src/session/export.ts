import { extensionBrowser } from "../platform/browser-api";
import { blobDataUrl } from "../platform/downloads";
import { captureSession } from "./capture";
import { encodeSession, parseOrigins } from "./format";

export interface SessionExportRequest {
  tabId: number;
  origins: string[];
  protection: "encrypted" | "plaintext";
  passphrase?: string;
}

export interface SessionExportResult {
  cookieCount: number;
  storageOriginCount: number;
  warnings: string[];
}

// Keep the native permission request synchronous with the popup's Export click.
export function requestSessionAccess(origins: string[]): Promise<boolean> {
  return extensionBrowser.permissions.request({
    permissions: ["cookies"],
    origins: parseOrigins(origins.join("\n")).map(origin => `${origin}/*`),
  });
}

export async function exportBorrowedSession(request: SessionExportRequest): Promise<SessionExportResult> {
  if (!Number.isInteger(request.tabId) || request.tabId < 0) throw new Error("Open a website first.");
  const origins = parseOrigins(request.origins.join("\n"));
  if (request.protection !== "encrypted" && request.protection !== "plaintext") throw new Error("Choose file protection.");
  if (request.protection === "encrypted" && !request.passphrase) throw new Error("Enter a PIN or passphrase.");
  if (request.passphrase && new TextEncoder().encode(request.passphrase).length > 4096) throw new Error("PIN/passphrase exceeds 4096 UTF-8 bytes.");
  const bundle = await captureSession(origins, request.tabId);
  const text = await encodeSession(bundle, request.protection === "encrypted" ? request.passphrase : undefined);
  // A data URL remains usable if the popup closes when the browser opens Save As.
  const url = await blobDataUrl(new Blob([text], { type: "application/json" }));
  await extensionBrowser.downloads.download({
    url,
    filename: `scrapeyy-session-${request.protection === "encrypted" ? "encrypted" : "PLAINTEXT"}-${Date.now()}.json`,
    saveAs: true,
    conflictAction: "uniquify",
  });
  return { cookieCount: bundle.cookies.length, storageOriginCount: bundle.storage.length, warnings: bundle.warnings };
}
