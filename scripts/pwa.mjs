import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';

// Installable app (PWA): writes dist/sw.js after the prerender. The service worker precaches the app shell — the built
// JS/CSS, the icons and the tab pages (home, catalog, chat, plan, profile, cart) — so tabs open at once and the plan and
// the habit marathon (they live in the browser's localStorage) work offline. A page seen before opens from the cache
// while a fresh copy is fetched for next time (scripts/sw-template.js); the version covers every built page.
const assets = (await readdir('dist/assets')).map(file => `/assets/${file}`);
const icons = ['/icons/icon.svg', '/icons/splash.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/manifest.webmanifest'];
const pages = ['/', '/catalog/', '/consultation/', '/health/', '/profile/', '/cart/'];
const precache = [...pages, ...assets, ...icons];
const hash = createHash('sha256');
for (const file of [...assets,...icons]) hash.update(file).update(await readFile(`dist${file}`));
// Pages are kept by the service worker too (opened from its copy, refreshed in the background), so every change of a
// page makes a new version: the next visit takes the new pages and drops the old copies.
const html = async dir => (await readdir(dir, { withFileTypes: true })).flatMap(e => e.isDirectory() ? [] : e.name === 'index.html' ? [`${dir}/${e.name}`] : []);
const walk = async dir => [...await html(dir), ...(await Promise.all((await readdir(dir, { withFileTypes: true })).filter(e => e.isDirectory() && e.name !== 'assets').map(e => walk(`${dir}/${e.name}`)))).flat()];
for (const file of (await walk('dist')).sort()) hash.update(file).update(await readFile(file));
const version = hash.digest('hex').slice(0, 12);
const template = await readFile('scripts/sw-template.js', 'utf8');
await writeFile('dist/sw.js', template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache)));
console.log(`Service worker ${version}: ${precache.length} files precached.`);
