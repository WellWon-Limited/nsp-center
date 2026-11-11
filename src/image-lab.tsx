import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './design-system.css';
import './image-lab.css';

type Asset = { id: string; name: string; src: string; category: string };
type Saved = { assets: Asset[]; selected: string[]; prompt: string; placement: string; ratio: string; style: string };
const originals: Asset[] = [
  ['hero','Ботаническая композиция','hero-botanical-final.jpg','Баннеры'],
  ['omega','Омега · природный баланс','hero-omega-reference.jpg','Баннеры'],
  ['care','Шалфей · забота о себе','care-sage.jpg','Баннеры'],
  ['ingredients','Сила природных ингредиентов','journal/company-ingredients.jpg','Журнал'],
  ['skin','Омега и здоровье кожи','journal/omega-skin-warm.jpg','Журнал'],
  ['lab','Чистота и исследования','journal/about-laboratory.jpg','Журнал'],
  ['magnesium','Магний · спокойный ритм','journal/magnesium-element.jpg','Журнал'],
  ['vitamin','Витамин C · каждый день','journal/vitamin-c-warm.jpg','Журнал'],
  ['delivery','Бережная доставка','delivery-editorial.jpg','Баннеры'],
  ['carnitine','L-карнитин · студийное фото','products/l-carnitine-studio.png','Товары'],
  ['kids','Энзимозаврики · студийное фото','products/enzimozavriki-studio.png','Товары'],
  ['immune','Забота об иммунитете','journal/immune-minimal.jpg','Журнал'],
].map(([id,name,src,category])=>({id,name,src:`/images/${src}`,category}));
const defaultPrompt = 'Натуральная ботаническая композиция для NSP Center: свежие листья шалфея, мягкий утренний свет, светлый тёплый фон. Спокойное ощущение заботы о себе. Оставить свободное место слева для заголовка. Без надписей и логотипов.';
const ratios: Record<string,string> = {'16:9':'16 / 9','4:3':'4 / 3','1:1':'1','9:16':'9 / 16'};
const sizes: Record<string,[number,number]> = {'16:9':[1600,900],'4:3':[1200,900],'1:1':[1200,1200],'9:16':[900,1600]};
const styles = ['Естественное фото','Предметная съёмка','Минимализм'];

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{const r=indexedDB.open('nsp-image-lab',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
async function readWorkspace(): Promise<Saved|undefined> {
  const db=await openDatabase();try{return await new Promise((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').get('current');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}
}
async function saveWorkspace(value: Saved) {
  const db=await openDatabase();try{await new Promise<void>((resolve,reject)=>{const t=db.transaction('workspace','readwrite');t.objectStore('workspace').put(value,'current');t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}finally{db.close();}
}
function download(blob: Blob,name: string) {const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function Icon({name}: {name: string}) {return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name==='spark'?<><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/><path d="m20 2 1 3 2 1"/></>:name==='upload'?<><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/></>:name==='check'?<path d="m5 12 4 4L19 6"/>:name==='download'?<><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></>:name==='grid'?<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>:<><path d="M6 21V5l13-2v16M6 15c-6-1-5 7 0 5M19 13c-6-1-5 7 0 5"/></>}</svg>;}

function ImageLab() {
  const [assets,setAssets]=useState<Asset[]>(originals);
  const [selected,setSelected]=useState<string[]>([]);
  const [active,setActive]=useState('hero');
  const [prompt,setPrompt]=useState(defaultPrompt);
  const [placement,setPlacement]=useState('Главный баннер');
  const [ratio,setRatio]=useState('16:9');
  const [style,setStyle]=useState(styles[0]);
  const [tab,setTab]=useState('Все изображения');
  const [query,setQuery]=useState('');
  const [overlay,setOverlay]=useState(true);
  const [position,setPosition]=useState(50);
  const [message,setMessage]=useState('');
  const [ready,setReady]=useState(false);
  const [storage,setStorage]=useState('Загрузка коллекции…');
  const [busy,setBusy]=useState(false);
  const [showBrief,setShowBrief]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  const hydrated=useRef(false);
  useEffect(()=>{readWorkspace().then(s=>{if(s){setAssets([...originals,...s.assets.filter(a=>a.category==='Загруженные')]);setSelected(s.selected);setPrompt(s.prompt);setPlacement(s.placement);setRatio(s.ratio in ratios?s.ratio:'16:9');setStyle(s.style);}setStorage('Сохранено в этом браузере');}).catch(()=>setStorage('Хранилище недоступно: скачайте подборку')).finally(()=>{hydrated.current=true;setReady(true);});},[]);
  useEffect(()=>{if(!hydrated.current)return;const timer=setTimeout(()=>{setStorage('Сохраняем…');saveWorkspace({assets:assets.filter(a=>a.category==='Загруженные'),selected,prompt,placement,ratio,style}).then(()=>setStorage('Сохранено в этом браузере')).catch(()=>setStorage('Не удалось сохранить: скачайте подборку'));},350);return()=>clearTimeout(timer);},[assets,selected,prompt,placement,ratio,style,ready]);
  useEffect(()=>{if(!message)return;const t=setTimeout(()=>setMessage(''),5000);return()=>clearTimeout(t);},[message]);
  const current=assets.find(a=>a.id===active)||assets[0];
  const visible=assets.filter(a=>(tab==='Все изображения'||(tab==='Выбранные'?selected.includes(a.id):a.category===tab))&&a.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const brief={project:'NSP Center',placement,ratio,size:sizes[ratio],style,prompt,reference:{name:current.name,source:current.category==='Загруженные'?'Загруженное изображение':current.src},note:'Задание для генерации. ИИ-генератор к странице не подключён.'};
  const toggle=(id:string)=>setSelected(previous=>previous.includes(id)?previous.filter(v=>v!==id):[...previous,id]);
  async function upload(files: FileList|null) {
    if(!files?.length)return;setBusy(true);let count=0;let failed=0;
    for(const file of Array.from(files)){
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){failed++;continue;}
      try{const src=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(file);});const image=new Image();image.src=src;await image.decode();const asset={id:crypto.randomUUID(),name:file.name.replace(/\.[^.]+$/,''),src,category:'Загруженные'};setAssets(a=>[asset,...a]);setActive(asset.id);count++;}catch{failed++;}
    }
    if(count)setTab('Загруженные');setMessage(`Загружено: ${count}.${failed?` Не принято: ${failed}. Нужны JPG, PNG или WebP до 8 МБ.`:''}`);setBusy(false);if(input.current)input.current.value='';
  }
  async function exportImage() {
    setBusy(true);
    try{const image=new Image();image.src=current.src;await image.decode();const [w,h]=sizes[ratio];const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');if(!c)throw Error();const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);const iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;c.drawImage(image,(w-iw)*position/100,(h-ih)/2,iw,ih);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error();download(blob,`nsp-${current.id}-${ratio.replace(':','x')}.png`);setMessage('Изображение подготовлено к скачиванию');}catch{setMessage('Не удалось скачать изображение. Выберите другой файл.');}finally{setBusy(false);}
  }
  return <div className="lab-app">
    <aside className="lab-sidebar" data-ds-id="lab-navigation">
      <a href="/" className="lab-brand"><span className="lab-brand-mark">n<span>✳</span></span><span>NSP Center<small>ТВОРЧЕСКАЯ СТУДИЯ</small></span></a>
      <div className="lab-side-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <button className="lab-side-link active" onClick={()=>{setTab('Все изображения');setQuery('');}}><Icon name="spark"/>Лаборатория<span>01</span></button>
      <button className="lab-side-link" onClick={()=>{setTab('Выбранные');setQuery('');}}><Icon name="grid"/>Моя подборка<span>{selected.length.toString().padStart(2,'0')}</span></button>
      <div className="lab-side-note"><span className="lab-mini-star">✳</span><h3>От идеи — к образу</h3><p>Собирайте визуальный язык проекта. Пробуйте, сравнивайте, сохраняйте лучшее.</p></div>
      <div className="lab-side-bottom"><span className="lab-dot"/>Локальная лаборатория<small>NSP Center · тестовая страница</small></div>
    </aside>
    <main className="lab-main">
      <header className="lab-header" data-ds-id="lab-header"><div className="lab-breadcrumb">NSP Center <span>/</span> Инструменты <span>/</span> Изображения</div><span className="lab-test">Тестовая версия</span></header>
      <section className="lab-title" data-ds-id="lab-intro"><div><div className="lab-eyebrow">ВИЗУАЛЬНАЯ МАСТЕРСКАЯ</div><h1>Лаборатория изображений<span>✳</span></h1><p>Найдите тот самый образ для вашего проекта.</p></div><button className="btn btn--secondary" onClick={()=>input.current?.click()} disabled={busy||!ready}><Icon name="upload"/>Загрузить изображения</button><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e=>void upload(e.target.files)} aria-label="Загрузить изображения"/></section>
      <div className="lab-workbench">
        <section className="lab-controls" data-ds-id="lab-generation"><div className="lab-section-label"><span>01</span><h2>Задайте направление</h2></div>
          <label className="lab-label" htmlFor="placement">Где используем</label><select id="placement" value={placement} onChange={e=>{setPlacement(e.target.value);setRatio(e.target.value==='Карточка товара'?'1:1':e.target.value==='История / сторис'?'9:16':'16:9');}}>{['Главный баннер','Обложка статьи','Карточка товара','История / сторис'].map(v=><option key={v}>{v}</option>)}</select>
          <label className="lab-label" htmlFor="prompt">Что должно быть на изображении</label><textarea id="prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={4000} placeholder="Опишите предмет, свет, фон и настроение…"/><div className="lab-input-hint">Чем точнее описание, тем ближе результат <span>{prompt.length}/4000</span></div>
          <div className="lab-label">Визуальный стиль</div><div className="lab-style-list">{styles.map((v,i)=><button key={v} aria-pressed={style===v} className={style===v?'chosen':''} onClick={()=>setStyle(v)}><span>{['◉','◇','○'][i]}</span>{v}{style===v&&<Icon name="check"/>}</button>)}</div>
          <div className="lab-label">Формат изображения</div><div className="lab-ratios">{Object.keys(ratios).map(r=><button key={r} aria-pressed={ratio===r} className={ratio===r?'chosen':''} onClick={()=>setRatio(r)}><span style={{aspectRatio:ratios[r]}}/>{r}</button>)}</div>
          <button className="btn btn--primary lab-full" disabled={!prompt.trim()||!ready} onClick={()=>setShowBrief(true)}><Icon name="spark"/>Подготовить генерацию</button><p className="lab-provider-note">Генератор ИИ пока не подключён. Здесь можно собрать и скачать задание для генерации.</p>
        </section>
        <section className="lab-preview-panel" data-ds-id="lab-preview"><div className="lab-section-label"><span>02</span><h2>Примерьте к проекту</h2><span className="lab-preview-size">{ratio} · {sizes[ratio].join(' × ')}</span></div>
          <div className="lab-stage"><div className={`lab-preview ${ratio==='9:16'?'portrait':''}`} style={{aspectRatio:ratios[ratio]}}><img key={current.src} src={current.src} alt={current.name} style={{objectPosition:`${position}% center`}} onError={e=>{e.currentTarget.style.visibility='hidden';setMessage('Изображение недоступно. Выберите другое или загрузите своё.');}}/>{overlay&&<div className="lab-preview-copy"><span>ПРИРОДА ЗНАЕТ ЛУЧШЕ</span><h3>Ближе к природе.<br/>Ближе к себе.</h3><span className="lab-preview-cta">Откройте мир NSP <span>↗</span></span></div>}</div><div className="lab-stage-caption"><span>ПРЕДПРОСМОТР · {placement.toLocaleUpperCase()}</span><span>{current.category==='Загруженные'?'Загруженный файл':'Изображение из проекта'}</span></div></div>
          <div className="lab-preview-tools"><label className="lab-toggle"><input type="checkbox" checked={overlay} onChange={e=>setOverlay(e.target.checked)}/><span/>Показать текст</label><label className="lab-crop">Кадрирование <input type="range" min="0" max="100" value={position} onChange={e=>setPosition(Number(e.target.value))}/></label></div>
          <div className="lab-current"><div><strong>{current.name}</strong><span>{current.category} · оригинал в проекте не изменяется</span></div><button className={`btn ${selected.includes(current.id)?'btn--secondary':'btn--primary'}`} disabled={!ready} onClick={()=>toggle(current.id)}><Icon name="check"/>{selected.includes(current.id)?'В подборке':'Выбрать'}</button><button className="btn btn--secondary lab-download" disabled={busy} onClick={()=>void exportImage()} aria-label="Скачать изображение" title="Скачать изображение без текста"><Icon name="download"/></button></div>
        </section>
      </div>
      <section className="lab-library" data-ds-id="lab-library"><div className="lab-library-title"><div className="lab-section-label"><span>03</span><h2>Выберите лучшее</h2></div><span className="lab-storage">{storage}</span></div><div className="lab-library-toolbar"><div className="lab-tabs" role="group" aria-label="Категория изображений">{['Все изображения','Баннеры','Журнал','Товары','Загруженные','Выбранные'].map(t=><button key={t} aria-pressed={tab===t} className={tab===t?'chosen':''} onClick={()=>setTab(t)}>{t}{t==='Выбранные'&&<span>{selected.length}</span>}</button>)}</div><input type="search" aria-label="Найти изображение" placeholder="Найти изображение…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
        <div className="lab-grid">{visible.map(a=><article className={`lab-card ${active===a.id?'is-active':''}`} key={a.id}><button className="lab-card-image" onClick={()=>{setActive(a.id);setPosition(50);}} aria-label={`Посмотреть: ${a.name}`} aria-pressed={active===a.id}><img src={a.src} alt={a.name} loading="lazy"/><span className="lab-card-tag">{a.category}</span>{active===a.id&&<span className="lab-viewing">В предпросмотре</span>}</button><button className={`lab-pick ${selected.includes(a.id)?'picked':''}`} aria-label={`${selected.includes(a.id)?'Убрать из':'Добавить в'} подборки: ${a.name}`} aria-pressed={selected.includes(a.id)} disabled={!ready} onClick={()=>toggle(a.id)}><Icon name="check"/></button><div className="lab-card-name">{a.name}</div></article>)}</div>
        {!visible.length&&<div className="lab-empty"><Icon name="grid"/><h3>{query?'Ничего не найдено':tab==='Выбранные'?'Здесь будет ваша подборка':'Добавьте свои изображения'}</h3><p>{query?'Попробуйте другое название.':tab==='Выбранные'?'Нажмите галочку на понравившемся изображении.':'Загрузите JPG, PNG или WebP размером до 8 МБ.'}</p><button className="btn btn--secondary" onClick={()=>{if(query)setQuery('');else if(tab==='Выбранные')setTab('Все изображения');else input.current?.click();}}>{query?'Сбросить поиск':tab==='Выбранные'?'Посмотреть изображения':'Загрузить изображения'}</button></div>}
      </section>
      <footer className="lab-footer" data-ds-id="lab-selection"><span><strong>{selected.length}</strong> {selected.length===1?'изображение выбрано':'изображений выбрано'}<small>Подборка сохраняется только в этом браузере</small></span><button className="btn btn--primary" disabled={!selected.length} onClick={()=>{download(new Blob([JSON.stringify({project:'NSP Center',brief,selected:assets.filter(a=>selected.includes(a.id))},null,2)],{type:'application/json'}),'nsp-image-selection.json');setMessage('Подборка подготовлена к скачиванию');}}><Icon name="download"/>Скачать подборку</button></footer>
    </main>
    {message&&<div className="lab-toast" role="status">{message}</div>}
    {showBrief&&<BriefDialog brief={JSON.stringify(brief,null,2)} close={()=>setShowBrief(false)} notify={setMessage}/>}
  </div>;
}
function BriefDialog({brief,close,notify}:{brief:string;close:()=>void;notify:(s:string)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className="lab-dialog" onClose={close} onClick={e=>{if(e.target===e.currentTarget)close();}}><div className="lab-dialog-head"><span className="lab-eyebrow">ЗАДАНИЕ ДЛЯ ГЕНЕРАЦИИ</span><button className="btn btn--ghost" aria-label="Закрыть задание" onClick={close}>✕</button></div><h2>Идея готова к генерации</h2><p>Скопируйте задание в чат с генератором изображений. Готовые картинки загрузите в лабораторию, чтобы сравнить и выбрать.</p><textarea readOnly value={brief} aria-label="Задание для генерации"/><div className="lab-dialog-actions"><button className="btn btn--secondary" onClick={()=>download(new Blob([brief],{type:'application/json'}),'nsp-generation-brief.json')}>Скачать задание</button><button className="btn btn--primary" onClick={()=>{navigator.clipboard.writeText(brief).then(()=>notify('Задание скопировано')).catch(()=>notify('Не удалось скопировать. Скачайте задание или выделите текст.'));}}>Скопировать</button></div></dialog>;
}
createRoot(document.getElementById('root')!).render(<ImageLab/>);
