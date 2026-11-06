import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const overrides=JSON.parse(read('src/product-image-overrides.json'));
const targets=JSON.parse(read('design/product-shadow-cleanup/targets.json'));
const products=JSON.parse(read('src/generated/summary.json')).products;
test('Cleaned covers preserve imported originals and are used on product pages',()=>{
 for(const target of targets){
  const replacement=overrides[target.image];
  assert.ok(replacement,target.id);
  assert.ok(existsSync(new URL('public'+replacement,root)),replacement);
  assert.equal(createHash('sha256').update(read('public'+target.image)).digest('hex'),target.sourceSha256);
  const p=products.find(p=>p.id===target.id);
  assert.equal(p.image,target.image,'Import remains unchanged');
  const html=read('dist'+p.path+'index.html').toString();
  assert.ok(html.includes('src="'+replacement+'"'),p.path);
 }
});
