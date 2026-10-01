import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Report paths only: never echo a credential into a terminal or CI log.
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const patterns = [
  /gsk_[A-Za-z0-9]{40,}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /sk-(?:proj-)?[A-Za-z0-9_-]{40,}/,
];
const failures = [];
for (const file of files) {
  if (/(?:^|\/)(?:output|work|node_modules|\.wrangler|\.next|\.vinext)\//.test(file) || /(?:^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example')) {
    failures.push(`${file}: private or generated files must not be tracked`); continue;
  }
  const path = resolve(root, file); if (!existsSync(path)) continue;
  const bytes = readFileSync(path).toString('latin1');
  if (patterns.some(pattern => pattern.test(bytes))) failures.push(`${file}: possible credential`);
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`Checked ${files.length} tracked files: no matching credentials or browser caches.`);
