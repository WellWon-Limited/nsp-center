import {webpReferences,webpContent} from '../packages/domain/webp.mjs';
import {ADMIN_PATH} from '../src/admin-path.mjs';
import {productGalleryImages,productCover} from '../src/product-media.mjs';
import packshotMasks from '../src/product-packshot-masks.json' with {type:'json'};
import {publicProduct} from './card-prices.mjs';
import React from 'react';
import {renderToString} from 'react-dom/server';
import { createServer } from 'vite';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {App,metadata,extraRoutes}=await server.ssrLoadModule('/src/App.tsx');
 // Theme pages: Article + FAQPage markup (docs/SEO.md, blog template).
 const themeJsonLd=(theme,href)=>theme?{'@context':'https://schema.org','@graph':[{'@type':'Article',headline:theme.h1,description:theme.description,url:href,dateModified:theme.updated,inLanguage:'ru'},...(theme.faq.length?[{'@type':'FAQPage',mainEntity:theme.faq.map(f=>({'@type':'Question',name:f.question,acceptedAnswer:{'@type':'Answer',text:f.answer}}))}]:[])]}:null;
 const built=JSON.parse(await readFile('packages/catalog/generated/content.json','utf8'));
 // Card prices are not public (scripts/card-prices.mjs): the pages and their embedded data carry retail prices only.
 const data=webpContent({...built,products:built.products.map(publicProduct)});const rawTemplate=await readFile('dist/index.html','utf8');
 // The app's script (src/boot.tsx) starts after the first paint (src/main.tsx); it is fetched together with the page
 // so it is ready by then.
 const bootChunk=(await readdir('dist/assets')).find(f=>/^boot-.*\.js$/.test(f));
 const template=bootChunk?rawTemplate.replace('</head>',`<link rel="modulepreload" crossorigin href="/assets/${bootChunk}"/></head>`):rawTemplate;
 const routes=[...data.routes.map(r=>({url:r.url,title:r.title})),...Array.from({length:Math.ceil(data.products.filter(p=>!p.hidden).length/28)-1},(_,i)=>({url:'/catalog/?PAGEN_1='+(i+2),title:data.routes.find(r=>r.path==='/catalog/').title})),...extraRoutes,{url:'/404/',title:'Страница не найдена'}];const manifest=[];
 // The brand once: a page named after the shop itself (the home page's «NSP-Center») is just «NSP Center».
 // Personal and staff pages stay out of search: noindex in the page and not in the sitemap.
 // The home page's first screen photo starts loading with the first line of the page (not after the styles are read).
 // Phones, tablets and computers show the same photo, so it is one file and nothing else is fetched for the first screen.
 const firstScreenIds=['omega-3-epa','uvlazhnyayushchiy-krem-dlya-litsa-spf15-moisturizing-face-cream-intensive-hydration-48-hours-spf15','colloidal-silver-forte','khlorofill-zhidkiy-chlorophyll-liquid'];
 const firstScreenImages=[...new Set(firstScreenIds.map(id=>data.products.find(p=>p.id===id)).filter(Boolean).map(productCover).filter(Boolean))];
 const firstScreenMasks=firstScreenImages.map(src=>packshotMasks[src]).filter(Boolean);
 const HOME_PRELOAD='<link rel="preload" as="image" href="/images/hero-dimensions-2026-11-13/01-mint-woodland-omega-label-v4.png" fetchpriority="high"/>'
  +[...firstScreenImages,...firstScreenMasks].map(src=>`<link rel="preload" as="image" href="${src}"/>`).join('');
 const PRIVATE=new Set([ADMIN_PATH,'/profile/purchases/','/profile/orders/','/checkout/']);
 // A product hidden from customers (a line no longer supplied) keeps its address but leaves search the same way.
 const HIDDEN=new Set(data.products.filter(p=>p.hidden).map(p=>p.path));const unlisted=path=>PRIVATE.has(path)||HIDDEN.has(path);
 const pageTitle=t=>/^nsp[\s-]*center$/i.test(String(t).trim())?'NSP Center':`${t} | NSP Center`;
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 for(const r of routes){const u=new URL(r.url,'https://nsp-center.ru');let file=u.pathname.replace(/^\//,'')+'index.html';if(u.search){const page=u.searchParams.get('PAGEN_1');file=u.pathname.replace(/^\//,'')+'page/'+page+'/index.html';}
  const meta=metadata(r.url);const themeHere=data.themes.find(t=>t.path===u.pathname);const productHere=data.products.find(p=>p.path===u.pathname);const pageData={...(themeHere?{theme:themeHere}:{}),...(productHere?{productThemes:data.themes.filter(t=>t.mainProductId===productHere.id)}:{}),product:productHere,category:data.categories.find(p=>p.path===u.pathname),article:data.articles.find(p=>p.path===u.pathname),page:data.pages.find(p=>p.path===u.pathname),...(u.pathname==='/'?{homeHtml:data.site.homeHtml,homeReviewsHtml:data.pages.find(p=>p.path==='/company/reviews/')?.html||''}:{})};const body=renderToString(React.createElement(App,{url:r.url,pageData}));meta.product=pageData.product;meta.article=pageData.article;
  const jsonLd=meta.product&&!meta.product.hidden?{'@context':'https://schema.org','@type':'Product',name:meta.product.name,sku:meta.product.article,image:productGalleryImages(meta.product).map(src=>'https://nsp-center.ru'+src),description:meta.product.description.slice(0,3000),offers:{'@type':'Offer',url:u.href,price:meta.product.prices.retail,priceCurrency:'RUB',availability:'https://schema.org/'+meta.product.availability}}:meta.article?{'@context':'https://schema.org','@type':'Article',headline:meta.article.title,description:meta.description,url:u.href}:themeJsonLd(themeHere,u.href);
  const html=template.replace(/<title>.*?<\/title>/s,`<title>${esc(pageTitle(r.title))}</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${esc(meta.description)}"/>`).replace('</head>',`${u.pathname==='/'&&!u.search?HOME_PRELOAD:''}${unlisted(u.pathname)?'<meta name="robots" content="noindex, nofollow"/>':''}<link rel="canonical" href="${esc(u.href)}"/>${jsonLd?'<script type="application/ld+json">'+JSON.stringify(jsonLd).replace(/</g,'\\u003c')+'</script>':''}</head>`).replace('<div id="root"></div>',`<div id="root" data-route="${esc(r.url)}">${body}</div><script type="application/json" id="nsp-page-data">${JSON.stringify(pageData).replace(/</g,'\\u003c')}</script>`);
  await mkdir(join('dist',file.substring(0,file.lastIndexOf('/'))),{recursive:true});await writeFile(join('dist',file),webpReferences(html));manifest.push({url:r.url,file});
 }
 for(const [from,to] of Object.entries(data.redirects)){const file=from.replace(/^\//,'')+'index.html';await mkdir(join('dist',file.substring(0,file.lastIndexOf('/'))),{recursive:true});await writeFile(join('dist',file),`<!doctype html><html lang="ru"><head><meta charset="UTF-8"><title>Перейти к продукту | NSP Center</title><meta http-equiv="refresh" content="0;url=${esc(to)}"><link rel="canonical" href="https://nsp-center.ru${esc(to)}"></head><body><a href="${esc(to)}">Перейти к карточке продукта</a></body></html>`);}
 await writeFile('dist/prerender-manifest.json',JSON.stringify({routes:manifest},null,2));
 await writeFile('dist/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.filter(r=>r.url!=='/404/'&&!unlisted(new URL(r.url,'https://nsp-center.ru').pathname)).map(r=>`<url><loc>${esc('https://nsp-center.ru'+r.url)}</loc></url>`).join('')+'</urlset>');
 await writeFile('dist/robots.txt','User-agent: *\nAllow: /\nSitemap: https://nsp-center.ru/sitemap.xml\n');
 console.log(`Prerendered ${manifest.length} documents (${data.routes.length} source routes), ${Object.keys(data.redirects).length} redirects.`);
}finally{await server.close();}
