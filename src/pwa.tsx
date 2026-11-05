import './pwa.css';
import { useEffect, useState } from 'react';
import { data, shortName, today, useStore } from './store';
import { Icon } from './ui';

// Installable app (PWA, docs/DEVELOPMENT.md): the service worker (dist/sw.js, scripts/pwa.mjs) keeps the app working
// offline; this module registers it, offers the install at the top of the screen and turns plan times into reminders.

/** Registers the service worker (served by the built site; in `npm run dev` the file is absent and nothing happens). */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* the site works without it */ }); });
}

// Loading screen on a phone: index.html covers the first page of a visit with the logo on white (class nsp-splash, set
// before anything paints); once the page has loaded and rendered it fades out, and the app counts as ready.
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
    root.classList.add('nsp-splash-out');
    setTimeout(() => { root.classList.remove('nsp-splash', 'nsp-splash-out'); markReady(); }, 320);
  }, Math.max(0, 700 - (performance.now() - started)));
  if (document.readyState === 'complete') hide(); else addEventListener('load', hide, { once: true });
}

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// The browser's install offer arrives once per page, possibly before React mounts, so it is caught here at load and shared
// by the install card at the top and the one in the profile. Chrome stops offering it once the app is installed.
let deferred: InstallPrompt | null = null;
let installed = false;
const installListeners = new Set<() => void>();
const changed = () => installListeners.forEach(fn => fn());
if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallPrompt; changed(); });
  addEventListener('appinstalled', () => { deferred = null; installed = true; changed(); });
}

/** Install state for a component: whether this browser can install the app now (Chrome/Edge offer, or iPhone Safari with
 *  its manual steps) and the action; nothing is offered inside the installed app. */
export function useInstall() {
  const [, rerender] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); const fn = () => rerender(n => n + 1); installListeners.add(fn); return () => { installListeners.delete(fn); }; }, []);
  const ios = mounted && isIos();
  const available = mounted && !installed && !standalone() && (Boolean(deferred) || ios);
  /** Starts the browser's install; on iPhone returns false — the caller shows the steps instead. */
  const install = async () => {
    if (!deferred) return false;
    const offer = deferred; deferred = null;
    await offer.prompt(); await offer.userChoice; changed();
    return true;
  };
  return { available, ios, install };
}

const InstallSteps = () => <p className="install-banner-help">Нажмите <strong>«Поделиться»</strong> внизу экрана Safari, затем <strong>«На экран „Домой“»</strong> и <strong>«Добавить»</strong>.</p>;

// The card at the top comes up when the visitor enters the site or reloads a page, not on every move between pages.
const enteredOrReloaded = () => {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if (nav?.type === 'reload') return true;
  try { return !document.referrer || new URL(document.referrer).origin !== location.origin; } catch { return true; }
};

/** "Установите приложение": after the page has loaded (and the loading screen is gone) a card drops in at the top and the
 *  rest of the screen dims until "×" or "Установить". On Android and desktop Chrome/Edge the button starts the browser's
 *  install right away; iPhone Safari has no such call, so the button shows the taps that add the app to the home screen.
 *  Shown again on every visit and reload until the app is installed; never inside the installed app. */
export function InstallBanner() {
  const { available, ios, install } = useInstall();
  const [help, setHelp] = useState(false);
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!available || closed || open || !enteredOrReloaded()) return;
    let timer = 0;
    whenReady(() => { timer = window.setTimeout(() => setOpen(true), 400); });
    return () => clearTimeout(timer);
  }, [available, closed, open]);
  if (!open || closed || !available) return null;
  const close = () => setClosed(true);
  const start = async () => { if (await install()) close(); else if (ios) setHelp(v => !v); };
  return <><div className="install-backdrop" aria-hidden="true" />
  <div className="install-banner" role="dialog" aria-modal="true" aria-label="Установка приложения" data-ds-id="install-banner">
    <div className="install-banner-row">
      <img src="/icons/icon-192.png" alt="" width="52" height="52" />
      <div className="install-banner-text"><strong>Установите приложение NSP Center</strong><span>Иконка появится на экране телефона</span></div>
      <button type="button" className="install-banner-close" onClick={close} aria-label="Скрыть"><Icon name="close" size={18} /></button>
    </div>
    <button type="button" className="btn btn--primary install-banner-action" onClick={start}>Установить</button>
    {help && <InstallSteps />}
  </div></>;
}

/** Profile card "Приложение NSP Center" with the same install action; hidden once the app is installed. */
export function InstallAppCard() {
  const { available, ios, install } = useInstall();
  const [help, setHelp] = useState(false);
  if (!available) return null;
  const start = async () => { if (!(await install()) && ios) setHelp(v => !v); };
  return <section className="account-card install-card" data-ds-id="account-install">
    <div className="install-banner-row">
      <img src="/icons/icon-192.png" alt="" width="52" height="52" />
      <div className="install-banner-text"><strong>Приложение NSP Center</strong><span>Установите его — иконка появится на экране телефона</span></div>
    </div>
    <button type="button" className="btn btn--primary install-banner-action" onClick={start}>Установить приложение</button>
    {help && <InstallSteps />}
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
      const due = state.intake.filter(it => { const [h, m] = it.time.split(':').map(Number); const late = minutes - (h * 60 + m); return !it.done && late >= 0 && late <= 30 && !state.reminded.includes(`${today()}:${it.id}:${it.time}`); });
      if (!due.length) return;
      const items = due.map(it => ({ it, name: shortName(data.products.find(p => p.id === it.id)?.name || '') })).filter(x => x.name);
      setState(s => ({ ...s,
        reminded: [...s.reminded, ...due.map(it => `${today()}:${it.id}:${it.time}`)].slice(-100),
        notices: [...items.map(({ it, name }) => ({ id: `${today()}-${it.id}-${it.time}`, title: 'Время приёма', text: `${it.time} — ${name}`, date: now.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }), url: '/health/', read: false })), ...s.notices].slice(0, 50) }));
      if ('Notification' in window && Notification.permission === 'granted') navigator.serviceWorker?.ready.then(reg => {
        for (const { it, name } of items) reg.showNotification('Время приёма', { body: `${it.time} — ${name}`, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: `intake-${it.id}`, data: { url: '/health/' } });
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
