import {isStaffPage} from '../../../packages/presentation/admin-path.mjs';
import {runningAsApp} from '../../../packages/presentation/install-state.mjs';

// Product policy, not an OS timeout: keep a brief interruption continuous, start a new visit after 30 minutes away.
export const APP_RESUME_TIMEOUT_MS=30*60*1000;
export const RESUME_PAGE_KEY='nsp-center:last-page';
export function readResumePage(storage){
 try{
  const item=JSON.parse(storage.getItem(RESUME_PAGE_KEY)||'null');
  if(!item||typeof item.url!=='string'||!item.url.startsWith('/')||item.url.startsWith('//')||item.url.includes('\\')||(isStaffPage(item.url)||/^\/api([/?#]|$)/.test(item.url))||!Number.isFinite(item.at)||item.at<=0)return null;
  return {url:item.url,at:item.at,scroll:Number.isFinite(item.scroll)&&item.scroll>=0?item.scroll:0};
 }catch{return null;}
}
export const absenceExpired=(leftAt,now,timeout=APP_RESUME_TIMEOUT_MS)=>Number.isFinite(leftAt)&&leftAt>0&&now>=leftAt&&now-leftAt>=timeout;

/** Only navigation memory is reset; account, cart, questionnaire answers and intake-plan data are retained. */
export function resetResumeNavigation(storage){
 try{
  for(const key of ['nsp-center:back-stack','nsp-center:back-restore','nsp-footer-home-position','nsp-footer-home-return','nsp-center:via-nav'])storage.removeItem(key);
  storage.setItem('nsp-center:session','1');storage.setItem('nsp-scroll:/','0');
 }catch{/* Private storage can be unavailable; routing still works. */}
}

/** Use elapsed time at foregrounding: hidden/frozen pages cannot run a reliable background countdown. */
export function installAppResume(win,doc,{now=()=>Date.now(),timeoutMs=APP_RESUME_TIMEOUT_MS}={}){
 if(!runningAsApp(win)||!win.matchMedia('(max-width:959px)').matches||(isStaffPage(win.location.pathname)||/^\/api(\/|$)/.test(win.location.pathname)))return()=>{};
 let hiddenAt=0,pending=0,navigating=false,returningHome=false;
 const baseline=new WeakMap(),edited=new Set();
 const value=el=>el.type==='checkbox'||el.type==='radio'?String(el.checked):String(el.value??'');
 const editable=el=>el?.matches?.('input,textarea,select')&&el.closest('form')&&!el.disabled&&!el.readOnly&&!el.closest('.catalog-tools,.site-search')&&!['hidden','submit','button','search'].includes(el.type);
 const focus=event=>{const el=event.target;if(editable(el)&&!baseline.has(el))baseline.set(el,value(el));};
 const edit=event=>{const el=event.target;if(!editable(el))return;if(!baseline.has(el))baseline.set(el,String(el.defaultValue??''));edited.add(el);};
 const dirty=()=>[...edited].some(el=>el.isConnected&&editable(el)&&value(el)!==baseline.get(el));
 const cancel=()=>{if(pending)win.clearTimeout(pending);pending=0;};
 const remember=()=>{
  cancel();if(returningHome)return;if(!hiddenAt)hiddenAt=now();
  try{win.localStorage.setItem(RESUME_PAGE_KEY,JSON.stringify({url:win.location.pathname+win.location.search,at:hiddenAt,scroll:Math.max(0,Math.round(win.scrollY||0))}));}catch{/* The live page can still resume using memory. */}
 };
 const resume=()=>{
  if(doc.visibilityState!=='visible'||!hiddenAt)return;
  const expired=absenceExpired(hiddenAt,now(),timeoutMs);hiddenAt=0;
  if(!expired||dirty()||navigating)return;
  // Let an explicit navigation (including a notification opening the plan) win over the automatic home route.
  cancel();pending=win.setTimeout(()=>{
   pending=0;if(doc.visibilityState!=='visible'||navigating||dirty())return;
   returningHome=true;try{resetResumeNavigation(win.sessionStorage);}catch{/* Storage may be blocked. */}
   try{win.localStorage.removeItem(RESUME_PAGE_KEY);}catch{/* no last-page restoration */}
   win.location.replace('/');
  },0);
 };
 const visibility=()=>{if(doc.visibilityState==='hidden'){navigating=false;remember();}else resume();};
 const pagehide=()=>{navigating=true;remember();};
 const beforeunload=()=>{navigating=true;cancel();};
 const pageshow=event=>{
  navigating=false;
  if(event.persisted&&!hiddenAt)try{const saved=readResumePage(win.localStorage);if(saved?.url===win.location.pathname+win.location.search)hiddenAt=saved.at;}catch{/* Memory still covers ordinary backgrounding. */}
  resume();
 };
 doc.addEventListener('visibilitychange',visibility);
 doc.addEventListener('focusin',focus,true);doc.addEventListener('input',edit,true);doc.addEventListener('change',edit,true);
 win.addEventListener('pagehide',pagehide);win.addEventListener('pageshow',pageshow);win.addEventListener('beforeunload',beforeunload);
 if(doc.visibilityState==='hidden')remember();
 return()=>{cancel();doc.removeEventListener('visibilitychange',visibility);doc.removeEventListener('focusin',focus,true);doc.removeEventListener('input',edit,true);doc.removeEventListener('change',edit,true);win.removeEventListener('pagehide',pagehide);win.removeEventListener('pageshow',pageshow);win.removeEventListener('beforeunload',beforeunload);};
}
