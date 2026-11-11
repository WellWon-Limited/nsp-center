import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { trackProducts } from './store';
import './design-system.css';
import './app.css';
import { installHomeScrollReturn } from './home-scroll-return.mjs';
import { installSwipeBack } from './swipe-back.mjs';
import { installInstantTap } from './instant-tap.mjs';
import { finishSplash, registerServiceWorker } from './pwa';
const root=document.getElementById('root')!;
const url=location.pathname+location.search;
const pageData=JSON.parse(document.getElementById('nsp-page-data')?.textContent||'{}');
trackProducts([pageData.product]);
// Returning with "Назад" puts the visitor where they left off: the scroll position is saved when leaving a page and
// restored after the page has rendered (the catalog may render client-side, after the browser's own restore attempt).
const scrollKey=()=>`nsp-scroll:${location.pathname}${location.search}`;
history.scrollRestoration='manual';
addEventListener('pagehide',()=>{try{sessionStorage.setItem(scrollKey(),String(Math.round(scrollY)));}catch{}});
if(root.hasChildNodes()&&root.dataset.route===url)hydrateRoot(root,<App url={url} pageData={pageData}/>);else createRoot(root).render(<App url={url} pageData={pageData}/>);
const homeReturn=installHomeScrollReturn(window,document);
installSwipeBack(window,document);
installInstantTap(window,document);
const navigation=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined;
const saved=homeReturn??(navigation?.type==='back_forward'||navigation?.type==='reload'?Number(sessionStorage.getItem(scrollKey())):0);
// Coming back with «Назад»: the page stays hidden (class nsp-restoring, set in index.html before the first paint) until it
// is scrolled to where the visitor left it, so the top of the page never flashes. The page may still be growing (images,
// client-rendered lists), so the scroll is retried for a moment; after 1.2 s the page is shown regardless.
const reveal=()=>{
 const html=document.documentElement;
 html.classList.remove('nsp-restoring','nsp-route-pending');
};
// Reveal the destination only after hydration restores local plan/account state. A cached offline shell may belong
// to another route; the head guard keeps that shell hidden until React has rendered the requested destination.
const restoreAndReveal=()=>{
 // A tap on the menu button before the page came alive (index.html remembers it) still opens the menu.
 if((window as {__nspMenuTap?:number}).__nspMenuTap){delete (window as {__nspMenuTap?:number}).__nspMenuTap;document.querySelector<HTMLButtonElement>('.menu-toggle[aria-expanded="false"]')?.click();}
 const started=performance.now();
 const tryScroll=()=>{
  if(saved>0)scrollTo({top:saved,behavior:'instant'});
  if(!(saved>0)||Math.abs(scrollY-saved)<4||performance.now()-started>1200){
   reveal();return;
  }
  requestAnimationFrame(tryScroll);
 };
 tryScroll();
};
if(root.dataset.hydrated==='true')restoreAndReveal();else{
 const observer=new MutationObserver(()=>{
  if(root.dataset.hydrated==='true'){observer.disconnect();restoreAndReveal();}
 });
 observer.observe(root,{attributes:true,attributeFilter:['data-hydrated']});
}
// Restored browser snapshots must not retain an unfinished entry state.
addEventListener('pageshow',event=>{if(event.persisted)reveal();});
// Clicks on the site navigation (bottom bar, header links, menu, logo) are marked, so the opened tab shows no back link.
addEventListener('click',e=>{const link=(e.target as Element|null)?.closest?.('.bottom-nav a,.desktop-nav a,.mobile-menu a,a.brand') as HTMLAnchorElement|null;if(link)try{sessionStorage.setItem('nsp-center:via-nav',new URL(link.href).pathname);}catch{/* ignore */}},true);
registerServiceWorker();
finishSplash();
