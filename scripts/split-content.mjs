import {webpContent} from '../packages/domain/webp.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {themeIndex} from './themes.mjs';
import {cardFacts} from './card-facts.mjs';
import {publicProduct} from './card-prices.mjs';
const data=JSON.parse(await readFile('packages/catalog/generated/content.json','utf8'));
const byId=new Map(data.products.map(p=>[p.id,p]));
// The browser bundle carries retail prices only: card prices come from /api/card-prices after sign-in with a card.
const summary={...data,products:data.products.map(({copy,experts,...p})=>({...publicProduct(p),card:cardFacts({...p,copy,experts},byId),properties:{'Объём':p.properties['Объём']||'','Форма выпуска':p.properties['Форма выпуска']||'','Назначение':p.properties['Назначение']||'','Тип':p.properties['Тип']||''},sections:{},sectionsHtml:{},description:'',descriptionHtml:'',images:[p.image],documents:[],microdata_outside_product:[]})),categories:data.categories.map(c=>({...c,html:'',description:null})),articles:data.articles.map(a=>({...a,html:'',body:'',images:[]})),pages:data.pages.map(p=>({...p,html:'',body:'',media:[]})),site:{...data.site,header_text:'',footer_text:'',homeHtml:'',homeMedia:[]},themes:data.themes.map(themeIndex),audit:{}};
await writeFile('src/generated/summary.json',JSON.stringify(webpContent(summary)));
console.log(`Browser summary ${(Buffer.byteLength(JSON.stringify(webpContent(summary)))/1024).toFixed(0)} kB; full details rendered per route.`);
// Assistant chat (/consultation/): a compact search index of the theme pages (written from the doctors' lecture base)
// and the expert comments, loaded only on the chat page.
const chat={themes:data.themes.map(t=>({path:t.path,h1:t.h1,product:t.mainProductId,lead:t.lead,sections:t.sections.map(s=>({h:s.heading,p:s.paragraphs.join(' ')})),faq:t.faq.map(f=>({q:f.question,a:f.answer})),pairs:(t.pairs||[]).map(x=>({id:x.productId,why:x.why})),source:t.sources.find(s=>s.speaker)||t.sources[0]||null})),products:data.products.filter(p=>!p.hidden).map(p=>({id:p.id,name:p.name,path:p.path,price:p.prices.retail,partner:null,available:p.availability!=='OutOfStock',expert:p.experts?.[0]||null,usage:p.properties['Применение']||'',composition:(p.properties['Состав 1 ед. (таблетки, пакетика, порции)']||'').slice(0,600),contra:p.properties['Противопоказания (предосторожности)']||'',highlights:p.copy?.highlights||[]}))};
await writeFile('src/generated/chat-index.json',JSON.stringify(chat));
console.log(`Assistant index ${(Buffer.byteLength(JSON.stringify(chat))/1024).toFixed(0)} kB (loaded on the chat page only).`);
