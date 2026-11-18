// Rules of the bell's list (packages/presentation/notifications.tsx), kept apart so they are tested:
// - a notice has `at` (ISO time) and `kind` ("intake", "stock", "review"); older ones have only the `date` text;
// - one notice per thing: the same id replaces the earlier one (an updated count of reviews, a second product due at the
//   same intake time) and comes back to the top as new;
// - at most 50 and none older than 30 days;
// - the list is shown by day ("Сегодня", "Вчера", "8 ноября") with a short time ("5 мин назад", "в 14:20").
export const MAX_NOTICES = 50, KEEP_DAYS = 30;
const DAY = 86400000;
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const time = at => { const t = Date.parse(at ?? ''); return Number.isFinite(t) ? t : null; };
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const hm = t => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** Puts a notice at the top; one with the same id is replaced. Old and surplus notices are dropped. */
export function addNotice(list, notice, now = Date.now()) {
  const rest = (list ?? []).filter(n => n.id !== notice.id);
  return [{ ...notice, read: false }, ...rest].filter(n => { const t = time(n.at); return t === null || now - t <= KEEP_DAYS * DAY; }).slice(0, MAX_NOTICES);
}

/** "Сегодня", "Вчера", "8 ноября" (and the year when it is not this year); "Ранее" for notices without a time. */
export function dayLabel(at, now = Date.now()) {
  const t = time(at); if (t === null) return 'Ранее';
  const days = Math.round((startOfDay(now) - startOfDay(t)) / DAY);
  if (days <= 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date(now).getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}

/** "только что", "5 мин назад", "в 14:20"; older days show only the time (the day is in the group heading). */
export function shortTime(at, now = Date.now()) {
  const t = time(at); if (t === null) return '';
  const minutes = Math.floor((now - t) / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60 && startOfDay(t) === startOfDay(now)) return `${minutes} мин назад`;
  return `в ${hm(t)}`;
}

/** The list split by day, newest first: [{ label, items }]. */
export function byDay(list, now = Date.now()) {
  const groups = [];
  for (const n of [...(list ?? [])].sort((a, b) => (time(b.at) ?? 0) - (time(a.at) ?? 0))) {
    const label = dayLabel(n.at, now);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(n); else groups.push({ label, items: [n] });
  }
  return groups;
}

/** The number on the bell: up to 9, then "9+". */
export const badge = n => n > 9 ? '9+' : String(n);
/** "3 новых", "1 новое", "5 новых" for the panel heading. */
export const newCount = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'новое' : 'новых'}`;
/** Product names of one intake time in one line: "Коэнзим Q10, Хлорофилл, +1". */
export const namesLine = names => names.length > 2 ? `${names.slice(0, 2).join(', ')}, +${names.length - 2}` : names.join(', ');
