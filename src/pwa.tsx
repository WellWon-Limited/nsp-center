import {installationOnPhone,installationPlatform,relatedAppInstalled,runningAsApp,type InstallPlatform} from './install-state.mjs';
import './pwa.css';
import { useEffect, useState } from 'react';
import { data, shortName, today, useStore } from './store';
import { Icon } from './ui';
import { addNotice, namesLine } from './notices.mjs';

// Installable app (PWA, docs/DEVELOPMENT.md): the service worker (dist/sw.js, scripts/pwa.mjs) keeps the app working
// offline; this module registers it, offers the install at the top of the screen and turns plan times into reminders.

/** Registers the service worker (served by the built site; in `npm run dev` the file is absent and nothing happens). */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // A page opens from the kept copy at once; when the site has been updated, the new version takes over in the
  // background and the next page opened is the new one. The page on screen is not reloaded for it (owner, 2026-11-12:
  // that reload replayed the home heading, «Забота» appeared twice, on the first visit after an update).
  // The app may start after the page's load event (src/main.tsx paints the page first), so both cases register.
  const register = () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* the site works without it */ }); };
  if (document.readyState === 'complete') register(); else addEventListener('load', register, { once: true });
}

// Loading screen on phones only: index.html covers the first page of a visit with the circular logo on a warm light
// background before anything paints. Once the page has loaded and rendered it fades out, and the app counts as ready.
let ready = false;
const readyListeners: (() => void)[] = [];
const markReady = () => { ready = true; readyListeners.splice(0).forEach(fn => fn()); };
const whenReady = (fn: () => void) => { if (ready) fn(); else readyListeners.push(fn); };
export function finishSplash() {
  const root = document.documentElement;
  if (!root.classList.contains('nsp-splash')) { markReady(); return; }
  try { sessionStorage.setItem('nsp-center:splash', '1'); } catch { /* shown again next time */ }
  const started = performance.now();
  const hide = () => setTimeout(() => {
    document.querySelector('meta[name=theme-color]')?.setAttribute('content','#eaf5f1');
    root.classList.remove('nsp-splash', 'nsp-splash-out'); markReady();
  }, Math.max(0, 700 - (performance.now() - started)));
  if (document.readyState === 'complete') hide(); else addEventListener('load', hide, { once: true });
}

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
const standalone=()=>runningAsApp(window);

// The browser's install offer arrives once per page, possibly before React mounts, so it is caught here at load and shared
// by the install card at the top and the one in the profile. Chrome stops offering it once the app is installed.
let deferred: InstallPrompt | null = null;
let installed = false;
let installationChecked = false;
// Once installed, neither the card at the top nor the profile card offers the install again (owner, 2026-11-12), also in
// the browser tab where the related-apps check is not available.
const INSTALLED_KEY = 'nsp-center:app-installed';
function rememberInstalled(on: boolean) { try { if (on) localStorage.setItem(INSTALLED_KEY, '1'); else localStorage.removeItem(INSTALLED_KEY); } catch { /* ignore */ } }
if (typeof window !== 'undefined') { try { installed = localStorage.getItem(INSTALLED_KEY) === '1'; } catch { /* ignore */ } }
let installationCheck:Promise<void>|null=null;
const checkInstallation=()=>installationCheck??=relatedAppInstalled(window).then(found=>{installed=installed||found;installationChecked=true;changed();});
const installListeners = new Set<() => void>();
const changed = () => installListeners.forEach(fn => fn());
if (typeof window !== 'undefined') {
  // The browser offers the install only while the app is not installed: that clears the memo of an earlier install.
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallPrompt; rememberInstalled(false); changed(); });
  addEventListener('appinstalled', () => { deferred = null; installed = true; installationChecked=true; rememberInstalled(true); changed(); });
}

/** One installation state drives both the entry offer and the account card. */
export function useInstall() {
  const [, rerender] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);const update=()=>rerender(n=>n+1);installListeners.add(update);
    const modes=['standalone','minimal-ui'].map(mode=>matchMedia(`(display-mode: ${mode})`));
    modes.forEach(mode=>mode.addEventListener('change',update));
    addEventListener('pageshow',update);void checkInstallation();
    return()=>{installListeners.delete(update);modes.forEach(mode=>mode.removeEventListener('change',update));removeEventListener('pageshow',update);};
  }, []);
  const platform:InstallPlatform=mounted?installationPlatform(navigator):'other';
  const phone=mounted&&installationOnPhone(navigator);
  const available=mounted&&phone&&installationChecked&&!installed&&!standalone();
  const install=async()=>{
    if(!available||!deferred)return false;
    const offer=deferred;deferred=null;
    try{await offer.prompt();const choice=await offer.userChoice;if(choice.outcome==='accepted'){installed=true;rememberInstalled(true);}return true;}
    catch{return false;}finally{changed();}
  };
  return {available,platform,phone,install};
}

