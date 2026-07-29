/**
 * Compose GitHub push batches for the MCP `github__push_files` action.
 *
 * Reads every git-tracked TEXT file and writes /tmp/gh-batch-*.json, each a
 * complete params payload (owner/repo/branch/message/files) under the size
 * cap. Binary assets (png/mp4/ico/gz) are listed to /tmp/gh-binaries.txt —
 * push those with plain `git push` from any machine, or attach via releases.
 *
 *   node tools/compose-gh-batches.mjs <owner> <repo> [branch]
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const [owner, repo, branch = 'main'] = process.argv.slice(2);
if (!owner || !repo) {
  console.error('usage: node tools/compose-gh-batches.mjs <owner> <repo> [branch]');
  process.exit(1);
}

const BINARY = /\.(png|jpe?g|gif|webp|mp4|webm|ico|icns|gz|zip|pptx|woff2?)$/i;
const CAP = 600 * 1024; // bytes of file content per batch

const files = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n');
const binaries = files.filter((f) => BINARY.test(f));
const texts = files.filter((f) => !BINARY.test(f));

let batch = [];
let bytes = 0;
let n = 0;
const flush = () => {
  if (!batch.length) return;
  n += 1;
  const payload = {
    owner,
    repo,
    branch,
    message: `Import Stratemark source (${n}): ${batch[0].path.split('/')[0]}…`,
    files: batch,
  };
  fs.writeFileSync(`/tmp/gh-batch-${String(n).padStart(2, '0')}.json`, JSON.stringify(payload));
  console.log(`batch ${n}: ${batch.length} files, ${(bytes / 1024).toFixed(0)} KB`);
  batch = [];
  bytes = 0;
};

for (const path of texts) {
  const content = fs.readFileSync(path, 'utf8');
  if (bytes + content.length > CAP) flush();
  batch.push({ path, content });
  bytes += content.length;
}
flush();

fs.writeFileSync('/tmp/gh-binaries.txt', binaries.join('\n'));
console.log(`${n} batches → /tmp/gh-batch-*.json`);
console.log(`${binaries.length} binary files skipped (push via git): /tmp/gh-binaries.txt`);
