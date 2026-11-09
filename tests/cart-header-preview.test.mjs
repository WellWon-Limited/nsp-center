import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as cheerio from 'cheerio';
const $=cheerio.load(readFileSync('index.html','utf8'));
const script=$('script').toArray().map(n=>$(n).html()).find(s=>s.includes('savedCartCount'));
function preview(entries={}){
 const dataset={},properties={};
 vm.runInNewContext(script,{localStorage:{getItem:key=>entries[key]??null},document:{documentElement:{dataset,style:{setProperty:(key,value)=>{properties[key]=value;}}}}});
 return {count:dataset.cartCount,text:properties['--header-cart-count']};
}
test('A saved cart count is present before hydration, including the first visit after the update',()=>{
 assert.deepEqual(preview({'nsp-center:cart-count':'7'}),{count:'7',text:'"7"'});
 assert.deepEqual(preview({'nsp-center:v1':JSON.stringify({cart:{a:2,b:3,negative:-1,invalid:'4',tooMany:100}})}),{count:'5',text:'"5"'});
 assert.deepEqual(preview(),{count:'0',text:'"0"'});
 assert.doesNotThrow(()=>preview({'nsp-center:v1':'broken'}));
});
test('Every prerendered header reserves the badge and scroll restoration never hides the header',()=>{
 for(const path of ['','health/','profile/','catalog/']){
  const doc=cheerio.load(readFileSync(`dist/${path}index.html`,'utf8'));
  assert.equal(doc('.site-header .cart-link .cart-count--bag').length,1,path);
  const css=doc('style').text();assert.ok(!/nsp-restoring\s+body\s*\{/.test(css));assert.ok(!/nsp-route-pending\s+#root\s*\{/.test(css));
 }
});
