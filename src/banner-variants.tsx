import { useId, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './design-system.css';
import './banner-variants.css';
import './banner-botanical.css';
import { Icon } from './ui';

const variants = [
  {id:'meadow',number:'01',name:'Луговой свет',summary:'Близко к вашему экрану: цельный шалфейный фон, живые травы и лёгкая лента по краю.',detail:'На телефоне сохраняется ступенчатый заголовок. Под ним — описание и кнопка, затем крупные баночки. Лента не проходит через текст.',tag:'Ближе к исходному'},
  {id:'ribbon',number:'02',name:'Шёлковый ритм',summary:'Плавная лента связывает растения и баночки; текст спокойно выровнен по левому краю.',detail:'На телефоне заголовок, описание и кнопка имеют общий левый край. Баночки крупнее и чуть смещены вправо, лента остаётся за ними.',tag:'Выразительная лента'},
  {id:'garden',number:'03',name:'Ботанический акцент',summary:'Больше внимания баночкам: воздушная зелень, тонкий медный штрих и свободная зона вокруг заголовка.',detail:'На телефоне сначала заголовок и баночки, затем описание с кнопкой. Так изображение появляется раньше, а текст не накладывается на растения.',tag:'Изображение раньше'},
];
function Arrow(){return <span aria-hidden="true">↗</span>;}
function OriginalBottles(){
  const id=useId().replace(/:/g,'');
  return <svg className="botanical-bottles" viewBox="800 0 490 660" role="img" aria-label="Исходные баночки хлорофилла и Омега-3 NSP с оригинальными этикетками"><defs><clipPath id={id}><path d="M898 42 Q939 34 987 42 L989 91 L981 97 Q1003 96 1004 106 L1004 138 L998 145 L1007 217 Q1011 234 1035 255 L1046 271 L1045 290 L1056 285 L1056 269 L1048 265 L1048 211 Q1049 198 1130 198 Q1210 198 1211 211 L1211 267 L1201 271 L1201 283 Q1236 292 1235 322 L1235 571 Q1236 605 1209 607 L1060 607 Q1040 605 1035 585 Q1008 591 959 590 L875 586 Q842 582 842 552 L842 278 Q842 263 858 247 L875 227 Q886 210 889 181 L895 146 L883 140 L883 106 Q884 96 905 96 L896 91 Z"/></clipPath></defs><image href="/images/hero-botanical-final.jpg" x="0" y="0" width="2048" height="682.6667" clipPath={`url(#${id})`}/></svg>;
}
function OriginalMobilePanel({bottom=false}:{bottom?:boolean}){
  return <svg className={bottom?'botanical-mobile-bottom':'botanical-mobile-header'} viewBox={bottom?'44 1576 804 180':'44 172 804 130'} role="img" aria-label={bottom?'Нижняя панель из вашего референса, без изменений':'Верхняя панель из вашего референса, без изменений'}><image href="/images/banner-v2/mobile-reference.png" width="878" height="1814"/></svg>;
}
function Banner({variant}:{variant:string}) {
  return <div className={`botanical-screen botanical--${variant}`} data-ds-id={`banner-${variant}`}>
    <div className="botanical-desktop-header"><a href="/"><img src="/icons/icon.svg" alt=""/><strong>NSP<span> Center</span></strong></a><nav><a href="/catalog/">Каталог</a><a href="/health/">План</a><a href="/blog/">Журнал</a><a href="/company/">О компании</a></nav><div><Icon name="bell"/><Icon name="bag"/><Icon name="user"/></div></div>
    <OriginalMobilePanel/>
    <section className="botanical-scene">
      <svg className="botanical-backdrop" viewBox="180 0 1100 350" preserveAspectRatio="none" aria-hidden="true"><image href={`/images/banner-v2/${variant}.png`} width="1536" height="1024"/></svg>
      <div className="botanical-copy"><h2><span>Забота о себе</span><span>в вашем ритме</span></h2><p>Продукты природы, понятные составы и маленькие привычки для большего внимания к себе.</p><a className="botanical-cta" href="/catalog/"><span className="botanical-cta-wide">Выбрать продукты</span><span className="botanical-cta-phone">Перейти к товарам</span><Icon name="arrow"/></a></div>
      <div className="botanical-product-art"><img className="botanical-plants" src={`/images/banner-v2/${variant}.png`} alt=""/><OriginalBottles/></div>
      <div className="botanical-plan"><h3>Ваш план</h3><p>Сегодня отмечено 0 из 3</p><a href="/health/">Открыть мой план <Icon name="arrow"/></a><a className="botanical-signup" href="/profile/">Зарегистрируйтесь, чтобы сохранить прогресс</a></div>
    </section>
    <OriginalMobilePanel bottom/>
  </div>;
}
function App(){
  const single=new URLSearchParams(location.search).get('variant');
  const [choice,setChoice]=useState(()=>{try{return localStorage.getItem('nsp-banner-v2-choice')||'';}catch{return '';}});
  const [message,setMessage]=useState('');
  const [mode,setMode]=useState('both');
  const picked=variants.find(v=>v.id===single);
  if(picked)return <div className="concept-single"><div className="concept-return"><a href="/banner-variants.html">← Все три варианта</a><span>{picked.number} / {picked.name} · тестовая композиция</span></div><div className="concept-single-viewport"><Banner variant={picked.id}/></div></div>;
  return <main className="variant-page">
    <header className="variant-heading" data-ds-id="variant-intro"><div><a className="variant-back" href="/image-lab.html">← Лаборатория изображений</a><div className="variant-kicker">NSP CENTER / ВАШ ЭКРАН — НОВЫЕ КОМПОЗИЦИИ</div><h1>Растения, лента и читаемый текст</h1><p>Три новых варианта для телефона и ноутбука. Цельный зелёный экран.<br/>Панели телефона — из вашего референса. Баночки и надписи на них — из исходной фотографии.</p></div></header>
    <div className="variant-toolbar" data-ds-id="variant-toolbar"><span>СРАВНЕНИЕ КОМПОЗИЦИЙ</span><div role="group" aria-label="Показывать варианты">{[['both','Рядом'],['desktop','Компьютер'],['phone','Телефон']].map(([value,label])=><button key={value} aria-pressed={mode===value} className={mode===value?'active':''} onClick={()=>setMode(value)}>{label}</button>)}</div></div>
    {variants.map(v=><section key={v.id} className={`variant-section view-${mode}`} data-ds-id={`variant-${v.id}`}><div className="variant-section-heading"><div className="variant-number">{v.number}</div><div><div className="variant-title-line"><h2>{v.name}</h2><span>{v.tag}</span></div><p>{v.summary}</p></div><button className={`btn ${choice===v.id?'btn--primary':'btn--secondary'}`} aria-pressed={choice===v.id} onClick={()=>{setChoice(v.id);try{localStorage.setItem('nsp-banner-v2-choice',v.id);setMessage(`Выбран вариант «${v.name}». Это отметка в лаборатории; главная страница не изменена.`);}catch{setMessage('Выбор отмечен. Браузер не разрешил сохранить его после закрытия.');}}}>{choice===v.id?'✓ Выбран':'Мне ближе этот'}</button></div>
      <div className="variant-pair"><div className="variant-desktop"><div className="variant-device-label"><span>КОМПЬЮТЕР</span><a href={`?variant=${v.id}`}>Открыть в полный размер ↗</a></div><div className="variant-desktop-shell"><div className="variant-window-bar"><i/><i/><i/><span>nsp-center.ru</span></div><div className="concept-viewport"><Banner variant={v.id}/></div></div></div><div className="variant-phone"><div className="variant-device-label"><span>ТЕЛЕФОН</span><span>390 px</span></div><div className="variant-phone-shell"><div className="variant-phone-top"><span>9:41</span><i/><span>▰</span></div><div className="concept-viewport"><Banner variant={v.id}/></div><div className="variant-phone-bottom"><i/></div></div></div></div><p className="variant-detail">{v.detail}</p></section>)}
    <footer className="variant-footer" data-ds-id="variant-notes"><p>Для спокойного продолжения текущего дизайна — «Луговой свет». Для более заметной ленты — «Шёлковый ритм». Чтобы быстрее показать баночки на телефоне — «Ботанический акцент».</p><small>Это примеры для выбора: верхняя и нижняя панели телефона показаны фрагментами вашего референса; кнопки на этих панелях в примере не работают. Основной сайт не изменён.</small></footer>
    {message&&<div className="variant-message" role="status"><span>{message}</span><button aria-label="Закрыть уведомление" onClick={()=>setMessage('')}>×</button></div>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
