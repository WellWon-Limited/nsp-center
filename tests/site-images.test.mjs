import {videoSections} from '../src/information-content.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// The repository keeps only the images the live site uses (owner, 2026-11-11): every image under public/ is shown by a
// built page, its styles or scripts, or is part of the catalog data (product photos and certificates). Option pages and
// unused drafts do not count; the icon source app-icon.svg stays (the app icons are made from it).
const root = new URL('../', import.meta.url).pathname;
const read = p => readFileSync(join(root, p), 'utf8');

test('every image in public/ is used by the live site', { skip: !existsSync(join(root, 'dist/prerender-manifest.json')) && 'needs a build' }, () => {
  const manifest = JSON.parse(read('dist/prerender-manifest.json'));
  const files = [...manifest.routes.map(r => join('dist', r.file)), ...readdirSync(join(root, 'dist/assets')).filter(f => /\.(js|css)$/.test(f)).map(f => join('dist/assets', f)), 'dist/manifest.webmanifest', 'dist/sw.js', 'src/generated/content.json'];
  const pattern = /\/(?:images|media|icons)\/[\w\-./%]+\.(?:jpe?g|png|webp|svg|gif|avif)/gi;
  const used = new Set(files.flatMap(f => read(f).match(pattern) ?? []));
  // Hidden product videos remain available in the product editor and when a card is restored.
  for(const p of JSON.parse(read('src/generated/content.json')).products)for(const video of videoSections(p.sectionsHtml?.['Видеообзоры']??''))used.add(video.poster);
  const tracked = execFileSync('git', ['ls-files', 'public'], { cwd: root, encoding: 'utf8' }).split('\n').filter(f => /\.(jpe?g|png|webp|svg|gif|avif)$/i.test(f) && existsSync(join(root, f)));
  const unused = tracked.filter(f => f !== 'public/icons/app-icon.svg' && !used.has(f.slice('public'.length)));
  assert.deepEqual(unused, [], 'images no page of the site uses: remove them, or use them');
});
