import { extensionBrowser as browser } from '../platform/browser-api';
import { cookieMatches, type SessionBundle, type SessionCookie } from './format';

// Runs only in the isolated top-level frame, never via a page message bridge.
export function readStorage(expectedOrigin: string) {
  if (location.origin !== expectedOrigin) throw new Error('The selected tab navigated.');
  const read = (storage: Storage) => Object.keys(storage).map(name => ({name,value:storage.getItem(name) ?? ''}));
  return {origin:location.origin,localStorage:read(localStorage),sessionStorage:read(sessionStorage)};
}
export async function captureSession(origins: string[], selectedTabId: number): Promise<SessionBundle> {
  const source = await browser.tabs.get(selectedTabId);
  if (!source.url || !origins.includes(new URL(source.url).origin)) throw new Error('The source tab changed. Reopen Borrow session.');
  const stores = await browser.cookies.getAllCookieStores();
  const store = stores.find(store => store.tabIds.includes(selectedTabId));
  if (!store) throw new Error('Cannot identify the selected tab cookie store.');
  const bundle: SessionBundle = {format:'scrapeyy-session',version:1,createdAt:new Date().toISOString(),source:{browser:import.meta.env.BROWSER,locale:navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},origins,cookies:[],storage:[],warnings:[]};
  const seen = new Set<string>();
  let excluded = 0;
  for (const origin of origins) {
    const tabs = await browser.tabs.query({url:origin+'/*'});
    const matching = tabs.filter(tab => tab.id !== undefined && store.tabIds.includes(tab.id) && tab.url && new URL(tab.url).origin === origin);
    const tab = matching.find(tab => tab.id === selectedTabId) ?? matching[0];
    // Domain query includes every path on the selected host; URL query adds parent-domain cookies applicable at /.
    const queries = [{domain:new URL(origin).hostname,storeId:store.id},{url:origin+'/',storeId:store.id}, ...matching.map(tab => ({url:tab.url!,storeId:store.id}))];
    for (const query of queries) {
      const cookies = await browser.cookies.getAll({...query,partitionKey:{},...(import.meta.env.BROWSER === "firefox" ? {firstPartyDomain:null} : {})});
      for (const raw of cookies) {
        const cookie: SessionCookie = { ...raw };
        // Firefox uses null for unpartitioned cookies. Canonical exports omit it;
        // actual partition objects must remain intact for the exclusion below.
        if (cookie.partitionKey === null) delete cookie.partitionKey;
        if (!cookieMatches(cookie,origins)) continue;
        const id = JSON.stringify([cookie.domain,cookie.path,cookie.name,cookie.storeId,cookie.partitionKey,cookie.firstPartyDomain]);
        if (seen.has(id)) continue; seen.add(id);
        if (cookie.partitionKey || cookie.firstPartyDomain) { excluded++; continue; }
        bundle.cookies.push(cookie);
      }
    }
    if (tab?.id === undefined) { bundle.warnings.push(`No open tab for ${origin}; storage omitted.`); continue; }
    if (matching.length > 1 && tab.id !== selectedTabId) bundle.warnings.push(`Multiple tabs for ${origin}; storage from tab ${tab.id} only.`);
    try {
      const results = await browser.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},func:readStorage,args:[origin]});
      if (!results[0]?.result || results[0].result.origin !== origin) throw new Error('Storage unavailable');
      bundle.storage.push(results[0].result);
    } catch { bundle.warnings.push(`Storage unavailable for ${origin}; cookies only.`); }
  }
  if (excluded) bundle.warnings.push(`${excluded} partitioned or first-party-isolated cookies excluded; portable replay is unsupported.`);
  bundle.warnings.push('Parent-domain cookies for paths outside open tabs may be absent. Sessions may expire or be device-bound; expiry is not extended.');
  return bundle;
}