function InstallSteps({platform}:{platform:InstallPlatform}){
 const steps:Record<InstallPlatform,React.ReactNode>={
  ios:<>В Safari нажмите <strong>«Поделиться»</strong>, затем <strong>«На экран „Домой“»</strong> и <strong>«Добавить»</strong>.</>,
  android:<>В меню браузера нажмите <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong> и подтвердите установку.</>,
  'mac-safari':<>В меню Safari выберите <strong>«Файл» → «Добавить в Dock»</strong>, затем <strong>«Добавить»</strong>.</>,
  chromium:<>В меню браузера <strong>⋮</strong> выберите <strong>«Трансляция, сохранение и отправка» → «Установить страницу как приложение»</strong>. Если рядом с адресом есть значок установки, можно нажать его.</>,
  edge:<>Нажмите значок установки приложения справа в адресной строке Edge и подтвердите установку.</>,
  other:<>Для установки откройте этот сайт в Chrome, Edge или Safari на Mac. В меню браузера выберите установку приложения.</>
 };
 return <p className="install-banner-help">{steps[platform]}</p>;
}

// «Больше не спрашивать» turns the card at the top off for good in this browser (the profile card still offers the install).
// A new key (2026-11-12): «больше не спрашивать» chosen during the design checks is forgotten, the card shows again.
const neverAskKey = 'nsp-center:install-never-2';
// Any page opened with ?install=again turns the card back on (and shows it), e.g. after «Больше не спрашивать» by mistake.
const askAgain = () => { try { return new URLSearchParams(location.search).get('install') === 'again'; } catch { return false; } };
const neverAsk = () => { try { if (askAgain()) localStorage.removeItem(neverAskKey); return localStorage.getItem(neverAskKey) === '1'; } catch { return false; } };

// The card at the top comes up when the visitor enters the site or reloads a page, not on every move between pages.
// Once per visit: the first page of the tab or a reload (owner, 2026-11-12) — never while moving between pages.
const SHOWN_KEY = 'nsp-center:install-shown';
// Read once when the page opens: whether this page was reloaded by the site itself (a new version), not by the visitor.
let ownReload = false;
if (typeof window !== 'undefined') { try { ownReload = sessionStorage.getItem('nsp-center:update-reload') === '1'; sessionStorage.removeItem('nsp-center:update-reload'); } catch { /* ignore */ } }
const enteredOrReloaded = () => {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (askAgain()) return true;
  if (nav?.type === 'reload') return !ownReload;
  try { if (sessionStorage.getItem(SHOWN_KEY)) return false; } catch { /* first page */ }
  try { return !document.referrer || new URL(document.referrer).origin !== location.origin; } catch { return true; }
};

/** "Установите приложение": after the page has loaded (and the loading screen is gone) a card drops in at the top and the
 *  rest of the screen dims until "×" or "Установить". On Android and desktop Chrome/Edge the button starts the browser's
 *  install right away; iPhone Safari has no such call, so the button shows the taps that add the app to the home screen.
 *  Shown again on every visit and reload until the app is installed or the visitor taps «Больше не спрашивать»; never inside
 *  the installed app. */
