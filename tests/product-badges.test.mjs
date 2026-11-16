import test from 'node:test';
import assert from 'node:assert/strict';
import { readProductBadges, validateProductBadges, productBadgeLabels } from '../src/product-badges.mjs';
import { applySite, readSite } from '../src/site.ts';
import { customProduct, validateNewProduct } from '../src/custom-product.mjs';

test('only the six approved discounts are accepted; malformed labels cannot create arbitrary badges',()=>{
 for(const discountPercent of [5,10,15,20,30,50]) {
  const badges={discountPercent,isNew:true,isHit:true};
  assert.deepEqual(validateProductBadges(badges).value,badges);
  assert.deepEqual(productBadgeLabels(badges).map(x=>x.text),[`−${discountPercent}%`,'Новинка','Хит продаж']);
 }
 for(const x of [null,[],{discountPercent:99,isNew:true,isHit:false},{discountPercent:10,isNew:'false',isHit:false}])assert.ok(validateProductBadges(x).error);
 assert.deepEqual(productBadgeLabels({discountPercent:'<script>',isNew:false,isHit:false}),[]);
});

test('site settings carry labels to separate copies of a product, reset without stale badges, and leave stock automatic',()=>{
 const badges={discountPercent:20,isNew:true,isHit:true};
 const site=readSite({products:{aloe:{badges,availability:'OutOfStock'}}});
 const base={id:'aloe',name:'Алоэ',prices:{retail:1000,partner:null},availability:'InStock',availability_text:'В наличии'};
 const cards=Array.from({length:5},()=>structuredClone(base));
 applySite(cards,site,100);
 for(const c of cards){assert.deepEqual(c.badges,badges);assert.equal(c.availability_text,'Нет в наличии');}
 applySite(cards,site,100);
 assert.equal(cards[0].prices.retail,1000,'labels do not silently override the administrator’s price');
 applySite(cards,readSite({products:{aloe:{badges:readProductBadges(null),availability:'InStock'}}}),100);
 for(const c of cards){assert.deepEqual(productBadgeLabels(c.badges),[]);assert.equal(c.availability_text,'В наличии');}
 applySite(cards,null,100);
 assert.deepEqual(productBadgeLabels(cards[0].badges),[]);
});

test('new products retain labels and can be edited or have every label removed',()=>{
 const cats=[{path:'/catalog/supplements/',name:'БАД',parent:'/catalog/'}];
 const badges={discountPercent:5,isNew:true,isHit:false};
 const checked=validateNewProduct({name:'Новый товар',categoryPath:cats[0].path,retailRub:1000,badges},cats);
 assert.deepEqual(checked.value.badges,badges);
 const p=customProduct('new',checked.value,cats);
 applySite([p],readSite({products:{new:{badges:{discountPercent:30,isNew:false,isHit:true}}}}),100);
 assert.deepEqual(productBadgeLabels(p.badges).map(x=>x.text),['−30%','Хит продаж']);
 applySite([p],readSite({products:{new:{badges:readProductBadges(null)}}}),100);
 assert.deepEqual(productBadgeLabels(p.badges),[]);
 assert.ok(validateNewProduct({...checked.value,badges:{discountPercent:70,isNew:true,isHit:true}},cats).error);
});
