// Courier delivery in Saint Petersburg (owner, 2026-11-17): Monday to Saturday, two windows 10:00–14:00 and
// 14:00–18:00, five working days to choose from. A window of today can be chosen while it has not started yet, so an
// order placed before 14:00 can still come today (14:00–18:00); later orders go to the next working day. Times are
// Saint Petersburg time whatever the visitor's clock says.
export const WINDOWS = [{ id: '10-14', label: '10:00–14:00', start: 10 }, { id: '14-18', label: '14:00–18:00', start: 14 }];
export const DAYS_AHEAD = 5;
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['янв', 'февр', 'марта', 'апр', 'мая', 'июня', 'июля', 'авг', 'сент', 'окт', 'нояб', 'дек'];

/** Saint Petersburg date and hour of a moment: { y, m, d, hour, minute }. */
export function spbClock(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute) };
}

/** The next DAYS_AHEAD working days that still have a window free: [{ date: 'YYYY-MM-DD', label, windows: [{id,label,free}] }]. */
export function deliveryDays(now = new Date()) {
  const c = spbClock(now);
  const days = [];
  for (let i = 0; days.length < DAYS_AHEAD && i < 14; i++) {
    const day = new Date(Date.UTC(c.y, c.m - 1, c.d + i));
    const weekday = day.getUTCDay();
    if (weekday === 0) continue; // no Sunday
    const today = i === 0;
    const windows = WINDOWS.map(w => ({ id: w.id, label: w.label, free: !today || c.hour < w.start }));
    if (!windows.some(w => w.free)) continue;
    const date = day.toISOString().slice(0, 10);
    const label = today ? 'Сегодня' : i === 1 ? 'Завтра' : `${WEEKDAYS[weekday][0].toUpperCase()}${WEEKDAYS[weekday].slice(1)}`;
    days.push({ date, label, sub: `${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`, windows });
  }
  return days;
}

/** The earliest free day and window. */
export function earliestSlot(days) {
  for (const d of days) { const w = d.windows.find(x => x.free); if (w) return { date: d.date, window: w.id }; }
  return { date: '', window: '' };
}
