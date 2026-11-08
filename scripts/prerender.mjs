import {productGalleryImages} from '../src/product-media.mjs';
import React from 'react';
import {renderToString} from 'react-dom/server';
import { createServer } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {App,metadata,extraRoutes}=await server.ssrLoadModule('/src/App.tsx');
 // Theme pages: Article + FAQPage markup (docs/SEO.md, blog template).
 const themeJsonLd=(theme,href)=>theme?{'@context':'https://schema.org','@graph':[{'@type':'Article',headline:theme.h1,description:theme.description,url:href,dateModified:theme.updated,inLanguage:'ru'},...(theme.faq.length?[{'@type':'FAQPage',mainEntity:theme.faq.map(f=>({'@type':'Question',name:f.question,acceptedAnswer:{'@type':'Answer',text:f.answer}}))}]:[])]}:null;
 const data=JSON.parse(await readFile('src/generated/content.json','utf8'));const template=await readFile('dist/index.html','utf8');
 const routes=[...data.routes.map(r=>({url:r.url,title:r.title})),...Array.from({length:Math.ceil(data.products.length/28)-1},(_,i)=>({url:'/catalog/?PAGEN_1='+(i+2),title:data.routes.find(r=>r.path==='/catalog/').title})),...extraRoutes,{url:'/404/',title:'Страница не найдена'}];const manifest=[];
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 for(const r of routes){const u=new URL(r.url,'https://nsp-center.ru');let file=u.pathname.replace(/^\//,'')+'index.html';if(u.search){const page=u.searchParams.get('PAGEN_1');file=u.pathname.replace(/^\//,'')+'page/'+page+'/index.html';}
  const meta=metadata(r.url);const themeHere=data.themes.find(t=>t.path===u.pathname);const productHere=data.products.find(p=>p.path===u.pathname);const pageData={...(themeHere?{theme:themeHere}:{}),...(productHere?{productThemes:data.themes.filter(t=>t.mainProductId===productHere.id)}:{}),product:productHere,category:data.categories.find(p=>p.path===u.pathname),article:data.articles.find(p=>p.path===u.pathname),page:data.pages.find(p=>p.path===u.pathname),...(u.pathname==='/'?{homeHtml:data.site.homeHtml,homeReviewsHtml:data.pages.find(p=>p.path==='/company/reviews/')?.html||''}:{})};const body=renderToString(React.createElement(App,{url:r.url,pageData}));meta.product=pageData.product;meta.article=pageData.article;
  const jsonLd=meta.product?{'@context':'https://schema.org','@type':'Product',name:meta.product.name,sku:meta.product.article,image:productGalleryImages(meta.product).map(src=>'https://nsp-center.ru'+src),description:meta.product.description.slice(0,3000),offers:{'@type':'Offer',url:u.href,price:meta.product.prices.retail,priceCurrency:'RUB',availability:'https://schema.org/'+meta.product.availability},...(meta.product.rating&&meta.product.review_count?{aggregateRating:{'@type':'AggregateRating',ratingValue:meta.product.rating,reviewCount:meta.product.review_count}}:{})}:meta.article?{'@context':'https://schema.org','@type':'Article',headline:meta.article.title,description:meta.description,url:u.href}:themeJsonLd(themeHere,u.href);
  const html=template.replace(/<title>.*?<\/title>/s,`<title>${esc(r.title)} | NSP Center</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${esc(meta.description)}"/>`).replace('</head>',`<link rel="canonical" href="${esc(u.href)}"/>${jsonLd?'<script type="application/ld+json">'+JSON.stringify(jsonLd).replace(/</g,'\\u003c')+'</script>':''}</head>`).replace('<div id="root"></div>',`<div id="root" data-route="${esc(r.url)}">${body}</div><script type="application/json" id="nsp-page-data">${JSON.stringify(pageData).replace(/</g,'\\u003c')}</script>`);
  await mkdir(join('dist',file.substring(0,file.lastIndexOf('/'))),{recursive:true});await writeFile(join('dist',file),html);manifest.push({url:r.url,file});
 }
 for(const [from,to] of Object.entries(data.redirects)){const file=from.replace(/^\//,'')+'index.html';await mkdir(join('dist',file.substring(0,file.lastIndexOf('/'))),{recursive:true});await writeFile(join('dist',file),`<!doctype html><html lang="ru"><head><meta charset="UTF-8"><title>Перейти к продукту | NSP Center</title><meta http-equiv="refresh" content="0;url=${esc(to)}"><link rel="canonical" href="https://nsp-center.ru${esc(to)}"></head><body><a href="${esc(to)}">Перейти к карточке продукта</a></body></html>`);}
 await writeFile('dist/prerender-manifest.json',JSON.stringify({routes:manifest},null,2));
 await writeFile('dist/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+routes.filter(r=>r.url!=='/404/').map(r=>`<url><loc>${esc('https://nsp-center.ru'+r.url)}</loc></url>`).join('')+'</urlset>');
 await writeFile('dist/robots.txt','User-agent: *\nAllow: /\nSitemap: https://nsp-center.ru/sitemap.xml\n');
 console.log(`Prerendered ${manifest.length} documents (${data.routes.length} source routes), ${Object.keys(data.redirects).length} redirects.`);
}finally{await server.close();}
