import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile('src/generated/content.json','utf8'));
const summary={...data,products:data.products.map(p=>({...p,properties:{'Назначение':p.properties['Назначение']||'','Тип':p.properties['Тип']||''},sections:{},sectionsHtml:{},description:'',descriptionHtml:'',images:[p.image],documents:[],microdata_outside_product:[]})),categories:data.categories.map(c=>({...c,html:'',description:null})),articles:data.articles.map(a=>({...a,html:'',body:'',images:[]})),pages:data.pages.map(p=>({...p,html:'',body:'',media:[]})),site:{...data.site,header_text:'',footer_text:'',homeHtml:'',homeMedia:[]},audit:{}};
await writeFile('src/generated/summary.json',JSON.stringify(summary));
console.log(`Browser summary ${(Buffer.byteLength(JSON.stringify(summary))/1024).toFixed(0)} kB; full details rendered per route.`);
