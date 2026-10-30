/** Auditable, hash-pinned dependency restrictions. Never suppress validator output. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const patches = JSON.parse(await readFile(new URL('scripts/dependency-hardening.json', root), 'utf8'));
const hash = text => createHash('sha256').update(text).digest('hex');
// Validate every file before writing anything. A dependency update requires review.
const pending = [];
for (const patch of patches) {
  const url = new URL(`node_modules/${patch.path}`, root);
  let source = await readFile(url, 'utf8');
  if (hash(source) === patch.patchedSha256) continue;
  if (hash(source) !== patch.originalSha256) throw Error(`Unreviewed dependency contents: ${patch.path}`);
  for (const {before, after, count} of patch.replacements) {
    if (source.split(before).length - 1 !== count) throw Error(`Patch drift: ${patch.path}`);
    source = source.split(before).join(after);
  }
  source = (patch.notice ?? "") + source;
  if (hash(source) !== patch.patchedSha256) throw Error(`Patch hash mismatch: ${patch.path}`);
  pending.push([url, source]);
}
for (const [url, source] of pending) await writeFile(url, source);
console.log(`Verified ${patches.length} hardened dependency files (${pending.length} updated).`);
