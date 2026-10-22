export const MAX_BYTES = 20 * 1024 * 1024;
export const AAD = 'scrapeyy-session-encrypted:1';
export interface SessionCookie {
  name: string; value: string; domain: string; path: string;
  hostOnly: boolean; secure: boolean; httpOnly: boolean;
  sameSite: 'no_restriction' | 'lax' | 'strict' | 'unspecified';
  session: boolean; expirationDate?: number; storeId: string;
  partitionKey?: object | null; firstPartyDomain?: string;
}
export interface SessionBundle {
  format: 'scrapeyy-session'; version: 1; createdAt: string;
  source: { browser: string; locale: string; timezone: string }; origins: string[]; cookies: SessionCookie[];
  storage: {origin: string; localStorage: {name: string; value: string}[]; sessionStorage: {name: string; value: string}[]}[];
  warnings: string[];
}
export function parseOrigins(input: string): string[] {
  const origins = [...new Set(input.split(/[\s,]+/).filter(Boolean).map(value => {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hostname.includes('*') || url.pathname !== '/' || url.search || url.hash) throw new Error('Enter exact HTTP(S) origins without paths, credentials, or wildcards.');
    return url.origin;
  }))];
  if (!origins.length || origins.length > 20) throw new Error('Select between 1 and 20 origins.');
  return origins;
}
export function cookieMatches(cookie: SessionCookie, origins: string[]): boolean {
  return origins.some(origin => {
    const url = new URL(origin), domain = cookie.domain.replace(/^\./, '').toLowerCase();
    return (!cookie.secure || url.protocol === 'https:') && (cookie.hostOnly ? url.hostname === domain : url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  });
}
function base64(bytes: Uint8Array): string {
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
export async function encodeSession(bundle: SessionBundle, passphrase?: string): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(bundle));
  try {
  if (bytes.length > MAX_BYTES) throw new Error('Session exceeds the 20 MiB export limit.');
  if (passphrase === undefined) return new TextDecoder().decode(bytes);
  if (new TextEncoder().encode(passphrase).length > 4096) throw new Error('PIN/passphrase exceeds 4096 UTF-8 bytes.');
  if (!passphrase.length) throw new Error('Enter a PIN or passphrase.');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:600000},material,{name:'AES-GCM',length:256},false,['encrypt']);
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv,tagLength:128,additionalData:new TextEncoder().encode(AAD)},key,bytes);
  return JSON.stringify({format:'scrapeyy-session-encrypted',version:1,kdf:{name:'PBKDF2',hash:'SHA-256',iterations:600000,salt:base64(salt)},cipher:{name:'AES-GCM',iv:base64(iv),tagLength:128},ciphertext:base64(new Uint8Array(ciphertext))});
  } finally { bytes.fill(0); }
}
