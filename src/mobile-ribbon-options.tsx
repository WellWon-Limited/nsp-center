import { useState } from 'react';
import './mobile-ribbon-options.css';

const options = [
 {id:'arc',name:'Плавная дуга',description:'Из левого угла лента плавно проходит над композицией и спускается вдоль правого края.',path:'M -12 -20 C 35 28 8 91 12 151 C 15 194 24 211 80 217 C 152 224 277 203 342 232 C 391 255 391 311 388 376 C 385 445 378 498 391 557 C 395 632 409 702 430 790',width:11},
 {id:'loop',name:'Свободная петля',description:'Более выразительный изгиб слева; широкая петля обрамляет растения, оставляя центр свободным.',path:'M -18 -24 C 49 17 13 79 8 131 C -1 177 13 214 69 221 C 133 228 265 204 331 221 C 412 242 413 294 392 348 C 369 408 393 448 402 484 C 420 551 368 660 422 790',width:13},
 {id:'diagonal',name:'Лёгкая диагональ',description:'Самая тонкая лента: спокойный переход слева направо и вытянутый изгиб к нижнему углу.',path:'M -8 -22 C 23 29 3 94 7 155 C 10 194 34 205 81 211 C 174 222 258 214 337 237 C 386 252 383 295 385 342 C 388 418 384 485 393 556 C 398 640 412 735 422 790',width:8},
];

function decorate(frame:HTMLIFrameElement,id:string){
 const doc=frame.contentDocument;
 if(!doc)return;
 const hero=doc.querySelector<HTMLElement>('.home-hero--banner');
 if(!hero){setTimeout(()=>decorate(frame,id),150);return;}
 if(hero.querySelector('.mobile-flow-ribbon'))return;
 const option=options.find(x=>x.id===id)!;
 const style=doc.createElement('style');
 style.textContent='.home-hero--banner .hero-photo::after{content:none!important}.mobile-flow-ribbon{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden}.home-hero--banner>.hero-copy,.home-hero--banner>.hero-daily{z-index:1}';
 doc.head.append(style);
 const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox',`0 0 402 ${hero.getBoundingClientRect().height}`);svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('class','mobile-flow-ribbon');svg.setAttribute('aria-hidden','true');
 svg.innerHTML=`<defs>
 <linearGradient id="satin" x1="0" y1="0" x2="1" y2=".3"><stop stop-color="#a84919"/><stop offset=".19" stop-color="#d87737"/><stop offset=".43" stop-color="#f2a568"/><stop offset=".64" stop-color="#cf672e"/><stop offset=".85" stop-color="#ec9351"/><stop offset="1" stop-color="#ad4d20"/></linearGradient>
 <pattern id="weave" width="2.2" height="2.2" patternUnits="userSpaceOnUse"><path d="M0 .4H2.2M.4 0V2.2" stroke="#ffe4be" stroke-width=".3" opacity=".1"/></pattern>
 <filter id="ribbon-shadow" x="-50%" y="-10%" width="200%" height="120%"><feDropShadow dx=".5" dy="1.3" stdDeviation="1.1" flood-color="#3a3b25" flood-opacity=".2"/></filter>
 </defs><g fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#ribbon-shadow)">
 <path d="${option.path}" stroke="#a65126" stroke-width="${option.width+.9}"/>
 <path d="${option.path}" stroke="url(#satin)" stroke-width="${option.width}"/>
 <path d="${option.path}" stroke="url(#weave)" stroke-width="${option.width-1.5}"/>
 <path d="${option.path}" transform="translate(-.55 -.7)" stroke="#ffe0ac" stroke-opacity=".1" stroke-width=".65"/>
 </g>`;
 hero.append(svg);
}
export function MobileRibbonOptions(){
 const [choice,setChoice]=useState('');
 return <main className="mobile-options" data-ds-id="mobile-ribbon-options"><header><a href="/">← Главная страница</a><p>NSP CENTER · ТЕЛЕФОН</p><h1>Лента из верхнего левого в нижний правый угол</h1><div>Три варианта на текущем главном экране. Банки и текст сохранены.</div></header><div className="mobile-options-grid">{options.map((option,i)=><section key={option.id} data-ds-id={`mobile-ribbon-${option.id}`}><div className="mobile-option-heading"><span>0{i+1}</span><h2>{option.name}</h2><button aria-pressed={choice===option.id} onClick={()=>setChoice(option.id)}>{choice===option.id?'✓ Выбран':'Выбрать'}</button></div><p>{option.description}</p><div className="mobile-option-phone"><iframe title={option.name} src={`/?ribbon-preview=${option.id}`} onLoad={e=>{const frame=e.currentTarget;decorate(frame,option.id);const root=frame.contentDocument?.getElementById('root');if(root){const observer=new MutationObserver(()=>decorate(frame,option.id));observer.observe(root,{childList:true,subtree:true});}}}/></div></section>)}</div>{choice&&<p className="mobile-options-choice" role="status">Выбран вариант «{options.find(x=>x.id===choice)?.name}». Это пример для сравнения; главная страница пока прежняя.</p>}</main>;
}
