import './notifications.css';
import { useEffect, useId, useRef, useState } from 'react';
import { data, useStore } from './store';
import { enableSystemNotifications } from './pwa';
import { runningAsApp } from './install-state.mjs';
import { Icon } from './ui';
import { badge, byDay, newCount, shortTime } from './notices.mjs';
import type { Notice } from './store';

// Header bell with the notifications popover (research 2026-11-10): the bell shows how many are new ("9+" above nine);
// the panel says "3 новых", groups the list by day with a line between notices, an icon per kind and a short time.
// Opening the panel reads them all; the ones that were new keep an orange mark and "Новое" while it is open. One notice
// can be deleted, "Очистить всё" can be undone. «Присылать уведомления» at the bottom turns on system notifications, and
// only in the installed app (research 2026-11-11): on an iPhone a site in Safari cannot send them at all (iOS 16.4+ allows
// them only to apps added to the Home Screen), and asking a visitor of the site in a computer's browser for permission
// out of the blue is what browsers now quietly block. In the browser the bell keeps its list, without the button.
/** Where a notice leads: «Товар снова в наличии» always to that product's card (also for notices saved before the
 *  link was set, found by the product in the notice's id), the others to their own page. */
export function noticeHref(n: Notice) {
  const id = /^stock-(.+)$/.exec(n.id)?.[1];
  const product = id ? data.products.find(p => p.id === id) : undefined;
  return product?.path ?? n.url;
}
export function NotificationsButton({open,onOpenChange}:{open:boolean;onOpenChange:(open:boolean)=>void}) {
  const { state, setState, notify } = useStore();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported' | ''>('');
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const unread = state.notices.filter(n => !n.read).length;
  useEffect(() => { setPermission('Notification' in window && runningAsApp(window) ? Notification.permission : 'unsupported'); }, [open]);
  const readAll = () => setState(s => ({ ...s, notices: s.notices.map(n => ({ ...n, read: true })) }));
  const remove = (id: string) => setState(s => ({ ...s, notices: s.notices.filter(n => n.id !== id) }));
  const clearAll = () => setState(s => ({ ...s, notices: [] }));
  // Opening the panel reads everything (owner, 2026-11-10): the bell number goes away at once, and the notices that were
  // new at that moment stay marked as new while the panel is open, so it is still clear what came.
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!open) { setFresh(new Set()); return; }
    setFresh(new Set(state.notices.filter(n => !n.read).map(n => n.id)));
    if (unread) readAll();
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const enable = async () => {
    const result = await enableSystemNotifications();
    setPermission(result);
    notify(result === 'granted' ? 'Напоминания будут приходить уведомлениями' : result === 'denied' ? 'Уведомления запрещены в настройках браузера' : 'Этот браузер не показывает уведомления');
  };
  return <div className="notifications" ref={root}>
    <button className="icon-btn" aria-label={unread ? `Уведомления: ${unread} новых` : 'Уведомления'} aria-expanded={open} aria-controls={panelId} onClick={() => onOpenChange(!open)}><Icon name="bell" />{unread > 0 && <span className="cart-count">{badge(unread)}</span>}</button>
    <span className="sr-only" role="status" aria-live="polite">{unread ? `Новых уведомлений: ${unread}` : ''}</span>
    {open && <div className="notifications-panel" id={panelId} role="dialog" aria-label="Уведомления">
      <div className="notifications-head">
        <h2>Уведомления{fresh.size > 0 && <span className="notifications-new">{newCount(fresh.size)}</span>}</h2>
      </div>
      {state.notices.length ? <div className="notifications-list">{byDay(state.notices).map(group => <section key={group.label} aria-label={group.label}>
        <h3 className="notifications-day">{group.label}</h3>
        <ul>{group.items.map(n => <li key={n.id} className={fresh.has(n.id) ? 'is-new' : 'is-read'}>
          <a href={noticeHref(n)}>
            <span className={`notification-icon notification-icon--${n.kind ?? 'other'}`} aria-hidden="true"><Icon name={n.kind === 'intake' ? 'clock' : n.kind === 'stock' ? 'bag' : n.kind === 'review' ? 'star' : 'bell'} size={18} /></span>
            <span className="notification-body"><strong>{n.title}</strong>{n.text && <span className="notification-text">{n.text}</span>}<small>{fresh.has(n.id) && <span className="notification-new-tag">Новое</span>}{n.at ? shortTime(n.at) : n.date}</small></span>
          </a>
          <button type="button" className="notification-remove" aria-label={`Удалить уведомление: ${n.title}`} onClick={() => remove(n.id)}><Icon name="close" size={14} /></button>
        </li>)}</ul>
      </section>)}</div>
        : <div className="notifications-empty"><Icon name="bell" size={28} /><p><strong>Уведомлений пока нет</strong></p><p>Здесь появятся напоминания о приёме и товары, которых вы ждали.</p></div>}
      {state.notices.length > 0 && <button type="button" className="text-button notifications-clear" onClick={clearAll}>Очистить всё</button>}
      {/* After «Очистить всё» the panel says at once that there are no notifications (owner, 2026-11-12). */}
      {permission === 'default' && <button type="button" className="btn btn--primary notifications-enable" onClick={enable}>Присылать уведомления</button>}
      {permission === 'granted' && <p className="notifications-note">Напоминания приходят уведомлениями, пока приложение открыто или свёрнуто.</p>}
      {permission === 'denied' && <p className="notifications-note">Уведомления выключены в настройках устройства.</p>}
    </div>}
  </div>;
}
