import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import './design-system.css';
import './app.css';
import { finishSplash, registerServiceWorker } from './pwa';
const root=document.getElementById('root')!;
const url=location.pathname+location.search;
const pageData=JSON.parse(document.getElementById('nsp-page-data')?.textContent||'{}');
// Returning with "Назад" puts the visitor where they left off: the scroll position is saved when leaving a page and
// restored after the page has rendered (the catalog may render client-side, after the browser's own restore attempt).
const scrollKey=()=>`nsp-scroll:${location.pathname}${location.search}`;
history.scrollRestoration='manual';
addEventListener('pagehide',()=>{try{sessionStorage.setItem(scrollKey(),String(Math.round(scrollY)));}catch{}});
if(root.hasChildNodes()&&root.dataset.route===url)hydrateRoot(root,<App url={url} pageData={pageData}/>);else createRoot(root).render(<App url={url} pageData={pageData}/>);
const navigation=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined;
const saved=navigation?.type==='back_forward'||navigation?.type==='reload'?Number(sessionStorage.getItem(scrollKey())):0;
if(saved>0)requestAnimationFrame(()=>requestAnimationFrame(()=>scrollTo({top:saved,behavior:'instant'})));
registerServiceWorker();
finishSplash();
