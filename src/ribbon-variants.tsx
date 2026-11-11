import { useId, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './design-system.css';
import './ribbon-variants.css';
import { MobileRibbonOptions } from './mobile-ribbon-options';
import laptopMasks from './ribbon-laptop-masks.json';
import catalogPhotoClips from './catalog-photo-clips.json';

const variants=[
 {id:'satin',number:'01',name:'Мягкий сатин',detail:'Ноутбук: лента у нижнего края баннера. Телефон: банки увеличены на 25%, оригинальные фото упаковок; ленты под банками нет.'},
 {id:'linen',number:'02',name:'Матовый лён',detail:'Более спокойная терракота с фактурой ткани. На ноутбуке лента остаётся у внешних краёв, подальше от текста.'},
 {id:'silk',number:'03',name:'Воздушный шёлк',detail:'Тонкая полупрозрачная лента с мягким медным краем. На ноутбуке — лёгкая дуга под растениями.'},
];
const mobilePath='M-50 -45 C40 20 26 105 16 190 C6 270 -10 368 38 439 C100 526 294 482 355 565 C423 658 310 731 350 820 C369 862 414 903 445 945';
function MobileCatalogPreview(){
 const id=useId().replace(/:/g,'');
 return <svg className="ribbon-screen ribbon-screen--mobile" viewBox="0 0 878 1814" role="img" aria-label="Телефон: банки увеличены на четверть, хлорофилл и Омега-3 из оригинальных фотографий каталога, декоративная лента только по краям">
  <defs>
   <clipPath id={`${id}-chlorophyll`} clipPathUnits="userSpaceOnUse"><path d={catalogPhotoClips.chlorophyll}/></clipPath>
   <clipPath id={`${id}-omega`} clipPathUnits="userSpaceOnUse"><path d={catalogPhotoClips.omega}/></clipPath>
   <filter id={`${id}-shadow`} x="-15%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#1d3a36" floodOpacity=".17"/></filter>
  </defs>
  <image href="/images/ribbon-only/satin-mobile-backdrop-v3.jpg" width="878" height="1814" preserveAspectRatio="none"/>
  <svg x="195" y="700" width="303.6" height="607.2" viewBox="0 0 600 1200" overflow="visible" filter={`url(#${id}-shadow)`}><image href="/media/upload/iblock/9f8/9f886ee00e11b06b89aafdd9e86dfc3c.png" width="600" height="1200" clipPath={`url(#${id}-chlorophyll)`}/></svg>
  <svg x="342" y="873" width="364" height="432.25" viewBox="0 0 800 950" overflow="visible" filter={`url(#${id}-shadow)`}><image href="/media/upload/iblock/159/15991bfebc3b9f99c360e466c6f0f1a8.jpg" width="800" height="950" clipPath={`url(#${id}-omega)`}/></svg>
  <svg width="878" height="302" viewBox="0 0 878 302" overflow="hidden"><image href="/images/ribbon-only/mobile-original.png" width="878" height="1814"/></svg>
  <svg y="1576" width="878" height="238" viewBox="0 1576 878 238" overflow="hidden"><image href="/images/ribbon-only/mobile-original.png" width="878" height="1814"/></svg>
 </svg>;
}
function PolishedSatin({device,original}:{device:'mobile'|'laptop';original:boolean}){
 const id=useId().replace(/:/g,'');
 const mobile=device==='mobile';
 const width=mobile?878:1971;
 const height=mobile?1814:1280;
 if(mobile&&!original)return <MobileCatalogPreview/>;
 return <svg className={`ribbon-screen ribbon-screen--${device}`} viewBox={mobile?'0 0 878 1814':'0 172 1949 1108'} role="img" aria-label={`${mobile?'Телефон':'Ноутбук'}: ${original?'исходный экран':'доработанный мягкий сатин, непрерывная лента и целые листья'}`}>
  <defs><filter id={`${id}-label-edge`}><feGaussianBlur stdDeviation="1"/></filter><mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}><rect width={width} height={height} fill="black"/>{mobile?<><rect width="878" height="302" fill="white"/><rect y="1576" width="878" height="238" fill="white"/><rect width="44" height="1814" fill="white"/><rect x="848" width="30" height="1814" fill="white"/><g fill="white" filter={`url(#${id}-label-edge)`}><rect x="308" y="1007" width="153" height="208"/><rect x="458" y="1002" width="150" height="234"/></g></>:<><rect width="1971" height="313" fill="white"/><rect y="1004" width="1971" height="276" fill="white"/><g fill="white" filter={`url(#${id}-label-edge)`}><rect x="798" y="606" width="188" height="292"/><rect x="986" y="604" width="207" height="311"/></g></>}</mask></defs>
  <image href={`/images/ribbon-only/${original?`${device}-original`:`satin-${device}-refined`}.png`} width={width} height={height} preserveAspectRatio="none"/>
  {!original&&<image href={`/images/ribbon-only/${device}-original.png`} width={width} height={height} preserveAspectRatio="none" mask={`url(#${id})`}/>}
 </svg>;
}
function RibbonScreen({variant,device,original=false}:{variant:string;device:'mobile'|'laptop';original?:boolean}){
 const id=useId().replace(/:/g,'');
 const mobile=device==='mobile';
 if(variant==='satin')return <PolishedSatin device={device} original={original}/>;
 return <svg className={`ribbon-screen ribbon-screen--${device}`} viewBox={mobile?'0 0 878 1814':'0 172 1949 1108'} role="img" aria-label={`${mobile?'Телефон':'Ноутбук'}: ${original?'исходный экран':variants.find(v=>v.id===variant)?.name}; изменяется только лента`}>
  <defs><filter id={`${id}-soft`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2"/></filter><linearGradient id={`${id}-floor`} x1="0" y1="938" x2="0" y2="1004" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="black"/><stop offset=".14" stopColor="white"/><stop offset=".96" stopColor="white"/><stop offset="1" stopColor="black"/></linearGradient><linearGradient id={`${id}-left`}><stop stopColor="white"/><stop offset=".65" stopColor="white"/><stop offset="1" stopColor="black"/></linearGradient><linearGradient id={`${id}-right`}><stop stopColor="black"/><stop offset=".3" stopColor="white"/><stop offset="1" stopColor="white"/></linearGradient><mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width={mobile?878:1971} height={mobile?1814:1280}>
   <rect width="100%" height="100%" fill="black"/>
   {mobile?<><svg x="44" y="302" width="804" height="1274" viewBox="0 0 400 900" preserveAspectRatio="none" overflow="hidden"><path d={mobilePath} fill="none" stroke="white" strokeWidth="38" strokeLinecap="round" filter={`url(#${id}-soft)`}/></svg><rect x="125" y="345" width="650" height="145" fill="black"/><rect x="100" y="512" width="690" height="83" fill="black"/><rect x="265" y="615" width="365" height="105" fill="black"/><rect x="292" y="785" width="330" height="485" fill="black"/><path d="M215 922 203 893 220 855 258 821 304 814 330 850 319 900 292 1008 293 1247 215 1245 200 1200 213 1090 234 1030 232 970Z" fill="black"/><path d="M620 940 650 868 698 866 739 911 735 990 774 1137 745 1235 621 1254Z" fill="black"/><rect x="340" y="1310" width="215" height="60" fill="black"/><rect x="270" y="1375" width="370" height="55" fill="black"/><rect x="280" y="1455" width="355" height="57" fill="black"/><rect x="145" y="1527" width="600" height="42" fill="black"/></>:<>{variant==='linen'?<><rect x="0" y="938" width="240" height="66" fill={`url(#${id}-floor)`}/><rect x="1750" y="938" width="199" height="66" fill={`url(#${id}-floor)`}/><rect x="0" y="313" width="68" height="691" fill={`url(#${id}-left)`}/><rect x="1834" y="770" width="115" height="234" fill={`url(#${id}-right)`}/></>:<path d={laptopMasks[variant as keyof typeof laptopMasks]} fill="white" filter={`url(#${id}-soft)`}/>}<rect x="510" y="340" width="905" height="604" fill="black"/><rect x="65" y="400" width="520" height="518" fill="black"/><rect x="1450" y="515" width="380" height="290" fill="black"/></>}
  </mask></defs>
  <image href={`/images/ribbon-only/${device}-original.png`} width={mobile?878:1971} height={mobile?1814:1280} preserveAspectRatio="none"/>
  {!original&&<image href={`/images/ribbon-only/${variant}-${device}.png`} y={!mobile&&variant!=='linen'?24:0} width={mobile?878:1971} height={mobile?1814:1280} preserveAspectRatio="none" mask={`url(#${id})`}/>}
 </svg>;
}
function App(){
 const params=new URLSearchParams(location.search);
 const chosen=variants.find(v=>v.id===params.get('ribbon'));
 const device=params.get('device')==='mobile'?'mobile':'laptop';
 const [original,setOriginal]=useState(false);
 const [choice,setChoice]=useState(()=>{try{return localStorage.getItem('nsp-ribbon-choice')||'';}catch{return '';}});
 const [notice,setNotice]=useState('');
 if(chosen)return <main className={`ribbon-full ribbon-full--${device}`}><div className="ribbon-full-tools"><a href="/banner-variants.html">← Все варианты ленты</a><span>{chosen.name}</span><label><input type="checkbox" checked={original} onChange={e=>setOriginal(e.target.checked)}/>Показать исходник</label></div><RibbonScreen variant={chosen.id} device={device} original={original}/></main>;
 return <main className="ribbon-lab"><header className="ribbon-intro" data-ds-id="ribbon-intro"><a href="/image-lab.html">← Лаборатория изображений</a><div className="ribbon-kicker">NSP CENTER / ТОЛЬКО ЛЕНТА</div><h1>Три варианта естественной ленты</h1><p>Те же экраны, баночки, растения и текст. Сравниваем только материал ленты и её размещение на ноутбуке.</p><div className="ribbon-tools"><label><input type="checkbox" checked={original} onChange={e=>setOriginal(e.target.checked)}/>Сравнить с исходником</label><span>Ноутбук и телефон рядом</span></div></header>
 {variants.map(v=><section key={v.id} className="ribbon-variant" data-ds-id={`ribbon-${v.id}`}><div className="ribbon-variant-heading"><span>{v.number}</span><div><h2>{v.name}</h2><p>{v.detail}</p></div><button className={`btn ${choice===v.id?'btn--primary':'btn--secondary'}`} aria-pressed={choice===v.id} onClick={()=>{setChoice(v.id);try{localStorage.setItem('nsp-ribbon-choice',v.id);setNotice(`Отмечен вариант «${v.name}».`);}catch{setNotice('Выбор отмечен, но браузер не разрешил сохранить его.');}}}>{choice===v.id?'✓ Выбран':'Выбрать вариант'}</button></div><div className="ribbon-pair"><div><div className="ribbon-device-label"><span>НОУТБУК</span><a href={`?ribbon=${v.id}&device=laptop`}>Открыть крупно ↗</a></div><div className="ribbon-laptop-shell"><RibbonScreen variant={v.id} device="laptop" original={original}/></div></div><div><div className="ribbon-device-label"><span>ТЕЛЕФОН</span><a href={`?ribbon=${v.id}&device=mobile`}>Открыть крупно ↗</a></div><RibbonScreen variant={v.id} device="mobile" original={original}/></div></div></section>)}
 <footer className="ribbon-note" data-ds-id="ribbon-note">Это визуальные примеры. Для точного сравнения можно в любой момент включить исходник. Выбор сохраняется только в этом браузере.</footer>
 {notice&&<div className="ribbon-notice" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Закрыть уведомление">×</button></div>}
 </main>;
}
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).get('mode')==='mobile-flow'?<MobileRibbonOptions/>:<App/>);
