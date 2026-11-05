import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';

// Installable app (PWA): writes dist/sw.js after the prerender. The service worker precaches the app shell — the built
// JS/CSS, the icons and the pages a visitor uses without a connection (home, plan, profile, cart, catalog) — so the plan
// and the habit marathon (they live in the browser's localStorage) work offline. Pages are fetched from the network
// first and fall back to the cache, then to the cached home page, which renders any route on the client.
const assets = (await readdir('dist/assets')).map(file => `/assets/${file}`);
const icons = ['/icons/icon.svg', '/icons/splash.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/manifest.webmanifest'];
const pages = ['/', '/health/', '/profile/', '/cart/', '/catalog/'];
const precache = [...pages, ...assets, ...icons];
const hash = createHash('sha256');
for (const file of assets) hash.update(file).update(await readFile(`dist${file}`));
const version = hash.digest('hex').slice(0, 12);
const template = await readFile('scripts/sw-template.js', 'utf8');
await writeFile('dist/sw.js', template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache)));
console.log(`Service worker ${version}: ${precache.length} files precached.`);
