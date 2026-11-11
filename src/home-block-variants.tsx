import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './design-system.css';
import './app.css';
import './home-block-variants.css';

const variants=[
 {id:'photography',n:'01',name:'Живая природа',description:'Два крупных фотоблока: цветы и спокойный утренний свет. Ближе всего к выбранной странице «О компании».'},
 {id:'editorial',n:'02',name:'История в двух шагах',description:'Широкие блоки друг под другом: сначала узнать о себе, затем перейти к ежедневным привычкам.'},
 {id:'quiet',n:'03',name:'Спокойный ритм',description:'Фотография сверху, текст на светлом фоне снизу. Компактнее и удобнее для спокойного чтения.'},
];
type Variant=typeof variants[number];
function Arrow(){return <span aria-hidden="true">↗</span>;}
function CarePair({variant}:{variant:Variant}){return <div className={`hb-pair hb-pair--${variant.id}`} data-ds-id={`care-concept-${variant.id}`}>
 <a className="hb-card hb-card--test" href="/diagnostic-test/" data-ds-id="care-concept-test"><div className="hb-card-image"><img src="/images/company-concepts/botanical-v1.png" alt="Цветы эхинацеи в тёплом солнечном свете" width="1536" height="1024"/></div><div className="hb-card-copy"><span className="hb-kicker">НАЧНИТЕ С СЕБЯ · 8 ВОПРОСОВ</span><h2>Что подойдёт <br/>именно вам?</h2><p>Ответьте на вопросы о самочувствии и получите подборку с объяснением, почему она может быть вам интересна.</p><span className="hb-action">Пройти тест <Arrow/></span><span className="hb-card-note">Тест не ставит диагноз и не заменяет врача.</span></div></a>
 <a className="hb-card hb-card--habits" href="/health-marafon/" data-ds-id="care-concept-habits"><div className="hb-card-image"><img src="/images/home-care-concepts/morning-v1.png" alt="Стакан воды, льняное полотенце и блокнот в утреннем свете" width="1536" height="1024"/></div><div className="hb-card-copy"><span className="hb-kicker">МАЛЕНЬКИЕ ШАГИ · КАЖДЫЙ ДЕНЬ</span><h2>21 день <br/>заботы о себе.</h2><p>Выберите полезные привычки, отмечайте каждый день и наблюдайте за своим прогрессом. В удобном для вас ритме.</p><span className="hb-action">Начать свой марафон <Arrow/></span><span className="hb-card-note">Вода, движение и время для себя.</span></div></a>
 </div>;}
function Gallery(){const[choice,setChoice]=useState('');return <main className="hb-gallery"><header><a href="/">← Главная страница</a><span className="hb-kicker">NSP CENTER · ДВА БЛОКА ГЛАВНОЙ</span><h1>Забота начинается<br/>с первого шага.</h1><p>Три оформления теста и марафона в стиле выбранной страницы «О компании». Сравните блоки или откройте их на главной.</p></header>{variants.map(v=><section className="hb-variant" key={v.id} data-ds-id={`home-block-variant-${v.id}`}><div className="hb-variant-title"><span>{v.n}</span><div><h2>{v.name}</h2><p>{v.description}</p></div><button aria-pressed={choice===v.id} onClick={()=>setChoice(v.id)}>{choice===v.id?'✓ Выбран':'Выбрать'}</button></div><CarePair variant={v}/><div className="hb-variant-links"><a href={`?variant=${v.id}`}>Посмотреть на главной <Arrow/></a><a href={`?variant=${v.id}&phone=1`}>Мобильный вид <Arrow/></a></div></section>)}<footer><p>Это варианты для сравнения. Текущие блоки главной страницы сохранены.</p>{choice&&<p role="status">Выбран вариант «{variants.find(v=>v.id===choice)?.name}».</p>}</footer></main>;}
function HomePreview({variant}:{variant:Variant}){
 const[target,setTarget]=useState<HTMLElement|null>(null);
 const [pageData,setPageData]=useState<Record<string,unknown>|null>(null);
 useEffect(()=>{let alive=true;fetch('/').then(r=>r.text()).then(html=>{const doc=new DOMParser().parseFromString(html,'text/html');const value=JSON.parse(doc.getElementById('nsp-page-data')?.textContent||'{}');if(alive)setPageData(value);}).catch(()=>{if(alive)setPageData({});});return()=>{alive=false;};},[]);
 useEffect(()=>{if(!pageData)return;const section=document.querySelector<HTMLElement>('[data-ds-id="home-care"]');if(!section)return;section.classList.add('hb-replaced');setTarget(section);const timer=setTimeout(()=>{const top=section.getBoundingClientRect().top+scrollY-100;scrollTo({top,behavior:'instant'});},350);return()=>clearTimeout(timer);},[pageData]);
 const phone=new URLSearchParams(location.search).has('phone');
 return <div className={`hb-home-preview ${phone?'hb-home-preview--phone':''}`}><div className="hb-preview-tools"><a href="/home-block-variants.html">← Все варианты</a><span>{variant.n} · {variant.name}</span><div>{variants.map(v=><a key={v.id} href={`?variant=${v.id}${phone?'&phone=1':''}`} aria-current={v.id===variant.id?'page':undefined}>{v.n}</a>)}</div></div>{pageData?<App url="/" pageData={pageData}/>:<p className="hb-loading">Открываем главную страницу…</p>}{target&&createPortal(<CarePair variant={variant}/>,target)}</div>;
}
function PhonePresentation({variant}:{variant:Variant}){return <main className="hb-phone-demo"><header><a href="/home-block-variants.html">← Все варианты</a><h1>{variant.n} · {variant.name}</h1><p>Та же главная страница на узком экране. Можно прокручивать.</p></header><iframe src={`?variant=${variant.id}`} title={`Мобильная главная — ${variant.name}`}/></main>;}
const variant=variants.find(v=>v.id===new URLSearchParams(location.search).get('variant'));
createRoot(document.getElementById('root')!).render(variant?(new URLSearchParams(location.search).has('phone')&&innerWidth>639?<PhonePresentation variant={variant}/>:<HomePreview variant={variant}/>):<Gallery/>);
