import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {load} from 'cheerio';
import {visibleCategories} from '../src/catalog-categories.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let fragments;
async function cardFragments(dist,manifest){
 if(fragments)return fragments;
 fragments=new Map();
 for(const r of manifest.routes.filter(r=>r.url.startsWith('/catalog/'))){const $=load(await readFile(join(dist,r.file),'utf8'));$('.product-card').each((_,node)=>{const href=$(node).find('.product-visual>a').attr('href');if(href&&!fragments.has(href))fragments.set(href,$.html(node));});}
 return fragments;
}
/** Category URLs created in management work without a build; old addresses redirect after an explicit deletion. */
export async function managedCatalogPage(data,manifest,dist,path){
 if(!/^\/catalog\/(?:[a-z0-9-]+\/)+$/.test(path))return null;
 if(data.redirect)return {redirect:data.redirect};
 if(!data.category)return null;
 const category=data.category,state={categories:data.categories,products:data.products};
 const base=manifest.routes.find(r=>r.url===path)??manifest.routes.find(r=>r.url==='/catalog/biologicheskie-dobavki-bady/');
 const $=load(await readFile(join(dist,base.file),'utf8'));
 $('title').text(category.name+' | NSP Center');$('meta[name="description"]').attr('content',category.name+' — продукты, составы и цены в NSP Center.');$('link[rel="canonical"]').attr('href','https://nsp-center.ru'+path);
 $('.catalog-page .page-heading h1').text(category.name);$('.catalog-mobile-entry').remove();$('.catalog-page').removeClass('catalog-page--entry');$('.pagination').remove();
 const paths=new Set(category.products),products=state.products.filter(p=>!p.hidden&&paths.has(p.path)),cards=await cardFragments(dist,manifest);
 $('.catalog-page .product-grid').html(products.slice(0,28).map(p=>cards.get(p.path)??`<article class="product-card panel"><div class="product-meta"><a class="card-title" href="${esc(p.path)}"><h3>${esc(p.name)}</h3></a><div class="product-bottom"><strong>${esc(p.prices.retail)} ₽</strong></div></div></article>`).join(''));
 $('.catalog-sidebar').html(`<a href="/catalog/">Все продукты</a>`+visibleCategories(state.categories,state.products).filter(c=>c.path!=='/catalog/').map(c=>`<a class="${c.path===path?'active':''}" href="${esc(c.path)}">${esc(c.name)}<span>${state.products.filter(p=>!p.hidden&&c.products.includes(p.path)).length}</span></a>`).join(''));
 $('#nsp-page-data').text(JSON.stringify({category}).replace(/</g,String.fromCharCode(92)+'u003c'));
 // The shared browser app renders the live category state; do not hydrate an unrelated source category's route.
 $('#root').attr('data-route','/managed-catalog-shell/');$('script[type="application/ld+json"]').remove();
 return {html:$.html()};
}
