import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

// The runtime image copies the server's files one by one (Dockerfile): every local module that scripts/serve.mjs
// imports, directly or through other modules, must be in that list, or the server does not start on the stand.
test('the Docker runtime image has every local module the server imports', () => {
  const docker = readFileSync('Dockerfile', 'utf8');
  const seen = new Set();
  const pkg=JSON.parse(readFileSync('package.json','utf8'));
  const walk = file => {
    if (seen.has(file)) return; seen.add(file);
    const src = readFileSync(file, 'utf8');
    for(const match of src.matchAll(/import\s[^'"]*?from\s+['"]([^.'"][^'"]*)['"]/g)){
      if(match[1].startsWith('node:'))continue;
      const name=match[1].startsWith('@')?match[1].split('/').slice(0,2).join('/'):match[1].split('/')[0];
      assert.ok(pkg.dependencies?.[name],`${file}: ${name} is available in the production container`);
    }
    for (const m of src.matchAll(/(?:^|\n)\s*import\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]|import\(['"](\.{1,2}\/[^'"]+\.m?js)['"]\)/g)) {
      const spec = m[1] ?? m[2];
      if (!/\.m?js$/.test(spec)) continue;
      walk(relative('.', join(dirname(file), spec)));
    }
  };
  walk('scripts/serve.mjs');
  for (const file of seen) assert.ok(docker.includes(`/app/${file}`), `Dockerfile copies ${file}`);
});
