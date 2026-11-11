import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

// The runtime image copies the server's files one by one (Dockerfile): every local module that scripts/serve.mjs
// imports, directly or through other modules, must be in that list, or the server does not start on the stand.
test('the Docker runtime image has every local module the server imports', () => {
  const docker = readFileSync('Dockerfile', 'utf8');
  const seen = new Set();
  const walk = file => {
    if (seen.has(file)) return; seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(?:^|\n)\s*import\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]|import\(['"](\.{1,2}\/[^'"]+\.m?js)['"]\)/g)) {
      const spec = m[1] ?? m[2];
      if (!/\.m?js$/.test(spec)) continue;
      walk(relative('.', join(dirname(file), spec)));
    }
  };
  walk('scripts/serve.mjs');
  for (const file of seen) assert.ok(docker.includes(`/app/${file}`), `Dockerfile copies ${file}`);
});
