import { useEffect, useState } from "react";
import type { PopupSite } from "./PopupApp";
import type { SessionExportRequest, SessionExportResult } from "../../session/export";
import { parseOrigins } from "../../session/format";

interface BorrowSessionViewProps {
  site: PopupSite | undefined;
  onRequestAccess(origins: string[]): Promise<boolean>;
  onExport(request: SessionExportRequest): Promise<SessionExportResult>;
}

export function BorrowSessionView({ site, onRequestAccess, onExport }: BorrowSessionViewProps) {
  const available = site?.access !== "unavailable" && site?.tabId !== undefined;
  const [origins, setOrigins] = useState(available ? site.origin : "");
  const [encrypted, setEncrypted] = useState(true);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setOrigins(available ? site.origin : ""); setApproved(false);
    setPin(""); setConfirm(""); setStatus(""); setError("");
  }, [available, site?.origin, site?.tabId]);

  async function exportSession() {
    setError(""); setStatus("");
    try {
      if (!available || site.tabId === undefined) throw new Error("Open a website, then reopen Scrapeyy to borrow its session.");
      const selected = parseOrigins(origins);
      if (!selected.includes(site.origin)) throw new Error("Include the current website in the approved origins.");
      if (!approved) throw new Error("Approve the listed origins first.");
      if (encrypted && (!pin || pin !== confirm)) throw new Error("Enter matching PINs or passphrases.");
      if (encrypted && new TextEncoder().encode(pin).length > 4096) throw new Error("PIN/passphrase exceeds 4096 UTF-8 bytes.");
      // Do not await anything before requesting permissions from this user click.
      const permission = onRequestAccess(selected);
      setBusy(true); setStatus("Waiting for website permission…");
      if (!await permission) throw new Error("Cookie and selected website access are required. You can try again.");
      setStatus("Preparing session export…");
      const exporting = onExport({ tabId: site.tabId, origins: selected,
        protection: encrypted ? "encrypted" : "plaintext", ...(encrypted ? { passphrase: pin } : {}) });
      setPin(""); setConfirm("");
      const result = await exporting;
      setStatus(`Download requested: ${result.cookieCount} cookies, ${result.storageOriginCount} storage origins.${result.warnings.length ? " " + result.warnings.join(" ") : ""}`);
    } catch (cause) {
      setStatus(""); setError(cause instanceof Error ? cause.message : "Session export failed.");
    } finally { setBusy(false); }
  }

  return <section className="popup-view borrow-session-view" aria-label="Borrow session">
    <div className="view-heading"><div><span className="eyebrow">Portable access</span><h2>Borrow session</h2></div></div>
    <p className="session-intro">Export your signed-in session for another VM or project. The file can grant access to your accounts.</p>
    {!available ? <div className="settings-block"><strong>Open a website first</strong><small>Then reopen Scrapeyy to select its session.</small></div> : null}
    <fieldset className="session-form" disabled={busy || !available}>
      <div className="settings-block">
        <label className="settings-field"><span>Approved origins (one per line)</span>
          <textarea aria-label="Approved origins (one per line)" rows={3} spellCheck={false} value={origins} onChange={event => { setOrigins(event.target.value); setApproved(false); setError(""); }} />
        </label>
        <small>Open related login sites in this profile or container to include their storage.</small>
      </div>
      <div className="settings-block">
        <label className="settings-field"><span>File protection</span>
          <select aria-label="File protection" value={encrypted ? "encrypted" : "plaintext"} onChange={event => { setEncrypted(event.target.value === "encrypted"); setPin(""); setConfirm(""); setError(""); }}>
            <option value="encrypted">Encrypted with PIN / passphrase</option><option value="plaintext">Plaintext — readable session file</option>
          </select>
        </label>
        {encrypted ? <>
          <label className="settings-field"><span>PIN or passphrase</span><input aria-label="PIN or passphrase" type="password" autoComplete="new-password" value={pin} onChange={event => setPin(event.target.value)} /></label>
          <label className="settings-field"><span>Confirm PIN or passphrase</span><input aria-label="Confirm PIN or passphrase" type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} /></label>
          <small>Prefer a longer passphrase. Use the same secret on the destination. Scrapeyy does not save it.</small>
        </> : <small className="session-warning">Plaintext contains readable account secrets. Protect the file and delete it after import.</small>}
      </div>
      <label className="session-approval"><input type="checkbox" checked={approved} onChange={event => setApproved(event.target.checked)} />
        <span>I approve exporting cookies (including HttpOnly) and browser storage for these origins.</span>
      </label>
      <button className="settings-save" type="button" disabled={!approved || busy} onClick={() => void exportSession()}>{busy ? "Exporting…" : "Export borrowed session"}</button>
    </fieldset>
    {error ? <p className="session-warning" role="alert">{error}</p> : null}
    {status ? <p className="session-status" role="status">{status}</p> : null}
    <details className="settings-block session-details"><summary>What gets exported</summary><small>Only selected origins in the source tab’s cookie store are included. Partitioned cookies are excluded. Device-bound sessions may not transfer; expiration is unchanged. Session data stays out of the Inbox and configuration backups.</small></details>
  </section>;
}
