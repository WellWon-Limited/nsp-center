import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import article from '../design/article-concepts/first-article.json';
import './design-system.css';
import './app.css';
import { articleVariants as variants, articleImage as image, ImmuneArticleVariantContext, type ArticleVariant as Variant } from './immune-article';

function Gallery(){return <main className="av-gallery"><header><a href="/blog/">← Каталог статей</a><span className="av-kicker">ТОЛЬКО ПЕРВАЯ СТАТЬЯ</span><h1>{article.title}</h1><p>Три сдержанных оформления одной статьи. Текст сохранён; меняются композиция страницы, цвет и фотографии.</p></header><div className="av-gallery-grid">{variants.map(v=><article key={v.id}><a className={`av-cover av-cover--${v.id}`} href={`?variant=${v.id}`}><img src={image(v.image)} alt="Научная иллюстрация вирусной частицы в природной зелёной палитре" width="1536" height="1024"/><span><small>{v.n} · ЖУРНАЛ О ЗАБОТЕ</small><strong>{article.title}</strong></span></a><div><h2>{v.n} · {v.name}</h2><p>{v.detail}</p><a className="av-gallery-open" href={`?variant=${v.id}`}>Открыть статью ↗</a><a className="av-gallery-phone" href={`?variant=${v.id}&phone=1`}>На телефоне ↗</a></div></article>)}</div><p className="av-gallery-note">Варианты для выбора. Первый вариант используется в локальном проекте.</p></main>;}
function Preview({variant}:{variant:Variant}){
 const[data,setData]=useState<Record<string,unknown>|null>(null);
 useEffect(()=>{let alive=true;fetch(article.path).then(r=>r.text()).then(html=>{const doc=new DOMParser().parseFromString(html,'text/html');const value=JSON.parse(doc.getElementById('nsp-page-data')?.textContent||'{}');if(alive)setData(value);}).catch(()=>{if(alive)setData({});});return()=>{alive=false;};},[]);
 useEffect(()=>{if(data)scrollTo({top:0,behavior:'instant'});},[data]);
 return <div className="av-preview"><div className="av-toolbar"><a href="/article-variants.html">← Все варианты</a><span>{variant.n} · {variant.name}</span><div>{variants.map(v=><a key={v.id} href={`?variant=${v.id}`} aria-current={variant.id===v.id?'page':undefined}>{v.n}</a>)}</div></div>{data?<ImmuneArticleVariantContext.Provider value={variant}><App url={article.path} pageData={data}/></ImmuneArticleVariantContext.Provider>:<p className="av-loading">Открываем статью…</p>}</div>;
}
function PhoneView({variant}:{variant:Variant}){return <main className="av-phone-view"><header><a href="/article-variants.html">← Все варианты</a><h1>{variant.n} · {variant.name}</h1><p>Полная статья на телефоне. Можно прокручивать.</p></header><iframe src={`?variant=${variant.id}`} title={`Статья на телефоне — ${variant.name}`}/></main>;}
const params=new URLSearchParams(location.search);const chosen=variants.find(v=>v.id===params.get('variant'));
createRoot(document.getElementById('root')!).render(chosen?(params.has('phone')&&innerWidth>639?<PhoneView variant={chosen}/>:<Preview variant={chosen}/>):<Gallery/>);
