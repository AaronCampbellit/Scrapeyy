#!/usr/bin/env node
// Dependency-free Node 24 utility. Never prints session values or accepts a PIN in argv.
import { webcrypto } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';
const MAX = 20 * 1024 * 1024;
function from64(value, length) {
  if (typeof value !== 'string' || value.length > MAX * 1.4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('Invalid base64.');
  const bytes = Buffer.from(value, 'base64');
  if (length !== undefined && bytes.length !== length) throw new Error('Invalid cryptographic parameter length.');
  return bytes;
}
export async function decryptSession(text, pin) {
  if (typeof pin !== 'string' || Buffer.byteLength(pin, 'utf8') > 4096) throw new Error('PIN/passphrase exceeds 4096 UTF-8 bytes.');
  if (Buffer.byteLength(text) > MAX * 1.4) throw new Error('Export is too large.');
  const envelope = JSON.parse(text);
  if (envelope.format !== 'scrapeyy-session-encrypted' || envelope.version !== 1 || envelope.kdf?.name !== 'PBKDF2' || envelope.kdf.hash !== 'SHA-256' || !Number.isInteger(envelope.kdf.iterations) || envelope.kdf.iterations < 100000 || envelope.kdf.iterations > 1000000 || envelope.cipher?.name !== 'AES-GCM' || envelope.cipher.tagLength !== 128) throw new Error('Unsupported encryption envelope.');
  const salt = from64(envelope.kdf.salt,16), iv = from64(envelope.cipher.iv,12), ciphertext = from64(envelope.ciphertext);
  if (ciphertext.length < 16 || ciphertext.length > MAX + 16) throw new Error('Invalid ciphertext size.');
  const material = await webcrypto.subtle.importKey('raw',Buffer.from(pin,'utf8'),'PBKDF2',false,['deriveKey']);
  const key = await webcrypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:envelope.kdf.iterations},material,{name:'AES-GCM',length:256},false,['decrypt']);
  let plain;
  try { plain = await webcrypto.subtle.decrypt({name:'AES-GCM',iv,tagLength:128,additionalData:Buffer.from('scrapeyy-session-encrypted:1')},key,ciphertext); }
  catch { throw new Error('Incorrect PIN/passphrase or damaged export.'); }
  const result = JSON.parse(Buffer.from(plain).toString('utf8'));
  if (result.format !== 'scrapeyy-session' || result.version !== 1 || !Array.isArray(result.origins) || !Array.isArray(result.cookies) || !Array.isArray(result.storage)) throw new Error('Unsupported session payload.');
  return result;
}
async function main() {
  const [input,output,...extra] = process.argv.slice(2);
  if (!input || !output || extra.length) throw new Error('Usage: node scripts/decrypt-session.mjs encrypted.json output.json');
  if (!process.stdin.isTTY) throw new Error('Run in an interactive terminal to enter the PIN privately.');
  if ((await stat(input)).size > MAX * 1.4) throw new Error('Export is too large.');
  const text = await readFile(input,'utf8');
  process.stderr.write('PIN or passphrase (hidden): ');
  const muted = new Writable({write(_chunk,_encoding,done){done();}});
  const reader = createInterface({input:process.stdin,output:muted,terminal:true});
  let pin;
  try { pin = await reader.question(''); } finally { reader.close(); process.stderr.write('\n'); }
  const bundle = await decryptSession(text,pin); pin = undefined;
  await writeFile(output,JSON.stringify(bundle,null,2),{mode:0o600,flag:'wx'});
  process.stderr.write('Decrypted session written. Import with an origin-restricted consumer, then delete the plaintext file.\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error=>{process.stderr.write(`${error.message}\n`);process.exitCode=1;});
