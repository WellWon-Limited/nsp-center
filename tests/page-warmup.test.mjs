import test from 'node:test';
import vm from 'node:vm';
import {ADMIN_PATH} from '../src/admin-path.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pageOf, roomy } from '../src/page-warmup.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const base = 'https://nsp-center.ru/catalog/';

test('only same-site pages are warmed up, never site management, the API or files', () => {
  assert.equal(pageOf('/health/', base), '/health/');
  assert.equal(pageOf('/catalog/?PAGEN_1=2', base), '/catalog/?PAGEN_1=2');
  assert.equal(pageOf('/admin/', base), null);
  assert.equal(pageOf('/api/site', base), null);
  assert.equal(pageOf('/images/a.jpg', base), null);
  assert.equal(pageOf('https://nsp25.com/signup', base), null);
  assert.equal(pageOf(null, base), null, 'a link without an address');
});

test('a data saver or a slow connection warms only the tabs', () => {
  assert.equal(roomy({ connection: { saveData: true } }), false);
  assert.equal(roomy({ connection: { effectiveType: 'slow-2g' } }), false);
  assert.equal(roomy({ connection: { effectiveType: '4g' } }), true);
  assert.equal(roomy({}), true);
});

test('pages open from the service worker copy at once and refresh in the background; tabs are kept ahead', () => {
  const sw = read('scripts/sw-template.js');
  assert.match(sw, /if \(hit\) \{ event\.waitUntil\(fresh\); return hit; \}/);
  assert.match(sw, /event\.data\?\.type === 'warm'/);

  assert.match(sw, /old\.slice\(0, -1\)/, 'the previous version stays until the next update');
  const pwa = read('scripts/pwa.mjs');
  assert.match(pwa, /const pages = \['\/', '\/catalog\/', '\/consultation\/', '\/health\/', '\/profile\/', '\/cart\/'\];/);
  assert.match(pwa, /walk\('dist'\)/, 'every change of a page makes a new version');
});

test('no animated page transition: it slowed tab switches and washed the header in light green', () => {
  assert.doesNotMatch(read('src/app.css'), /@view-transition|view-transition-name/);
});

test('scrolling the catalog sections lights nothing up; a hover colour only for a real pointer', () => {
  const css = read('src/catalog-mobile-entry.css');
  assert.doesNotMatch(css, /\.catalog-entry-link:is\(:hover/);
  assert.match(css, /\(hover:hover\)\{\.catalog-entry-link:hover/);
});

test('photos: kept on the device across updates, served from it first, and warmed with the pages they belong to', async () => {
  const sw = read('scripts/sw-template.js');
  assert.match(sw, /const IMAGES = 'nsp-images';/);
  assert.match(sw, /if \(url\.pathname\.startsWith\('\/images\/'\)\) \{ event\.respondWith\(image\(request\)\); return; \}/);
  // The first-screen photos of a page, for the screen's width: the phone's <source>, else the <img>; lazy ones are not.
  const body = sw.match(/const firstScreenPhotos = ([\s\S]*?\n});/)[1];
  const firstScreenPhotos = new Function(`return (${body.replace(/;$/, '')})`)();
  const html = '<picture class="x"><source media="(max-width:639px)" srcSet="/images/a-phone.jpg"/><img src="/images/a.jpg" fetchPriority="high"/></picture><img src="/images/b.jpg" loading="lazy"/><img src="/images/c.jpg"/>';
  assert.deepEqual(firstScreenPhotos(html, 390), ['/images/a-phone.jpg', '/images/c.jpg']);
  assert.deepEqual(firstScreenPhotos(html, 1440), ['/images/a.jpg', '/images/c.jpg']);
  assert.match(read('src/page-warmup.mjs'), /postMessage\(\{ type: 'warm', urls, width: win\.innerWidth, photos \}\)/);
  const serve = read('scripts/serve.mjs');
  assert.match(serve, /kept\?'public, max-age=604800, stale-while-revalidate=86400'/);
  assert.match(serve, /res\.writeHead\(304,headers\)/);
});

test('the first row of product photos and the lead article cover load with the page, not lazily', () => {
  assert.match(read('src/ui.tsx'), /<ProductCard key=\{p\.id\} product=\{p\} eager=\{i<4\} compact=\{compact\}\/>/);
  assert.match(read('src/pages.tsx'), /<ArticleCard key=\{a\.id\} article=\{a\} first=\{i===0\}\/>/);
});

test('the service worker never caches or warms the new staff address or its retired alias',async()=>{
 const handlers=new Map(),lookups=[];let work;
 const source=read('scripts/sw-template.js').replace('__ADMIN_PATH__',JSON.stringify(ADMIN_PATH)).replace('__PRECACHE__','[]');
 vm.runInNewContext(source,{URL,self:{location:{origin:'https://nsp-center.ru'},addEventListener:(type,fn)=>handlers.set(type,fn)},caches:{open:async()=>({match:async url=>{lookups.push(url);return null}})},fetch:async()=>{throw Error('Staff page must not be warmed')}});
 for(const path of [ADMIN_PATH,ADMIN_PATH+'?section=products','/admin/'])handlers.get('fetch')({request:{method:'GET',url:'https://nsp-center.ru'+path,mode:'navigate'},respondWith:()=>assert.fail('Staff navigation intercepted')});
 handlers.get('message')({data:{type:'warm',urls:[ADMIN_PATH,ADMIN_PATH+'?section=products','/admin/','/api/admin/me']},waitUntil:promise=>work=promise});await work;assert.deepEqual(lookups,[]);
});
