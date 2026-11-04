import './notifications.css';
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './ui';

// Header bell with a small notifications popover. Nothing produces notifications yet
// (orders and plan reminders need the account server), so the list is empty for now.
type Notice = { id: string; title: string; text: string; date: string };
const notices: Notice[] = [];

export function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return <div className="notifications" ref={root}>
    <button className="icon-btn" aria-label="Уведомления" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(v => !v)}><Icon name="bell" />{notices.length > 0 && <span className="cart-count">{notices.length}</span>}</button>
    {open && <div className="notifications-panel" id={panelId} role="dialog" aria-label="Уведомления">
      <h2>Уведомления</h2>
      {notices.length ? <ul>{notices.map(n => <li key={n.id}><strong>{n.title}</strong><p>{n.text}</p><small>{n.date}</small></li>)}</ul>
        : <div className="notifications-empty"><Icon name="bell" size={28} /><p><strong>Уведомлений пока нет</strong></p><p>Здесь появятся статусы заказов и напоминания о плане приёма.</p></div>}
    </div>}
  </div>;
}
