import {readFile,writeFile} from 'node:fs/promises';
import {themeIndex} from './themes.mjs';
import {cardFacts} from './card-facts.mjs';
const data=JSON.parse(await readFile('src/generated/content.json','utf8'));
const byId=new Map(data.products.map(p=>[p.id,p]));
const summary={...data,products:data.products.map(({copy,experts,...p})=>({...p,card:cardFacts({...p,experts},byId),properties:{'Назначение':p.properties['Назначение']||'','Тип':p.properties['Тип']||''},sections:{},sectionsHtml:{},description:'',descriptionHtml:'',images:[p.image],documents:[],microdata_outside_product:[]})),categories:data.categories.map(c=>({...c,html:'',description:null})),articles:data.articles.map(a=>({...a,html:'',body:'',images:[]})),pages:data.pages.map(p=>({...p,html:'',body:'',media:[]})),site:{...data.site,header_text:'',footer_text:'',homeHtml:'',homeMedia:[]},themes:data.themes.map(themeIndex),audit:{}};
await writeFile('src/generated/summary.json',JSON.stringify(summary));
console.log(`Browser summary ${(Buffer.byteLength(JSON.stringify(summary))/1024).toFixed(0)} kB; full details rendered per route.`);
// Assistant chat (/consultation/): a compact search index of the theme pages (written from the doctors' lecture base)
// and the expert comments, loaded only on the chat page.
const chat={themes:data.themes.map(t=>({path:t.path,h1:t.h1,product:t.mainProductId,lead:t.lead,sections:t.sections.map(s=>({h:s.heading,p:s.paragraphs.join(' ')})),faq:t.faq.map(f=>({q:f.question,a:f.answer})),source:t.sources.find(s=>s.speaker)||t.sources[0]||null})),products:data.products.map(p=>({id:p.id,name:p.name,path:p.path,price:p.prices.retail,partner:p.prices.partner,available:p.availability!=='OutOfStock',expert:p.experts?.[0]||null,usage:p.properties['Применение']||'',contra:p.properties['Противопоказания (предосторожности)']||'',highlights:p.copy?.highlights||[]}))};
await writeFile('src/generated/chat-index.json',JSON.stringify(chat));
console.log(`Assistant index ${(Buffer.byteLength(JSON.stringify(chat))/1024).toFixed(0)} kB (loaded on the chat page only).`);
