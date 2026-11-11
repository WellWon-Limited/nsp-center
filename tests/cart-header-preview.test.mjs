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

test('Navigation destinations share header markup and header dimensions do not depend on the home route',()=>{
 let reference;
 for(const path of ['','catalog/','health/','profile/','company/','blog/']){
  const doc=cheerio.load(readFileSync(`dist/${path}index.html`,'utf8'));
  doc('.site-header .desktop-nav a').removeAttr('class').removeAttr('aria-current');
  const header=doc('.site-header').html();
  if(reference===undefined)reference=header;
  else assert.equal(header,reference,`${path}: header content or structure changed`);
 }
 const css=['src/home-hero.css','src/app.css'].map(path=>readFileSync(path,'utf8')).join('\n');
 assert.doesNotMatch(css,/:has\([^)]*home[^)]*\)[^{]*\.site-header/);
 assert.doesNotMatch(css,/:has\([^)]*home[^)]*\)\s*\{\s*--home-control-unit/);
});

test('Cart and profile reserve the screen while saved account data is loading',()=>{
 for(const path of ['cart/','profile/']){
  const doc=cheerio.load(readFileSync(`dist/${path}index.html`,'utf8'));
  assert.equal(doc('main.site-main--account-route').length,1,path);
  assert.equal(doc('main .account-route-loading[aria-busy="true"]').length,1,path);
  assert.equal(doc('main .cart-empty,main form').length,0,`${path}: transient empty/auth content must not flash`);
 }
});

test('The home plan does not prerender a guest invitation before the account is known',()=>{
 const doc=cheerio.load(readFileSync('dist/index.html','utf8'));
 const plan=doc('[data-ds-id="home-daily-plan"]');
 assert.equal(plan.attr('aria-busy'),'true');
 assert.equal(plan.find('.hero-daily-pending[role="status"]').length,1);
 assert.equal(plan.find('.hero-daily-signup,.hero-daily-action,h2').length,0,'unknown account must not be shown as a guest');
 assert.match(plan.text(),/Загружаем ваш план/);
});
