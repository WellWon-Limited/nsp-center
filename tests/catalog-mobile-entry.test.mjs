import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as cheerio from 'cheerio';
test('The catalog mobile entry contains all categories and a separate all-products destination',()=>{
 const $=cheerio.load(readFileSync('dist/catalog/index.html','utf8'));
 const data=JSON.parse(readFileSync('packages/catalog/generated/content.json','utf8'));
 const nav=$('[data-ds-id=catalog-mobile-categories]');
 assert.equal(nav.find('a').first().attr('href'),'/catalog/?view=products');
 const visible=new Set(data.products.filter(p=>!p.hidden).map(p=>p.path));
 const categories=data.categories.filter(c=>c.path!=='/catalog/'&&c.products.some(path=>visible.has(path)));
 for(const c of data.categories.filter(c=>c.path!=='/catalog/'&&!c.products.some(path=>visible.has(path))))assert.equal(nav.find(`a[href="${c.path}"]`).length,0,'empty category stays in management but leaves the phone menu');
 assert.equal(nav.find('a').length,categories.length+1);
 for(const c of categories)assert.equal(nav.find(`a[href="${c.path}"]`).length,1);
 assert.ok($('.catalog-layout .product-card').length>0,'desktop keeps its existing grid in the same document');
 const category=cheerio.load(readFileSync(`dist/${categories[0].path.slice(1)}index.html`,'utf8'));
 assert.equal(category('.catalog-mobile-back[href="/catalog/"]').length,1);
 assert.equal(category('.catalog-mobile-entry').length,0);
 assert.equal(category('.catalog-layout .source-description').length,0);
});
test('All-products mode survives filters and pagination while category URLs remain intact',()=>{
 const source=readFileSync('packages/presentation/catalog.tsx','utf8');
 const start=source.indexOf('function pageUrl('),end=source.indexOf('\n return <div className={`catalog-page',start);
 const fn=source.slice(start,end).replace('n:number','n');
 const pageUrl=vm.runInNewContext(`(${fn})`,{URLSearchParams,params:new URLSearchParams('view=products'),category:{path:'/catalog/'},categoryEntry:false,q:'омега',sort:'price-asc',stock:true,favoriteOnly:false});
 const url=new URL(pageUrl(2),'http://local');
 assert.equal(url.searchParams.get('view'),'products');
 assert.equal(url.searchParams.get('q'),'омега');
 assert.equal(url.searchParams.get('PAGEN_1'),'2');
 assert.equal(url.searchParams.get('stock'),'1');
 const categoryUrl=vm.runInNewContext(`(${fn})`,{URLSearchParams,category:{path:'/catalog/naturalnaya-kosmetika/'},categoryEntry:false,q:'',sort:'default',stock:false,favoriteOnly:false});
 assert.equal(categoryUrl(1),'/catalog/naturalnaya-kosmetika/');
});

test('The homepage full-catalog action opens products directly rather than the mobile category menu',()=>{
 const $=cheerio.load(readFileSync('dist/index.html','utf8'));
 assert.equal($('[data-ds-id="home-products"] .section-heading>a').attr('href'),'/catalog/?view=products');
});


test('Every category exposes the same category-local phone search control',()=>{
 const data=JSON.parse(readFileSync('packages/catalog/generated/content.json','utf8'));
 for(const category of data.categories){
  const $=cheerio.load(readFileSync(`dist/${category.path.slice(1)}index.html`,'utf8'));
  const input=$('.catalog-tools .catalog-phone-search input[type="search"]');
  assert.equal(input.length,1,category.path);
  assert.equal(input.attr('aria-label'),'Поиск в категории');
  assert.equal(input.attr('placeholder'),'Найти продукт в этой категории');
 }
});
