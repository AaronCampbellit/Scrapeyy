// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { cookieMatches, encodeSession, parseOrigins, type SessionBundle, type SessionCookie } from '../../src/session/format';
// @ts-expect-error Standalone dependency-free Node utility intentionally has no TS declarations.
import { decryptSession } from '../../scripts/decrypt-session.mjs';
vi.stubGlobal('crypto',webcrypto);
const cookie: SessionCookie = {name:'fake',value:'synthetic',domain:'.example.test',path:'/orders',hostOnly:false,secure:true,httpOnly:true,sameSite:'unspecified',session:false,expirationDate:2000000000,storeId:'0'};
const bundle: SessionBundle = {format:'scrapeyy-session',version:1,createdAt:'2026-10-22T00:00:00Z',source:{browser:'test',locale:'en-US',timezone:'UTC'},origins:['https://shop.example.test'],cookies:[cookie],storage:[{origin:'https://shop.example.test',localStorage:[{name:'test',value:'synthetic'}],sessionStorage:[]}],warnings:[]};
describe('portable session format',()=>{
 it('accepts exact origins, deduplicates, and rejects credentials, paths, schemes and wildcards',()=>{
  expect(parseOrigins('https://shop.example.test\nhttps://shop.example.test/')).toEqual(['https://shop.example.test']);
  for(const bad of ['file:///tmp','https://user:pass@example.test','https://example.test/orders','https://*.example.test','']) expect(()=>parseOrigins(bad)).toThrow();
 });
 it('respects host-only, secure, and domain boundaries',()=>{
  expect(cookieMatches(cookie,['https://shop.example.test'])).toBe(true);
  expect(cookieMatches({...cookie,hostOnly:true},['https://shop.example.test'])).toBe(false);
  expect(cookieMatches(cookie,['https://notexample.test'])).toBe(false);
  expect(cookieMatches(cookie,['http://shop.example.test'])).toBe(false);
 });
 it('interoperates with standalone decoder and authenticates tampering',async()=>{
  const text = await encodeSession(bundle,'1234');
  expect(await decryptSession(text,'1234')).toEqual(bundle);
  expect(text).not.toContain('synthetic');
  await expect(decryptSession(text,'wrong')).rejects.toThrow('Incorrect');
  const changed = JSON.parse(text); changed.ciphertext = (changed.ciphertext[0]==='A'?'B':'A')+changed.ciphertext.slice(1);
  await expect(decryptSession(JSON.stringify(changed),'1234')).rejects.toThrow('Incorrect');
  const other=JSON.parse(await encodeSession(bundle,'1234'));
  expect(other.kdf.salt).not.toBe(JSON.parse(text).kdf.salt);
  expect(other.cipher.iv).not.toBe(JSON.parse(text).cipher.iv);
 });
 it('bounds KDF work and rejects malformed encryption metadata',async()=>{
  const text = await encodeSession(bundle,'pin'); const object=JSON.parse(text);
  object.kdf.iterations=1000000000;
  await expect(decryptSession(JSON.stringify(object),'pin')).rejects.toThrow('Unsupported');
  object.kdf.iterations=600000;object.cipher.iv='YQ==';
  await expect(decryptSession(JSON.stringify(object),'pin')).rejects.toThrow('length');
 });
 it('requires explicit plaintext selection and retains every cookie attribute',async()=>{
  expect(JSON.parse(await encodeSession(bundle))).toEqual(bundle);
  await expect(encodeSession(bundle,'')).rejects.toThrow('Enter');
  await expect(encodeSession(bundle,'x'.repeat(4097))).rejects.toThrow('4096');
  await expect(decryptSession('{}','x'.repeat(4097))).rejects.toThrow('4096');
 });
});
