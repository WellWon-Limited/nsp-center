import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../../packages/presentation/ui';

// A month calendar of our own for picking a plan day. The browser's built-in date picker opens as a system window that
// on a phone-sized page can stand outside the screen; this one opens inside the page: under the date on a computer, as
// a sheet above the bottom bar on a phone.

const iso = (d: Date) => d.toLocaleDateString('sv-SE');
const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Days of a month view, Monday first, padded with nulls before the 1st. */
export function monthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  return [...Array(pad).fill(null), ...Array.from({ length: count }, (_, i) => iso(new Date(year, month, i + 1)))] as (string | null)[];
}

export function DatePicker({ value, today, onChange, children, label }: { value: string; today: string; onChange: (date: string) => void; children: ReactNode; label: string }) {
  const [open, setOpen] = useState(false);
  const start = new Date(`${value || today}T12:00:00`);
  const [view, setView] = useState({ year: start.getFullYear(), month: start.getMonth() });
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) { const d = new Date(`${value || today}T12:00:00`); setView({ year: d.getFullYear(), month: d.getMonth() }); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const shift = (n: number) => setView(v => { const d = new Date(v.year, v.month + n, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
  return <div className="date-picker" ref={root}>
    <button type="button" className="intake-date-pick" aria-label={label} aria-expanded={open} onClick={() => setOpen(o => !o)}>{children}<Icon name="chevron" size={14} /></button>
    {open && <div className="date-picker-panel" role="dialog" aria-label={label}>
      <header><button type="button" aria-label="Предыдущий месяц" onClick={() => shift(-1)}><Icon name="chevron" size={18} /></button><strong>{months[view.month]} {view.year}</strong><button type="button" aria-label="Следующий месяц" onClick={() => shift(1)}><Icon name="chevron" size={18} /></button></header>
      <div className="date-picker-grid">{weekdays.map(w => <span key={w} className="date-picker-weekday">{w}</span>)}{monthDays(view.year, view.month).map((d, i) => d ? <button type="button" key={d} className={`${d === (value || today) ? 'selected' : ''}${d === today ? ' today' : ''}`} aria-pressed={d === (value || today)} onClick={() => { onChange(d); setOpen(false); }}>{Number(d.slice(8))}</button> : <span key={`pad-${i}`} />)}</div>
      {value && value !== today && <button type="button" className="date-picker-today" onClick={() => { onChange(today); setOpen(false); }}>Сегодня</button>}
    </div>}
  </div>;
}
