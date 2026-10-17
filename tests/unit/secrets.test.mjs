import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean);

function scanFiles() {
  const files = new Set([...git('ls-files'), ...git('ls-files', '--others', '--exclude-standard')]);
  const data = join(ROOT, 'docs', 'data');
  if (existsSync(data)) for (const f of readdirSync(data)) if (f.endsWith('.json')) files.add('docs/data/' + f);
  return [...files];
}

const PATTERNS = [/sk-[A-Za-z0-9_-]{16,}/g, /Bearer\s+[A-Za-z0-9._-]{20,}/g, /TYPESAFE_API_KEY\s*[=:]\s*["']?[A-Za-z0-9._-]{8,}/g];
const ALLOWED = /FAKE|SENTINEL|REDACTED/;

test('U-40 no real-looking secrets in tracked/untracked files', () => {
  const envKey = process.env.TYPESAFE_API_KEY;
  const bad = [];
  for (const f of scanFiles()) {
    let text;
    try { text = readFileSync(join(ROOT, f), 'utf8'); } catch { continue; } // deleted-but-tracked
    for (const re of PATTERNS) {
      for (const m of text.matchAll(re)) if (!ALLOWED.test(m[0])) bad.push(`${f}: ${m[0].slice(0, 12)}…`);
    }
    if (envKey && envKey.length >= 8 && text.includes(envKey)) bad.push(`${f}: contains env TYPESAFE_API_KEY value`);
  }
  assert.deepEqual(bad, []);
});
