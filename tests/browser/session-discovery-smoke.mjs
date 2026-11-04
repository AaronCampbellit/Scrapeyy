// Isolated synthetic profile only. Never attaches to an installed user extension.
import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.SCRAPEYY_PLAYWRIGHT_MODULE || 'playwright');
const root = resolve('work/discovery-smoke', String(Date.now()));
await mkdir(root, { recursive: true });
const build = resolve(process.argv[2] || '.output/chrome-mv3');
let port;
const server = createServer((request, response) => {
  if (request.url.startsWith('/redirect')) {
    response.writeHead(302, { Location: `http://identity.test:${port}/done?code=SECRET-CODE` }); response.end(); return;
  }
  response.setHeader('Content-Type', 'text/html');
  response.end(`<!doctype html><title>Synthetic discovery</title><h1>Discovery fixture</h1>
    <a href="http://auth.fixture.test:${port}/login?token=SECRET-LINK">Sign in</a>
    <a href="http://outside.test:${port}/">Outside</a>
    <form action="http://form.fixture.test:${port}/login"><input name="password" value="SECRET-FORM"></form>
    ${request.url.startsWith('/frame') ? '' : `<iframe src="http://frame.fixture.test:${port}/frame"></iframe>`}`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); port = server.address().port;
const origin = `http://app.fixture.test:${port}`;
let context;
try {
  for (const granted of [false, true]) {
    const extension = join(root, granted ? 'granted-extension' : 'optional-extension'); await cp(build, extension, { recursive: true });
    if (granted) {
      const manifestPath = join(extension, 'manifest.json'); const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      manifest.permissions.push('cookies', 'tabs', 'webNavigation', 'webRequest');
      manifest.host_permissions = ['http://*/*', 'https://*/*'];
      await writeFile(manifestPath, JSON.stringify(manifest));
    }
    context = await chromium.launchPersistentContext(join(root, granted ? 'granted-profile' : 'optional-profile'), {
      channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
        '--host-resolver-rules=MAP *.fixture.test 127.0.0.1, MAP identity.test 127.0.0.1', '--no-proxy-server'],
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const popupUrl = worker.url().replace(/\/[^/]+$/, '/popup.html');
    const source = await context.newPage(); await source.goto(origin);
    const tabId = await worker.evaluate(async origin => (await chrome.tabs.query({})).find(tab => tab.url?.startsWith(origin))?.id, origin);
    // The initial ungranted profile cannot enumerate URLs; no website needed to prove background startup.
    if (!granted) {
      const popup = await context.newPage(); await popup.goto(popupUrl);
      await popup.getByRole('tab', { name: 'Borrow session', exact: true }).click();
      assert.equal(await popup.getByRole('button', { name: 'Scan sites' }).count(), 1);
      assert.equal(await worker.evaluate(async () => (await chrome.runtime.getManifest()).version), '0.1.26');
      await context.close(); context = undefined; continue;
    }
    assert.equal(typeof tabId, 'number');
    await context.addCookies([{ name: 'fixture', value: 'SECRET-COOKIE', domain: 'cookie.fixture.test', path: '/' }]);
    await context.addInitScript(({ tabId }) => {
      if (location.protocol !== 'chrome-extension:') return;
      const query = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = async options => options.active && options.currentWindow ? [await chrome.tabs.get(tabId)] : query(options);
    }, { tabId });
    let popup = await context.newPage(); await popup.goto(popupUrl);
    await popup.getByRole('tab', { name: 'Borrow session', exact: true }).click();
    await popup.getByRole('button', { name: 'Scan sites' }).click();
    await popup.getByText('Discovery saved for this browser session.', { exact: true }).waitFor();
    const field = popup.getByLabel('Approved origins (one per line)', { exact: true });
    assert.match(await field.inputValue(), /auth\.fixture\.test/);
    assert.match(await field.inputValue(), /cookie\.fixture\.test/);
    assert.match(await field.inputValue(), /frame\.fixture\.test/);
    assert.doesNotMatch(await field.inputValue(), /outside\.test/);
    await popup.getByRole('button', { name: 'Record sign-in' }).click();
    await popup.getByText(/Recording sign-in/).waitFor();
    await popup.close();
    await source.goto(origin + '/redirect');
    popup = await context.newPage(); await popup.goto(popupUrl);
    await popup.getByRole('tab', { name: 'Borrow session', exact: true }).click();
    await popup.getByText(/Recording sign-in/).waitFor();
    await popup.waitForFunction(() => document.querySelector('textarea')?.value.includes('http://identity.test:'));
    await popup.getByRole('button', { name: 'Stop discovery' }).click();
    await popup.getByText('Discovery saved for this browser session.', { exact: true }).waitFor();
    await popup.screenshot({ path: join(root, 'borrow-session.png'), fullPage: true });
    const state = await worker.evaluate(async () => chrome.storage.session.get('sessionDiscoveryV1'));
    assert.doesNotMatch(JSON.stringify(state), /SECRET-|\?code=|password|passphrase/);
    await context.close(); context = undefined;
  }
  console.log('PASS: optional-permission startup, real scan APIs, cookie/frame/link discovery, popup closure, cross-domain redirect recording, reopen and stop, metadata redaction. Native permission prompts pregranted ONLY in the synthetic copy. Screenshot: ' + join(root, 'borrow-session.png'));
} finally { await context?.close(); await new Promise(resolve => server.close(resolve)); }
