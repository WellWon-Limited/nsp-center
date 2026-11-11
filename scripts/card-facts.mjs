// The short lines of a catalog card (owner's choice, 2026-11-08, after the NSP shop's cards): a kicker with the form
// («Капсулы · БАД», «Крем»), what the product supports, and the composition in one line («› Корни володушки, корни
// пиона… + ещё 10»). Built once from the catalog data (scripts/split-content.mjs) into the browser summary.
//
// «What it supports» comes from «Системы организма» only — never from «Назначение», the old site's list of diseases:
// a supplement card must not tie the product to a disease.

const SUPPLEMENT = /^(Биологические добавки|Наборы продуктов)/;
const nouns = { 'Обмен веществ': 'обмена веществ', 'Зрение': 'зрения', 'Кроветворение': 'кроветворения', 'Кожа': 'кожи', 'волосы': 'волос', 'ногти': 'ногтей', 'зубы': 'зубов' };
const join = items => items.length > 1 ? `${items.slice(0, -1).join(', ')} и ${items.at(-1)}` : items[0] ?? '';

/** «Иммунная, Пищеварительная, Обмен веществ» -> «Поддержка иммунной\nи пищеварительной систем»: always two lines on a
 *  card (owner: no empty line under it), broken where the phrase reads naturally. */
export function supportLine(systems) {
  const list = String(systems ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const adjectives = list.filter(s => /ая$/u.test(s)).slice(0, 2).map(s => s.toLowerCase().replace(/ая(?=\s|$)/gu, 'ой'));
  if (adjectives.length > 1) return `Поддержка ${adjectives[0]}\nи ${adjectives[1]} систем`;
  if (adjectives.length) return `Поддержка\n${adjectives[0]} системы`;
  const others = list.map(s => nouns[s]).filter(Boolean).slice(0, 3);
  return others.length ? `Поддержка\n${join(others)}` : '';
}

/** The release form from the label's directions. */
export function releaseForm(directions) {
  const a = String(directions ?? '').toLowerCase();
  if (/жеват/u.test(a)) return 'Жевательные таблетки';
  if (/капсул/u.test(a)) return 'Капсулы';
  if (/таблет/u.test(a)) return 'Таблетки';
  if (/пастил/u.test(a)) return 'Пастилки';
  if (/порош|пакет|коктейл|мерн/u.test(a)) return 'Порошок';
  if (/\bмл\b|ложк|капел|жидк/u.test(a)) return 'Жидкость';
  return '';
}

const capitalize = s => s ? s[0].toUpperCase() + s.slice(1) : s;
/** «Корни володушки китайской (Bupleurum chinese) - 77,6 мг; корни пиона…» -> ['Корни володушки китайской', 'корни пиона…']. */
export function compositionParts(text) {
  return String(text ?? '').split(/[;\n]/u).map(s => s.split(/\s\(|\s[—–-]\s|\s\d/u)[0].trim().replace(/[.,:]$/u, '')).filter(s => s.length > 1 && !/^\d/u.test(s));
}

export function cardFacts(p, byId) {
  const supplement = SUPPLEMENT.test(p.category ?? '');
  const set = p.setProducts?.length ? p.setProducts.map(id => byId.get(id)).filter(Boolean) : null;
  const form = set ? 'Набор' : supplement ? releaseForm(p.properties['Применение']) : (p.properties['Тип'] ?? '');
  const kicker = supplement ? [form, 'БАД'].filter(Boolean).filter((x, i, all) => all.indexOf(x) === i).join(' · ') : form || (p.category ?? '').split('/').at(-1);
  const sub = supplement ? supportLine(p.properties['Системы организма'] ?? set?.map(x => x.properties['Системы организма']).filter(Boolean).join(', ')) : capitalize((p.properties['Группы косметики'] ?? '').toLowerCase()) || (p.category ?? '').split('/').at(-1);
  const parts = set ? set.map(x => x.name.replace(/\s*\([^)]*\)/gu, '').trim()) : (p.properties['Состав 1 ед. (таблетки, пакетика, порции)'] ? compositionParts(p.properties['Состав 1 ед. (таблетки, пакетика, порции)']) : String(p.properties['Вспомогательные вещества'] ?? '').split(',').map(x => x.trim()).filter(Boolean)).map((s, i) => i ? s.toLowerCase() : capitalize(s));
  // Expert comments count as reviews on the card («5 отзывов»); their stars do not exist, so only customers' count there.
  return { kicker, sub, parts: parts.slice(0, 2), more: Math.max(0, parts.length - 2), notes: p.experts?.length ?? 0 };
}
