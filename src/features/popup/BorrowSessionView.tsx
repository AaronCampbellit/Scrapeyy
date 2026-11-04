import { useEffect, useRef, useState } from "react";
import type { DiscoveryClient, DiscoveryState } from "../../session/discovery";
import type { PopupSite } from "./PopupApp";
import type { SessionExportRequest, SessionExportResult } from "../../session/export";
import { parseOrigins } from "../../session/format";

interface BorrowSessionViewProps {
  site: PopupSite | undefined;
  discovery?: DiscoveryClient | undefined;
  onRequestAccess(origins: string[]): Promise<boolean>;
  onExport(request: SessionExportRequest): Promise<SessionExportResult>;
}

export function BorrowSessionView({ site, discovery, onRequestAccess, onExport }: BorrowSessionViewProps) {
  const available = site?.access !== "unavailable" && site?.tabId !== undefined;
  const [origins, setOrigins] = useState(available ? site.origin : "");
  const [encrypted, setEncrypted] = useState(true);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [scan, setScan] = useState<DiscoveryState>();
  const [connecting, setConnecting] = useState(false);
  const [restoring, setRestoring] = useState(!!discovery);
  const dirty = useRef(false);
  const latest = useRef<DiscoveryState | undefined>(undefined);
  const mounted = useRef(true);
  const originsRef = useRef(origins);
  originsRef.current = origins;
  const active = !!scan && ["waiting", "scanning", "recording"].includes(scan.status);
  function accept(next: DiscoveryState | undefined) {
    if (!mounted.current || (next && latest.current?.id === next.id && next.updatedAt < latest.current.updatedAt)) return;
    latest.current = next; setScan(next);
    if (next && !dirty.current) {
      const text = next.selected.join("\n");
      if (text !== originsRef.current) { originsRef.current = text; setOrigins(text); setApproved(false); }
    }
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!discovery || site?.tabId === undefined) { setRestoring(false); return; }
    let cancelled = false;
    const refresh = async () => {
      try { const next = await discovery.get(site.tabId!); if (!cancelled) accept(next); }
      catch { if (!cancelled) setError("Discovery could not reconnect. Reopen Scrapeyy and try again."); }
      finally { if (!cancelled) setRestoring(false); }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [discovery, site?.tabId]);
  async function startScan(record: boolean) {
    if (!discovery || site?.tabId === undefined) return;
    setError(""); setApproved(false); setConnecting(true); dirty.current = false;
    try { accept(await discovery.start(site.tabId, site.origin, record)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Discovery failed. Try again."); }
    finally { setConnecting(false); }
  }
  function editOrigins(text: string) {
    setOrigins(text); originsRef.current = text; setApproved(false); setError(""); dirty.current = true;
    if (!discovery || !scan || site?.tabId === undefined) return;
    try {
      const selected = parseOrigins(text);
      void discovery.update(site.tabId, scan.id, selected).then(next => {
        if (originsRef.current === text) { dirty.current = false; accept(next); }
      }).catch(() => setError("The edited list could not be saved. Keep this popup open or retry."));
    } catch { /* Partial input stays local until it forms a valid list of origins. */ }
  }
  async function stopScan(clear = false) {
    if (!discovery || !scan || site?.tabId === undefined) return;
    setError("");
    try {
      if (clear) { await discovery.clear(site.tabId, scan.id); dirty.current = false; accept(undefined); setOrigins(site.origin); setApproved(false); }
      else accept(await discovery.stop(site.tabId, scan.id));
    } catch { setError("Discovery could not be stopped. Reopen Scrapeyy and try again."); }
  }

  useEffect(() => {
    dirty.current = false; latest.current = undefined; setScan(undefined);
    setOrigins(available ? site.origin : ""); setApproved(false);
    setPin(""); setConfirm(""); setStatus(""); setError("");
  }, [available, site?.origin, site?.tabId]);

  async function exportSession() {
    setError(""); setStatus("");
    try {
      if (!available || site.tabId === undefined) throw new Error("Open a website, then reopen Scrapeyy to borrow its session.");
      const selected = parseOrigins(origins);
      if (!selected.includes(scan?.sourceOrigin || site.origin)) throw new Error("Include the current website in the approved origins.");
      if (!approved) throw new Error("Approve the listed origins first.");
      if (encrypted && (!pin || pin !== confirm)) throw new Error("Enter matching PINs or passphrases.");
      if (encrypted && new TextEncoder().encode(pin).length > 4096) throw new Error("PIN/passphrase exceeds 4096 UTF-8 bytes.");
      // Do not await anything before requesting permissions from this user click.
      const permission = onRequestAccess(selected);
      setBusy(true); setStatus("Waiting for website permission…");
      if (!await permission) throw new Error("Cookie and selected website access are required. You can try again.");
      setStatus("Preparing session export…");
      const exporting = onExport({ tabId: scan?.sourceTabId ?? site.tabId, origins: selected,
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
    {discovery ? <div className="settings-block session-discovery">
      <strong>Find session sites</strong>
      <small>Find related links, frames, open tabs and cookie domains. Results fill the list below.</small>
      <div className="session-discovery-actions">
        <button type="button" className="settings-save" disabled={!available || busy || connecting || active || restoring} onClick={() => void startScan(false)}>Scan sites</button>
        <button type="button" disabled={!available || busy || connecting || active || restoring} onClick={() => void startScan(true)}>Record sign-in</button>
        {active ? <button type="button" onClick={() => void stopScan()}>Stop discovery</button> : null}
        {scan && !active ? <button type="button" disabled={busy} onClick={() => void stopScan(true)}>Clear discovery</button> : null}
      </div>
      <details className="session-discovery-help"><summary>Access and continuity</summary>
        <small>Scan requests access to this site's domain family. Record sign-in requests access across websites to follow sign-in redirects, and watches only this tab and windows it opens for up to 10 minutes. Browser grants remain until revoked in extension settings.</small>
        <small>You can close the popup while discovery runs. Results last one hour or until browser restart. PINs and export approval must be entered again after closing the popup. Discovery does not guarantee a transferable session.</small>
      </details>
      {restoring || connecting ? <p role="status">Connecting to discovery…</p> : null}
      {scan ? <>
        <p className="session-status" role="status">{scan.status === "recording" ? "Recording sign-in — you can close this popup, sign in, then return and stop discovery." : scan.status === "waiting" ? "Waiting for browser permission…" : scan.status === "scanning" ? "Scanning sites — you can close this popup and return." : scan.status === "error" ? "Discovery needs attention." : "Discovery saved for this browser session."}</p>
        <small>Source: {scan.sourceOrigin} · {scan.candidates.length} sites found. A new scan uses the current tab.</small>
        {scan.warnings.map(warning => <small className="session-warning" key={warning}>{warning}</small>)}
        {scan.candidates.length ? <details><summary>Review discovered sites ({scan.candidates.length})</summary>
          <div className="session-candidates">{scan.candidates.map(candidate => <label key={candidate.origin}>
            <input type="checkbox" disabled={busy} checked={origins.split(/\s+/).includes(candidate.origin)} onChange={event => {
              try { const selected = parseOrigins(origins); editOrigins((event.target.checked ? [...new Set([...selected, candidate.origin])] : selected.filter(origin => origin !== candidate.origin)).join("\n")); }
              catch { setError("Finish editing the origins field first."); }
            }} /><span>{candidate.origin}<small>{candidate.evidence.join(", ")}</small></span>
          </label>)}</div>
        </details> : null}
      </> : null}
    </div> : null}
    <fieldset className="session-form" disabled={busy || !available || restoring}>
      <div className="settings-block">
        <label className="settings-field"><span>Approved origins (one per line)</span>
          <textarea aria-label="Approved origins (one per line)" rows={3} spellCheck={false} value={origins} onChange={event => editOrigins(event.target.value)} />
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
      <button className="settings-save" type="button" disabled={!approved || busy || active || connecting} onClick={() => void exportSession()}>{busy ? "Exporting…" : "Export borrowed session"}</button>
    </fieldset>
    {error ? <p className="session-warning" role="alert">{error}</p> : null}
    {status ? <p className="session-status" role="status">{status}</p> : null}
    <details className="settings-block session-details"><summary>What gets exported</summary><small>Only selected origins in the source tab’s cookie store are included. Partitioned cookies are excluded. Device-bound sessions may not transfer; expiration is unchanged. Session data stays out of the Inbox and configuration backups.</small></details>
  </section>;
}
