import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const json=path=>JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
test('Corrected November price hides unlisted stock and uses current TNT article',()=>{
 const price=json('references/prices/nsp-2026-11.json'),content=json('packages/catalog/generated/content.json'),products=content.products;
 assert.equal(Object.keys(price.items).length,124);
 assert.equal(products.filter(p=>!p.hidden).length,111);
 assert.equal(products.filter(p=>p.hidden).length,65);
 for(const p of products.filter(p=>!p.hidden))assert.ok(price.items[p.article],p.id);
 for(const code of ['23329','22336','22892','23309','24074','21601'])assert.equal(products.filter(p=>p.article===code&&!p.hidden).length,1,code);
 assert.equal(products.find(p=>p.article==='4300').hidden,true);
 assert.equal(products.find(p=>p.article==='3664').hidden,true);
 assert.equal(products.some(p=>p.article==='23496'&&!p.hidden),false);
});
test('New certificate scans are local and deduplicated across the shared manifest',()=>{
 const certificates=json('src/product-certificates.json'),urls=certificates.flatMap(p=>p.documents.map(d=>d.url));
 assert.equal(urls.length,3);assert.equal(new Set(urls).size,3);
 for(const url of urls)assert.ok(existsSync(new URL('../public'+url,import.meta.url)),url);
});
