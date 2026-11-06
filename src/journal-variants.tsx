import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { data } from './store';
import { Icon } from './ui';
import './design-system.css';
import './app.css';
import './journal-variants.css';

const series=[
 {id:'botanical',number:'01',name:'Живые ингредиенты',description:'Шалфейный фон, естественные фактуры и крупные детали. Спокойная серия с акцентом на содержание статьи.'},
 {id:'sunlight',number:'02',name:'Тёплый дневной свет',description:'Солнечные блики, тени листьев и живые повседневные сцены. Более тёплая и эмоциональная серия.'},
 {id:'minimal',number:'03',name:'Светлый минимализм',description:'Светлый фон, немного предметов и чистая композиция. Темы легко узнаются даже на маленьком экране.'},
];
type Series=typeof series[number];
const topics=['immunity','magnesium','balance'];
const articles=data.articles.slice(0,3);
const image=(style:string,index:number)=>`/images/journal-concepts/${style}-${topics[index]}.jpg`;
const alts=['Эхинацея, имбирь, лимон и зелень — композиция к статье об иммунитете','Тыквенные семечки, миндаль, шпинат и тёмный шоколад — продукты с магнием','Сбалансированный обед с овощами, нутом и цельными злаками'];
function Journal({style}:{style:Series}){return <section className="section jv-journal" data-ds-id={`journal-concept-${style.id}`}><div className="section-heading"><div><span className="ds-kicker">Читать и узнавать</span><h2>Журнал о заботе</h2></div><a href="/blog/">Все статьи →</a></div><div className="article-grid">{articles.map((a,i)=><article className="panel article-card" key={a.id}><a href={a.path}><img src={image(style.id,i)} alt={alts[i]} width="600" height="380" loading="lazy"/><div><span className="ds-kicker">Журнал · {a.date}</span><h2>{a.title}</h2><span className="read-more">Читать статью <Icon name="arrow" size={17}/></span></div></a></article>)}</div></section>;}
function Gallery(){const[choice,setChoice]=useState('');return <main className="jv-gallery"><header><a href="/">← Главная страница</a><span className="ds-kicker">ФОТОГРАФИИ ДЛЯ ЖУРНАЛА</span><h1>Три серии.<br/>Те же истории.</h1><p>Те же статьи, заголовки и расположение карточек. Сравниваем фотографии по темам иммунитета, магния и сбалансированного питания.</p></header>{series.map(s=><section className="jv-option" key={s.id} data-ds-id={`journal-series-${s.id}`}><div className="jv-option-heading"><span>{s.number}</span><div><h2>{s.name}</h2><p>{s.description}</p></div><button aria-pressed={choice===s.id} onClick={()=>setChoice(s.id)}>{choice===s.id?'✓ Отмечен':'Выбрать'}</button></div><Journal style={s}/><div className="jv-option-links"><a href={`?series=${s.id}`}>Показать на главной <Icon name="arrow" size={16}/></a><a href={`?series=${s.id}&phone=1`}>Мобильный вид <Icon name="arrow" size={16}/></a></div></section>)}<footer><p>Сначала выбираем серию для главной. Затем в выбранном стиле можно обновить остальные изображения восьми статей. Текущие статьи и главная пока сохранены.</p>{choice&&<p role="status">Отмечена серия «{series.find(s=>s.id===choice)?.name}».</p>}</footer></main>;}
function HomePreview({style}:{style:Series}){
 const[pageData,setPageData]=useState<Record<string,unknown>|null>(null);
 useEffect(()=>{let alive=true;fetch('/').then(r=>r.text()).then(html=>{const doc=new DOMParser().parseFromString(html,'text/html');const parsed=JSON.parse(doc.getElementById('nsp-page-data')?.textContent||'{}');if(alive)setPageData(parsed);}).catch(()=>{if(alive)setPageData({});});return()=>{alive=false;};},[]);
 useEffect(()=>{if(!pageData)return;const journal=document.querySelector<HTMLElement>('[data-ds-id="home-blog"]');if(!journal)return;journal.querySelectorAll<HTMLImageElement>('.article-card img').forEach((img,i)=>{img.src=image(style.id,i);img.alt=alts[i];img.loading='eager';});const timer=setTimeout(()=>{scrollTo({top:journal.getBoundingClientRect().top+scrollY-135,behavior:'instant'});},350);return()=>clearTimeout(timer);},[pageData,style]);
 return <div className="jv-home-preview"><div className="jv-preview-toolbar"><a href="/journal-variants.html">← Все серии</a><span>{style.number} · {style.name}</span><div>{series.map(s=><a href={`?series=${s.id}`} aria-current={s.id===style.id?'page':undefined} key={s.id}>{s.number}</a>)}</div></div>{pageData?<App url="/" pageData={pageData}/>:<p className="jv-loading">Открываем главную страницу…</p>}</div>;
}
function PhoneView({style}:{style:Series}){return <main className="jv-phone-view"><header><a href="/journal-variants.html">← Все серии</a><h1>{style.number} · {style.name}</h1><p>Карточки на мобильной главной. Можно прокручивать.</p></header><iframe title={`Журнал на телефоне — ${style.name}`} src={`?series=${style.id}`}/></main>;}
const params=new URLSearchParams(location.search);const chosen=series.find(s=>s.id===params.get('series'));
createRoot(document.getElementById('root')!).render(chosen?(params.has('phone')&&innerWidth>639?<PhoneView style={chosen}/>:<HomePreview style={chosen}/>):<Gallery/>);
