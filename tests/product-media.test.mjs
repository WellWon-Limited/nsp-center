import {webpUrl} from '../packages/domain/webp.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import * as cheerio from 'cheerio';
import {productCover,productGalleryImages,productPackshotStyle,productPackageLabel} from '../packages/presentation/product-media.mjs';
const root=resolve(import.meta.dirname,'..');
const products=JSON.parse(readFileSync(resolve(root,'packages/catalog/generated/content.json'),'utf8')).products;
const galleryEntries=JSON.parse(readFileSync(resolve(root,'packages/catalog/source/product-gallery.json'),'utf8'));
const overrides=JSON.parse(readFileSync(resolve(root,'packages/catalog/source/product-images.json'),'utf8'));
test('Product image replacements stay local and keep every original gallery photograph available',()=>{
 for(const [id,entry]of Object.entries(overrides)){const p=products.find(p=>p.id===id);assert.ok(p,id);assert.equal(entry.original,p.image,id);assert.ok(existsSync(resolve(root,'public',entry.image.slice(1))),id);}
 for(const p of products){const gallery=productGalleryImages(p);assert.equal(gallery[0],productCover(p),p.id);assert.equal(new Set(gallery).size,gallery.length,p.id);assert.equal(gallery.length,1,p.id);for(const src of p.images)assert.ok(existsSync(resolve(root,'public',src.slice(1))),`${p.id}: original source file lost`);}
 assert.equal(productCover({id:'unmapped',image:'/original.jpg'}),'/original.jpg');
});
test('Every product page uses the approved template and its own preferred photograph before JavaScript',()=>{
 for(const p of products.filter(p=>!p.hidden)){const $=cheerio.load(readFileSync(resolve(root,'dist',p.path.slice(1),'index.html'),'utf8'));assert.equal($('.main-product-image img').first().attr('src'),productCover(p),p.id);assert.equal($('.thumbnails').length,0,p.id);assert.equal($('.product-gallery img').length,1,p.id);assert.equal($('.product-detail--nature').length,1,p.id);}
 const $=cheerio.load(readFileSync(resolve(root,'dist/catalog/index.html'),'utf8'));$('.product-card').each((_,card)=>{const path=$(card).find('h3 a').attr('href'),p=products.find(p=>p.path===path);assert.ok(p,path);assert.equal($(card).find('.product-visual img').attr('src'),productCover(p),p.id);});
});

test('Every reviewed product fits its full visible packaging inside a stable image frame',()=>{
 const layouts=JSON.parse(readFileSync(resolve(root,'packages/catalog/source/product-image-layout.json'),'utf8'));assert.equal(Object.keys(overrides).length,products.length);
 for(const p of products){const m=layouts[p.id],style=productPackshotStyle(p);assert.ok(m,p.id);assert.ok(style,p.id);assert.equal(webpUrl(m.image),productCover(p),p.id);assert.notEqual(style['--packshot-mask'],'none',p.id+': package silhouette removes source shadows and badges');const x=parseFloat(style['--packshot-left'])/100,y=parseFloat(style['--packshot-top'])/100,w=parseFloat(style['--packshot-width'])/100,h=parseFloat(style['--packshot-height'])/100;assert.ok(x+m.left*w>=-0.000001,p.id);assert.ok(y+m.top*h>=-0.000001,p.id);assert.ok(x+(m.left+m.width)*w<=1.000001,p.id);assert.ok(y+(m.top+m.height)*h<=1.000001,p.id);assert.ok(Math.abs(x+(m.left+m.width/2)*w-.5)<.04,p.id+': horizontal centre');assert.ok(Math.abs(y+(m.top+m.height/2)*h-.5)<.04,p.id+': vertical centre');}
 const $=cheerio.load(readFileSync(resolve(root,'dist/index.html'),'utf8'));assert.equal($('.home-paths > a:not([data-carousel-copy]) .product-packshot-frame').length,5);assert.equal($('.home-paths > a.home-path:not([data-carousel-copy])').length,3);assert.equal($('.product-visual .stock-pill').length,0);
 const cosmetics=cheerio.load(readFileSync(resolve(root,'dist/catalog/naturalnaya-kosmetika/index.html'),'utf8'));assert.ok(cosmetics('.product-visual .stock-pill').length>0);assert.equal(cosmetics('.product-meta>.stock-pill').length,0);
});

test('Every listed product has its own connected description and the approved purchase controls',()=>{
 for(const p of products.filter(p=>!p.hidden)){
  const $=cheerio.load(readFileSync(resolve(root,'dist',p.path.slice(1),'index.html'),'utf8'));
  assert.equal($('.product-about-title').text(),'О продукте',p.id);
  assert.ok($('.product-copy>p').length>=2,p.id);
  assert.equal($('.product-copy>p').toArray().some(e=>/undefined|\[object Object\]/.test($(e).text())),false,p.id);
  assert.equal($('.product-buy-now').length,p.availability==='OutOfStock'?0:1,p.id);
  assert.equal($('.product-stock').length,1,p.id);
  assert.equal($('.product-stock').text(),p.availability==='OutOfStock'?'Нет в наличии':'В наличии',p.id);
  assert.equal($('.product-gallery .stock-pill').length,0,p.id);
  assert.equal($('#panel-properties .properties').length,1,p.id);
  assert.equal($('.product-purchase .product-short-section h2').toArray().some(e=>$(e).text()==='Противопоказания'),false,p.id);
  if(p.properties['Противопоказания (предосторожности)'])assert.ok($('#panel-properties .properties dt').toArray().some(e=>$(e).text()==='Противопоказания'),p.id);
  const entry=galleryEntries[p.id].images[0];
  assert.equal(entry.kind,'studio',p.id);
  assert.ok(entry.bounds.width>0&&entry.bounds.height>0,p.id);
  if(entry.mask)assert.ok(existsSync(resolve(root,'public',entry.mask.slice(1))),p.id);
 }
});

test('Approved catalog keeps ingredients in product details and expiry dates out of package labels',()=>{
 const $=cheerio.load(readFileSync(resolve(root,'dist/catalog/index.html'),'utf8'));
 assert.equal($('.catalog-tools input[aria-label="Поиск по каталогу"]').length,0);
 assert.equal($('.catalog-sidebar-title').length,0);
 assert.equal($('.catalog-page h1').text(),'Все продукты');
 assert.equal($('.catalog-page .card-parts').length,0);
 assert.ok($('.catalog-page .card-package').length>0);
 for(const p of products){assert.doesNotMatch(productPackageLabel(p),/годен|годности|best before|expiry/iu,p.id);}
 assert.equal(productPackageLabel({id:'colloidal-minerals-with-acai-juice',properties:{}}),'473мл');
 assert.equal(productPackageLabel({id:'ag-x',properties:{}}),'100 капсул');
});

 test('removed product photos stay removed and selected photos retain their order',()=>{
 const p={id:'aloe-vera-juice',image:'/images/original.jpg',images:[],adminImage:'',adminPhotos:[]};
 assert.equal(productCover(p),'');assert.deepEqual(productGalleryImages(p),[]);
 p.adminPhotos=['/api/files/first','/api/files/second'];p.adminImage=p.adminPhotos[0];
 assert.equal(productCover(p),'/api/files/first');assert.deepEqual(productGalleryImages(p),p.adminPhotos);
 });
