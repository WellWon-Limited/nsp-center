import {observeLayout} from '../../../packages/presentation/observe-layout.mjs';
import {layoutScale} from '../../../packages/presentation/layout-scale.mjs';
import {data,shortName,useStore,today} from '../../../packages/presentation/store';
import {Icon} from '../../../packages/presentation/ui';
import {useEffect,useLayoutEffect,useRef,useState,type MouseEvent} from 'react';
import {homePlanPreview,completeHomePlan} from '../../../packages/presentation/intake-plan';
import {HOME_PRODUCTS_REPLAY} from './hero-heading';

function scrollToHomeSection(event:MouseEvent<HTMLAnchorElement>){
 if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const target=document.getElementById(event.currentTarget.hash.slice(1));
 if(!target)return;
 event.preventDefault();
 if(target.id==='home-showcase')window.dispatchEvent(new Event(HOME_PRODUCTS_REPLAY));
 // Section-local sizing variables may differ from the fixed header's height.
 const headerHeight=document.querySelector('.site-header')?.getBoundingClientRect().height||0;
 window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-headerHeight-16),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}

function MemberBackTop(){
 const [showTop,setShowTop]=useState(false);
 useEffect(()=>{
  const update=()=>setShowTop(window.scrollY>Math.max(240,window.innerHeight/2));
  update();window.addEventListener('scroll',update,{passive:true});
  return()=>window.removeEventListener('scroll',update);
 },[]);
 return showTop?<button type="button" className="member-to-top" aria-label="Вернуться к началу главной страницы" onClick={()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}><Icon name="chevron" size={22}/></button>:null;
}

/** The approved personal first screen reads the same daily plan as «Моё здоровье». */
export function MobileMemberHome(){
 const {state,setState,sessionReady}=useStore();
 const sheet=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{const node=sheet.current;if(!node)return;const measure=()=>{const end=node.querySelector('.member-test');if(end)node.style.setProperty('--member-sheet-height',`${(end.getBoundingClientRect().bottom-node.getBoundingClientRect().top)/layoutScale(node)+16}px`)};const stop=observeLayout([...node.children],measure);window.addEventListener('resize',measure);return()=>{stop();window.removeEventListener('resize',measure)}},[sessionReady,state.signedIn]);
 if(!sessionReady)return <section className="home-member home-member--loading" aria-busy="true" aria-label="Загружаем вашу главную страницу"><div className="member-loading-title"/><div className="member-loading-shortcuts"/><div className="member-loading-plan"/><div className="member-loading-shortcuts"/></section>;
 if(!state.signedIn||!state.account)return null;
 const entries=homePlanPreview(state.intake,new Set(data.products.map(p=>p.id)));
 const done=state.intake.filter(i=>i.done).length;
 const complete=(id:string,done:boolean)=>setState(s=>completeHomePlan(s,id,today(),done));
 return <><section ref={sheet} className="home-member home-member--sheet" data-ds-id="home-member" aria-labelledby="member-greeting">
  <header><p className="member-date">{new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})}</p><h2 id="member-greeting">Здравствуйте, {state.account.firstName}!</h2></header>
  <nav className="member-shortcuts" aria-label="Главная после входа"><a href="#home-showcase" onClick={scrollToHomeSection}>Продукты</a><a href="#home-journal" onClick={scrollToHomeSection}>Журнал</a><a href="#home-about" onClick={scrollToHomeSection}>Полезное</a></nav>
  <section className="member-plan"><div className="member-plan-title"><h2>Приём на сегодня</h2>{state.intake.length>0&&<span>{done} из {state.intake.length}</span>}</div>
   {entries.length?<ul>{entries.map(i=>{const p=data.products.find(p=>p.id===i.id)!;return <li key={i.id}><button type="button" className={`check${i.done?' done':''}`} aria-label={`${i.done?'Отменить отметку':'Отметить приём'}: ${shortName(p.name)}`} aria-pressed={i.done} onClick={()=>complete(i.id,!i.done)}>{i.done&&<Icon name="check" size={19}/>}</button><a href={p.path}>{shortName(p.name)}</a>{i.time&&<time>{i.time}</time>}</li>})}</ul>:<p className="member-plan-empty">{state.intake.length?'На сегодня всё отмечено':'Планов на сегодня ещё нет'}</p>}
   <a className="member-plan-link" href="/health/">Перейти в план <Icon name="chevron" size={17}/></a>
  </section>
  <a className="member-marathon" href="/health-marafon/"><span><strong>Марафон заботы</strong><span>День {state.day} из 21</span></span><Icon name="chevron" size={20}/></a>
  <a className="member-test" href="/diagnostic-test/"><span><strong>Что подойдёт именно вам?</strong><span>Пройдите тест и получите рекомендации</span></span><Icon name="chevron" size={20}/></a>
 </section><MemberBackTop/></>;
}
