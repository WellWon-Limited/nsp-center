import {useEffect,useLayoutEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {App,type PageData} from './App';
import './design-system.css';
import './app.css';
import './hero-photo-options.css';
const variants=[
 {id:'forest',n:'01',name:'Лесной свет',description:'Две баночки на тёмном камне, крупная эхинацея рядом и мягкий лесной свет.',alt:'Хлорофилл и Омега-3 на тёмном камне рядом с розовой эхинацеей'},
 {id:'bloom',n:'02',name:'Крупная эхинацея',description:'Две баночки и выразительный цветок на глубоком зелёном фоне. Отдельная композиция для телефона.',alt:'Хлорофилл и Омега-3 с крупным цветком эхинацеи на переднем плане'},
 {id:'glow',n:'03',name:'Тёплый вечер',description:'Две баночки, приглушённые розовые цветы и тёплый свет на янтарном стекле.',alt:'Хлорофилл и Омега-3 с эхинацеей в тёплом вечернем свете'},
];
type Variant=typeof variants[number];
const photo=(v:Variant,format='desktop')=>`/images/hero-photo-options/${v.id}-${format}-v2.jpg`;
function Preview({variant}:{variant:Variant}){
 const[pageData,setPageData]=useState<PageData|null>(null);const[error,setError]=useState(false);
 useEffect(()=>{let active=true;fetch('/').then(r=>{if(!r.ok)throw new Error('home');return r.text();}).then(html=>{const doc=new DOMParser().parseFromString(html,'text/html');const payload=doc.getElementById('nsp-page-data')?.textContent;if(!payload)throw new Error('data');if(active)setPageData(JSON.parse(payload));}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[]);
 useLayoutEffect(()=>{if(!pageData)return;const img=document.querySelector<HTMLImageElement>('.hpo-preview .hero-photo img');if(!img)return;const source=document.querySelector<HTMLSourceElement>('.hpo-preview .hero-photo source');if(source)source.srcset=photo(variant,'mobile');img.src=photo(variant);img.alt=variant.alt;},[pageData,variant]);
 return <div className={`hpo-preview hpo-${variant.id}`}><div className="hpo-tools"><a href="/hero-photo-options.html">← Варианты</a><span>{variant.n} · {variant.name}</span><nav aria-label="Варианты главного изображения">{variants.map(v=><a key={v.id} href={`?variant=${v.id}`} aria-current={v.id===variant.id?'page':undefined}>{v.n}</a>)}</nav></div>{pageData?<App url="/" pageData={pageData}/>:<p className="hpo-loading">{error?'Не удалось открыть предпросмотр. Обновите страницу.':'Открываем главную страницу…'}</p>}</div>;
}
function Gallery(){return <main className="hpo-gallery"><header><span className="hpo-kicker">NSP CENTER · ГЛАВНОЕ ИЗОБРАЖЕНИЕ</span><h1>Три настроения.<br/>Одна забота о себе.</h1><p>В каждом варианте две баночки и эхинацея. На телефоне — отдельная вертикальная фотография во весь блок, все надписи поверх неё. Нижняя лента сохранена.</p></header><div className="hpo-grid">{variants.map(v=><article key={v.id}><a className="hpo-cover" href={`?variant=${v.id}`}><img src={photo(v)} alt={v.alt} width="2048" height="683"/></a><div className="hpo-heading"><span>{v.n}</span><h2>{v.name}</h2></div><p>{v.description}</p><a className="hpo-open" href={`?variant=${v.id}`}>Открыть на главной <span aria-hidden="true">↗</span></a></article>)}</div><p className="hpo-note">Это отдельный предпросмотр для выбора. Изображение на основной главной странице пока прежнее.</p></main>;}
const variant=variants.find(v=>v.id===new URLSearchParams(location.search).get('variant'));
createRoot(document.getElementById('root')!).render(variant?<Preview variant={variant}/>:<Gallery/>);
