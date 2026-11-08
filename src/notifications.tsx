import './notifications.css';
import { useEffect, useId, useRef, useState } from 'react';
import { useStore } from './store';
import { enableSystemNotifications } from './pwa';
import { Icon } from './ui';

// Header bell with the notifications popover: plan reminders (pwa.tsx) kept in this browser, newest first. Opening it
// marks them read. The switch at the bottom also sends reminders to the phone's notification shade.
export function NotificationsButton() {
  const { state, setState, notify } = useStore();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported' | ''>('');
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const unread = state.notices.filter(n => !n.read).length;
  useEffect(() => { setPermission('Notification' in window ? Notification.permission : 'unsupported'); }, [open]);
  useEffect(() => {
    if (!open) return;
    if (unread) setState(s => ({ ...s, notices: s.notices.map(n => ({ ...n, read: true })) }));
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const enable = async () => {
    const result = await enableSystemNotifications();
    setPermission(result);
    notify(result === 'granted' ? 'Напоминания будут приходить на телефон' : result === 'denied' ? 'Уведомления запрещены в настройках браузера' : 'Этот браузер не показывает уведомления');
  };
  return <div className="notifications" ref={root}>
    <button className="icon-btn" aria-label={unread ? `Уведомления: ${unread} новых` : 'Уведомления'} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(v => !v)}><Icon name="bell" />{unread > 0 && <span className="cart-count">{unread}</span>}</button>
    {open && <div className="notifications-panel" id={panelId} role="dialog" aria-label="Уведомления">
      <div className="notifications-head"><h2>Уведомления</h2>{state.notices.length > 0 && <button type="button" className="text-button" onClick={() => setState(s => ({ ...s, notices: [] }))}>Очистить</button>}</div>
      {state.notices.length ? <ul>{state.notices.map(n => <li key={n.id}><a href={n.url}><strong>{n.title}</strong><p>{n.text}</p><small>{n.date}</small>{n.url==='/health/'&&<span className="notification-plan-link">Перейти к плану <span aria-hidden="true">→</span></span>}</a></li>)}</ul>
        : <div className="notifications-empty"><Icon name="bell" size={28} /><p><strong>Уведомлений пока нет</strong></p></div>}
      {permission === 'default' && <button type="button" className="btn btn--primary notifications-enable" onClick={enable}>Присылать на телефон</button>}
      {permission === 'granted' && <p className="notifications-note">Напоминания приходят и на телефон, пока приложение открыто или свёрнуто.</p>}
      {permission === 'denied' && <p className="notifications-note">Уведомления на телефон выключены в настройках браузера.</p>}
    </div>}
  </div>;
}
