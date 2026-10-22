// Real Chromium extension APIs against synthetic local data only.
// Set SCRAPEYY_PLAYWRIGHT_MODULE to an installed Playwright index.mjs if needed.
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { decryptSession } from '../../scripts/decrypt-session.mjs';
const { chromium } = await import(process.env.SCRAPEYY_PLAYWRIGHT_MODULE || 'playwright');
const temporary = await mkdtemp(join(tmpdir(),'scrapeyy-smoke-'));
const server = createServer((_request,response)=>{response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>Synthetic session fixture</title><h1>Synthetic session fixture</h1>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let context;
try {
 const extension=join(temporary,'extension'); await cp(resolve('.output/chrome-mv3'),extension,{recursive:true});
 const path=join(extension,'manifest.json'),manifest=JSON.parse(await readFile(path,'utf8'));
 // ONLY the temporary copy pregrants permissions; production manifest stays optional.
 manifest.permissions.push('cookies'); manifest.host_permissions=['http://127.0.0.1/*'];
 await writeFile(path,JSON.stringify(manifest));
 context=await chromium.launchPersistentContext(join(temporary,'profile'),{channel:'chromium',headless:true,acceptDownloads:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 const worker=context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
 const workerUrl=new URL(worker.url());
 const extensionOrigin=`${workerUrl.protocol}//${workerUrl.host}`;
 const source=await context.newPage();await source.goto(origin+'/orders');
 await source.evaluate(()=>{localStorage.setItem('fixture-local','synthetic-local');sessionStorage.setItem('fixture-session','synthetic-session');});
 await context.addCookies([{name:'fixture-http-only',value:'synthetic-cookie',url:origin+'/orders',httpOnly:true,sameSite:'Lax'},{name:'foreign-cookie',value:'excluded',url:'http://example.com/'}]);
 const tabId=await worker.evaluate(async origin=>(await chrome.tabs.query({})).find(tab=>tab.url?.startsWith(origin))?.id,origin);
 assert.equal(typeof tabId,'number');
 const page=await context.newPage();await page.goto(extensionOrigin+'/borrow-session.html?'+new URLSearchParams({origin,tabId:String(tabId)}));
 await page.getByLabel('I approve exporting cookies', {exact:false}).check();
 await page.getByLabel('PIN or passphrase',{exact:true}).fill('1234');
 await page.getByLabel('Confirm PIN or passphrase',{exact:true}).fill('1234');
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export borrowed session'}).click();
 const download=await downloaded;
 const bundle=await decryptSession(await readFile(await download.path(),'utf8'),'1234');
 assert.equal(bundle.cookies.length,1);assert.equal(bundle.cookies[0].name,'fixture-http-only');assert.equal(bundle.cookies[0].httpOnly,true);assert.equal(bundle.cookies[0].hostOnly,true);
 assert.deepEqual(bundle.storage[0].localStorage,[{name:'fixture-local',value:'synthetic-local'}]);
 assert.deepEqual(bundle.storage[0].sessionStorage,[{name:'fixture-session',value:'synthetic-session'}]);
 await page.getByLabel('File protection').selectOption('plaintext');
 const plainDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export borrowed session'}).click();
 const plain=JSON.parse(await readFile(await (await plainDownload).path(),'utf8'));
 assert.deepEqual(plain.cookies,bundle.cookies);assert.deepEqual(plain.storage,bundle.storage);
 assert.equal(await page.getByLabel('PIN or passphrase',{exact:true}).count(),0);
 console.log('PASS: installed Chromium extension exported scoped HttpOnly cookies, localStorage and sessionStorage; encrypted download decrypted; explicit plaintext matched. Native optional-permission dialog bypassed only in temporary test manifest.');
} finally {await context?.close();await new Promise(resolve=>server.close(resolve));await rm(temporary,{recursive:true,force:true});}
