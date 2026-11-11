import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import * as cheerio from 'cheerio';
import {productCover,productGalleryImages,productPackshotStyle} from '../src/product-media.mjs';
const root=resolve(import.meta.dirname,'..');
const products=JSON.parse(readFileSync(resolve(root,'src/generated/content.json'),'utf8')).products;
const overrides=JSON.parse(readFileSync(resolve(root,'src/product-images.json'),'utf8'));
test('Product image replacements stay local and keep every original gallery photograph available',()=>{
 for(const [id,entry]of Object.entries(overrides)){const p=products.find(p=>p.id===id);assert.ok(p,id);assert.equal(entry.original,p.image,id);assert.ok(existsSync(resolve(root,'public',entry.image.slice(1))),id);}
 for(const p of products){const gallery=productGalleryImages(p);assert.equal(gallery[0],productCover(p),p.id);assert.equal(new Set(gallery).size,gallery.length,p.id);assert.equal(gallery.length,1,p.id);for(const src of p.images)assert.ok(existsSync(resolve(root,'public',src.slice(1))),`${p.id}: original source file lost`);}
 assert.equal(productCover({id:'unmapped',image:'/original.jpg'}),'/original.jpg');
});
test('Product detail and catalog cards show the same preferred product photograph before JavaScript',()=>{
 for(const p of products.filter(p=>!p.hidden)){const $=cheerio.load(readFileSync(resolve(root,'dist',p.path.slice(1),'index.html'),'utf8'));assert.equal($('.main-product-image img').attr('src'),productCover(p),p.id);assert.equal($('.thumbnails').length,0,p.id);assert.equal($('.product-gallery img').length,1,p.id);}
 const $=cheerio.load(readFileSync(resolve(root,'dist/catalog/index.html'),'utf8'));$('.product-card').each((_,card)=>{const path=$(card).find('h3 a').attr('href'),p=products.find(p=>p.path===path);assert.ok(p,path);assert.equal($(card).find('.product-visual img').attr('src'),productCover(p),p.id);});
});

test('Every reviewed product fits its full visible packaging inside a stable image frame',()=>{
 const layouts=JSON.parse(readFileSync(resolve(root,'src/product-image-layout.json'),'utf8'));assert.equal(Object.keys(overrides).length,products.length);
 for(const p of products){const m=layouts[p.id],style=productPackshotStyle(p);assert.ok(m,p.id);assert.ok(style,p.id);assert.equal(m.image,productCover(p),p.id);const x=parseFloat(style['--packshot-left'])/100,y=parseFloat(style['--packshot-top'])/100,w=parseFloat(style['--packshot-width'])/100,h=parseFloat(style['--packshot-height'])/100;assert.ok(x+m.left*w>=-0.000001,p.id);assert.ok(y+m.top*h>=-0.000001,p.id);assert.ok(x+(m.left+m.width)*w<=1.000001,p.id);assert.ok(y+(m.top+m.height)*h<=1.000001,p.id);}
 const $=cheerio.load(readFileSync(resolve(root,'dist/index.html'),'utf8'));assert.equal($('.home-paths .product-packshot-frame').length,5);assert.equal($('.home-paths a.home-path').length,3);assert.equal($('.product-visual .stock-pill').length,0);
 const cosmetics=cheerio.load(readFileSync(resolve(root,'dist/catalog/naturalnaya-kosmetika/index.html'),'utf8'));assert.equal(cosmetics('.product-visual .stock-pill').length,0);assert.ok(cosmetics('.product-meta>.stock-pill').length>0);
});
