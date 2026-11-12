import './design-system.css';
import './app.css';
import { installSwipeBack, standaloneIos } from './swipe-back.mjs';
import { installInstantTap } from './instant-tap.mjs';
import { installAppHistory } from './app-history.mjs';

// The page arrives fully drawn (prerendered), so it is painted first and the app (React, the catalog data, about a
// megabyte of script) starts right after that frame: on a phone, switching tabs shows the new page together with the
// lit tab instead of keeping the old page on screen while the script runs (owner, 2026-11-12). All styles stay in the
// one stylesheet linked in the page head (vite.config.ts: cssCodeSplit off), so nothing restyles when the app starts.
// The light handlers that a tap may need before then (the app's own page history, the back swipe, first-tap
// navigation) and the scroll memory are installed at once.
history.scrollRestoration='manual';
addEventListener('pagehide',()=>{try{sessionStorage.setItem(`nsp-scroll:${location.pathname}${location.search}`,String(Math.round(scrollY)));}catch{/* no scroll return */}});
// The page the visitor leaves the app on: iOS may close an app left in the background to free memory, and the next
// launch starts at the home page; within 30 minutes the app opens this page again (index.html), as apps do.
const rememberPage=()=>{try{localStorage.setItem('nsp-center:last-page',JSON.stringify({url:location.pathname+location.search,at:Date.now()}));}catch{/* starts at home */}};
addEventListener('pagehide',rememberPage);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')rememberPage();});
installAppHistory(window,document,standaloneIos(window));
installSwipeBack(window,document);
installInstantTap(window,document);
requestAnimationFrame(()=>setTimeout(()=>{ void import('./boot'); },0));
