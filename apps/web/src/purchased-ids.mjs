// "Мои покупки" (apps/web/src/purchases.tsx): every product of the visitor's orders once, the latest orders first, only products
// that are still on the site, with the date of the latest order that had it and how many orders had it. Orders saved
// before 2026-11-10 have no product list and add nothing. Order dates are "ДД.ММ.ГГГГ" (ru-RU).
const toTime = date => { const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(date ?? '')); return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : 0; };
export function purchased(orders, knownIds) {
  const byId = new Map();
  const sorted = [...(orders ?? [])].map((o, i) => ({ o, i, t: toTime(o?.date) })).sort((a, b) => b.t - a.t || a.i - b.i);
  for (const { o } of sorted) for (const id of Object.keys(o?.products ?? {})) {
    if (!knownIds.has(id)) continue;
    const seen = byId.get(id);
    if (seen) seen.times++; else byId.set(id, { id, date: o.date, times: 1 });
  }
  return [...byId.values()];
}
export const purchasedIds = (orders, knownIds) => purchased(orders, knownIds).map(p => p.id);
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
/** "10.11.2026" -> "10 ноября 2026"; anything else as it is. */
export const orderDate = date => { const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(date ?? '')); return m ? `${+m[1]} ${MONTHS[+m[2] - 1]} ${m[3]}` : String(date ?? ''); };