export function InstallBanner() {
  const { available, platform, phone, install } = useInstall();
  const [help, setHelp] = useState(false);
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!available || closed || open || !enteredOrReloaded() || neverAsk()) return;
    let timer = 0;
    let cancelled = false;
    whenReady(() => {
      if (cancelled) return;
      // Let the visitor read the complete home heading before dimming the page.
      // Finished or reduced-motion entrances resolve immediately; other pages keep the short delay.
      const heading = document.querySelector('.hero-copy h1');
      const entrance = heading?.getAnimations({ subtree: true }) ?? [];
      void Promise.allSettled(entrance.map(animation => animation.finished)).then(() => {
        if (!cancelled) timer = window.setTimeout(() => { try { sessionStorage.setItem(SHOWN_KEY, '1'); } catch { /* ignore */ } setOpen(true); }, 400);
      });
    });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [available, closed, open]);
  if (!open || closed || !available) return null;
  const close = () => setClosed(true);
  const stopAsking = () => { try { localStorage.setItem(neverAskKey, '1'); } catch { /* ignore */ } close(); };
  const start = async () => { if (await install()) close(); else setHelp(v => !v); };
  return <><div className="install-backdrop" aria-hidden="true" />
  <div className="install-banner" role="dialog" aria-modal="true" aria-label="Установка приложения" data-ds-id="install-banner">
    <div className="install-banner-row">
      <img src="/icons/icon-192.png" alt="" width="52" height="52" />
      <div className="install-banner-text"><strong>Установите приложение NSP Center</strong><span>{phone?'Иконка появится на экране телефона':'Открывайте сайт отдельным приложением'}</span></div>
      <button type="button" className="install-banner-close" onClick={close} aria-label="Скрыть"><Icon name="close" size={18} /></button>
    </div>
    <button type="button" className="btn btn--primary install-banner-action" onClick={start}>Установить</button>
    <button type="button" className="install-banner-never" onClick={stopAsking}>Больше не спрашивать</button>
    {help && <InstallSteps platform={platform}/>}
  </div></>;
}

/** Profile card "Приложение NSP Center" with the same install action; hidden once the app is installed. */
export function InstallAppCard() {
  const { available, platform, phone, install } = useInstall();
  const [help, setHelp] = useState(false);
  if (!available) return null;
  const start = async () => { if (!(await install())) setHelp(v => !v); };
  return <section className="account-card install-card" data-ds-id="account-install">
    <div className="install-banner-row">
      <img src="/icons/icon-192.png" alt="" width="52" height="52" />
      <div className="install-banner-text"><strong>Приложение NSP Center</strong><span>{phone?'Установите его — иконка появится на экране телефона':'Установите его и открывайте сайт отдельным приложением'}</span></div>
    </div>
    <button type="button" className="btn btn--primary install-banner-action" onClick={start}>Установить приложение</button>
    {help && <InstallSteps platform={platform}/>}
  </section>;
}

/** Plan reminders: while the app is open (or still running in the background), at each product's time a reminder goes to
 *  the bell and, with permission, to the phone's notification shade. Reminders when the app is fully closed need a push
 *  server, which the site does not have yet. */
export function useIntakeReminders() {
  const { state, setState } = useStore();
  useEffect(() => {
    if (!state.intakeDate) return;
    const check = () => {
      const now = new Date();
      // Due: the time has come within the last half hour (opening the app at 15:00 does not replay the 08:00 reminder).
      const minutes = now.getHours() * 60 + now.getMinutes();
      const due = state.intake.filter(it => { if (!it.time) return false; const [h, m] = it.time.split(':').map(Number); const late = minutes - (h * 60 + m); return !it.done && late >= 0 && late <= 30 && !state.reminded.includes(`${today()}:${it.id}:${it.time}`); });
      if (!due.length) return;
      const items = due.map(it => ({ it, name: shortName(data.products.find(p => p.id === it.id)?.name || '') })).filter(x => x.name);
      setState(s => ({ ...s,
        reminded: [...s.reminded, ...due.map(it => `${today()}:${it.id}:${it.time}`)].slice(-100),
        // One line per intake time with all its products ("Коэнзим Q10, Хлорофилл, +1"), not a line per product.
        notices: [...new Set(items.map(({ it }) => it.time))].reduce((list, t) => {
          const id = `${today()}-intake-${t}`;
          // Everything of this time reminded today, so a product due a minute later joins the same line.
          const keys = new Set([...s.reminded, ...due.map(it => `${today()}:${it.id}:${it.time}`)]);
          const names = [...new Set(s.intake.filter(it => it.time === t && keys.has(`${today()}:${it.id}:${it.time}`)).map(it => shortName(data.products.find(p => p.id === it.id)?.name || '')).filter(Boolean))];
          return addNotice(list, { id, kind: 'intake', title: `Время приёма ${t}`, text: namesLine(names), at: now.toISOString(), date: '', url: '/health/', read: false });
        }, s.notices) }));
      if ('Notification' in window && Notification.permission === 'granted') navigator.serviceWorker?.ready.then(reg => {
        for (const { it, name } of items) reg.showNotification('Время приёма', { body: `${it.time} — ${name}\nПерейти к плану`, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: `intake-${it.id}`, data: { url: '/health/' } });
      }).catch(() => { /* no service worker: the bell still has it */ });
    };
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [state.intake, state.reminded, state.intakeDate, setState]);
}

/** Asks the browser for notification permission (must follow a tap). */
export async function enableSystemNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}
