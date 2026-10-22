import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { extensionBrowser as browser } from '../../src/platform/browser-api';
import { downloadBundle } from '../../src/platform/downloads';
import { captureSession } from '../../src/session/capture';
import { encodeSession, parseOrigins } from '../../src/session/format';
import './style.css';

function BorrowSession() {
  const params = new URLSearchParams(location.search);
  const [origins,setOrigins] = useState(params.get('origin') ?? '');
  const [encrypted,setEncrypted] = useState(true);
  const [pin,setPin] = useState('');
  const [confirm,setConfirm] = useState('');
  const [approved,setApproved] = useState(false);
  const [busy,setBusy] = useState(false);
  const [status,setStatus] = useState('');
  async function exportSession() {
    try {
      const selected = parseOrigins(origins);
      const tabId = Number(params.get('tabId'));
      if (!Number.isInteger(tabId) || tabId < 0 || !params.has('tabId')) throw new Error('Open Borrow session from the Scrapeyy popup.');
      if (!approved) throw new Error('Approve the listed origins first.');
      if (encrypted && (!pin || pin !== confirm)) throw new Error('Enter matching PINs or passphrases.');
      // Permission request must be directly inside the user gesture, before other async work.
      const permission = browser.permissions.request({permissions:['cookies'],origins:selected.map(origin => origin+'/*')});
      setBusy(true); setStatus('Waiting for website permission…');
      if (!await permission) throw new Error('Cookie and selected website access are required.');
      const bundle = await captureSession(selected,tabId);
      const text = await encodeSession(bundle,encrypted ? pin : undefined);
      setPin(''); setConfirm('');
      await downloadBundle(new Blob([text],{type:'application/json'}),`scrapeyy-session-${encrypted?'encrypted':'PLAINTEXT'}-${Date.now()}.json`,true);
      setStatus(`Download requested: ${bundle.cookies.length} cookies, ${bundle.storage.length} storage origins. ${bundle.warnings.join(' ')}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Session export failed.'); }
    finally { setBusy(false); }
  }
  return <main><h1>Borrow session</h1><p>Export your signed-in session for another VM or project. This file can grant access to your accounts. Only export sites you are authorized to use.</p>
    <fieldset disabled={busy}><label>Approved origins (one per line)<textarea rows={6} value={origins} onChange={event=>{setOrigins(event.target.value);setApproved(false);}} /></label>
    <p>Add related login origins explicitly. Open those sites in tabs in the same browser profile/container to include their storage. Only one tab per origin is captured; the source tab takes priority.</p>
    <label><input type="checkbox" checked={approved} onChange={event=>setApproved(event.target.checked)}/> I approve exporting cookies (including HttpOnly) and browser storage for these origins.</label>
    <label>File protection<select value={encrypted?'encrypted':'plaintext'} onChange={event=>{setEncrypted(event.target.value==='encrypted');setPin('');setConfirm('');}}><option value="encrypted">Encrypted with PIN / passphrase (recommended)</option><option value="plaintext">Plaintext — anyone with the file can read the session</option></select></label>
    {encrypted ? <><label>PIN or passphrase<input type="password" autoComplete="new-password" value={pin} onChange={event=>setPin(event.target.value)}/></label><label>Confirm PIN or passphrase<input type="password" autoComplete="new-password" value={confirm} onChange={event=>setConfirm(event.target.value)}/></label><p>A short PIN is easier to guess offline. Prefer a longer passphrase. Scrapeyy does not save it; use the same secret on each destination.</p></> : <p><strong>Plaintext export contains readable account secrets.</strong> Protect the file and delete it after import.</p>}
    <p>Partitioned cookies are excluded. Device-bound sessions may not transfer, and exports do not extend expiration. No session is saved to the Scrapeyy inbox or configuration backup.</p>
    <button disabled={!approved} onClick={()=>void exportSession()}>Export borrowed session</button></fieldset><p role="status">{status}</p></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><BorrowSession/></React.StrictMode>);
