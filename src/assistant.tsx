import {productCover} from './product-media.mjs';
import './assistant.css';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { data, money, partnerSignupUrl, priceOf, shortName, useStore } from './store';
import { Icon, WaitlistButton } from './ui';

// «Консультация» (/consultation/): a chat with the shop's assistant. Until the AI server exists (an API key cannot live in
// the site), the assistant answers from the theme pages and expert comments written from the doctors' lecture base: it finds
// the closest topic, answers in a few sentences, shows the product, and hands anything it
// cannot answer to a live consultant. It never diagnoses; health-risk questions get a "see a doctor" note. The search index
// (src/generated/chat-index.json, scripts/split-content.mjs) is loaded only on this page.

type ChatTheme = { path: string; h1: string; product: string; lead: string; sections: { h: string; p: string }[]; faq: { q: string; a: string }[]; pairs?: { id: string; why: string }[]; source: { course: string; lecture: string; speaker?: string } | null };
type ChatProduct = { id: string; name: string; path: string; price: number; partner: null; available: boolean; composition?: string; expert: { speaker: string; role: string; lecture: string } | null; usage: string; contra: string; highlights: string[] };
type Index = { themes: ChatTheme[]; products: ChatProduct[] };
type Link = { label: string; href: string };
type Section = { title: string; text: string };
type Message = { at?: string; emergency?: boolean; products?: string[]; source?: string; sections?: Section[]; from: 'bot' | 'user'; text: string; product?: string; altProduct?: string; links?: Link[]; chips?: string[]; ask?: string; warning?: boolean; alts?: string[] };

// First screen (research 2026-11-10, NN/g, Intercom): say it is an assistant, what it can and cannot do, and offer a few
// questions, with the way to a person among them (the owner removed the chat header).
const greeting: Message = { from: 'bot', text: 'Здравствуйте! Я бот-помощник NSP Center. Подскажу по продуктам — по лекциям врачей, а ещё по доставке, оплате и скидкам. Я не врач и не ставлю диагнозы.', chips: ['Плохо сплю', 'Нет сил днём', 'Тяжесть после еды', 'Часто простываю', 'Как получить скидку?', 'Где вы находитесь?', 'Связаться со специалистом'] };
/** "14:20": the time a message was written, shown under the last message of a series. */
const now = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const storeKey = 'nsp-center:chat';
const phone = data.site.phones?.[1] || '+79626854838';
const email = data.site.emails?.[0] || 'sales@nsp-center.ru';
// Contact with a person: a call or an email only (owner, 2026-11-10: no WhatsApp in the chat).
const consultantLinks: Link[] = [{ label: 'Позвонить', href: `tel:${phone}` }, { label: 'Написать на почту', href: `mailto:${email}` }];

// Crude Russian matching: lower case, ё→е, words cut to a 5-letter stem; a few everyday words point to the lecture topics.
// Everyday filler words carry no topic.
const stopwords = new Set(['плохо', 'очень', 'часто', 'хочу', 'можно', 'нужно', 'нужен', 'нужна', 'нужны', 'зачем', 'почему', 'какой', 'какая', 'какие', 'когда', 'сколько', 'стоит', 'принимать', 'пить', 'выпить', 'есть', 'меня', 'мне', 'что', 'как', 'для', 'это', 'при', 'после', 'перед', 'день', 'днем', 'днём', 'всегда', 'постоянно', 'посоветуйте', 'подскажите']);
const words = (text: string) => text.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopwords.has(w));
const stem = (w: string) => (w.length > 5 ? w.slice(0, 5) : w);
// Everyday words → the stems the lecture texts use for that topic.
const topics: [RegExp, string[]][] = [
  [/(спл|сон|сна|усну|засып|бессон|просып)/, ['сон', 'сна', 'сном', 'засып', 'мелат', 'серот']],
  [/(устал|устаю|сил|бодр|энерг|вял)/, ['энерг', 'устал', 'бодро', 'сил']],
  [/(аппетит|плохо ем|не хочется есть|мало ем)/, ['аппет', 'пищев', 'перев']],
  [/(тяжест|вздут|живот|желуд|изжог|перевар)/, ['пищев', 'перев', 'желуд', 'фермен', 'тяжес']],
  [/(запор|стул|кишеч|туалет)/, ['кишеч', 'стул', 'микро']],
  [/(прост|болею|орви|простыв|иммун|простуж)/, ['иммун', 'прост', 'защит']],
  [/(волос|ногт|кож)/, ['волос', 'ногт', 'кожи', 'кожа', 'колла']],
  [/(сустав|колен|связк|хрящ)/, ['суста', 'хрящ', 'связк']],
  [/(сердц|сосуд|давлен)/, ['сердц', 'сосуд']],
  [/(зрени|глаз)/, ['глаз', 'зрени']],
  [/(похуд|вес|сладк|аппетит)/, ['вес', 'аппет', 'сладк', 'углев']],
  [/(стресс|нерв|трево|раздраж)/, ['стрес', 'нервн', 'трево']],
  [/(печен|желч|детокс|очищ)/, ['печен', 'желч', 'очищ']],
  [/(витамин|минерал)/, ['витам', 'минер']],
];
// Questions that clearly name one product's topic (or a product in Latin/short form) go straight to its page.
const aliases: [RegExp, string][] = [[/(витамин\s*[дd]|д3|d3)/i, 'vitamin-d3'], [/(колен|сустав|хрящ)/i, 'glucosamine'], [/(омег|рыбий жир)/i, 'omega-3-epa'], [/(магни)/i, 'magnesium-complex'], [/(хлорофил)/i, 'khlorofill-zhidkiy-chlorophyll-liquid'], [/(запор|стул)/i, 'nature-lax'], [/(простыва|простуж|орви|иммунитет)/i, 'una-de-gato'], [/(сплю|уснуть|бессон|засыпа)/i, 'magnesium-complex']];
const terms = (text: string) => { const out = new Set<string>(); for (const w of words(text)) out.add(stem(w)); return out; };
const queryTerms = (text: string) => { const out = terms(text); const t = text.toLowerCase(); for (const [re, stems] of topics) if (re.test(t)) for (const s of stems) out.add(s); return out; };
const overlap = (q: Set<string>, text: string) => { let n = 0; const t = terms(text); for (const s of q) if (t.has(s)) n += 1; return n; };
// Word starts only: «будет» is not «дет», «больше» is not «боль», «кровать» is not «кровь».
const risky = /(?<![а-яё])(беремен|кормлю|грудн|ребен|ребён|дет[иейскя]|боль(?!ш)|боли|болит|кров(?!ат)|температур|лекарств|таблетк|давлен|диабет|онко|антибиотик|аллерги|гормон|щитовид|эутирокс|тироксин|гипертон|сердц|почк|печен[ьи] (боль|болит))/iu;

// Warning signs: no product advice, a doctor (or an ambulance) first.
const emergency = /(температур\S*\s*(под\s*)?(3[89]|4\d)|высок\S* температур|бол\S* в груди|болит груд|груд\S* болит|задыха|одышк|теря\S* сознан|обморок|кровотеч|кровь в|судорог|инсульт|инфаркт|онемел|онемени|сильн\S* боль|острая боль)/iu;
const emergencyReply: Message = { from: 'bot', emergency: true, text: 'С такими признаками нужно сразу обратиться к врачу. Если состояние тяжёлое или быстро ухудшается — вызовите скорую: 103 или 112. Я не ставлю диагнозы и не подбираю лечение, БАД здесь не поможет.', chips: ['Связаться со специалистом'] };

// Shop questions customers ask most (research 2026-11-10): price, stock, what goes with what, how to take, pregnancy and
// children, delivery cost, how to order, payment, returns, certificates, shelf life, opening hours, becoming a partner.
// Facts come from the site's own pages (/delivery/, /payments/, /contacts/, /company/refund/, /company/sertifikaty/).
const compact = (v: string) => v.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '');
/** Products named in the text, in the order they are named: by the whole short name, its first two words, a distinctive
 *  first word or the Latin name in brackets («аг икс» = «АГ-Икс», «омега 3» = «Омега 3 ПНЖК»). */
/** Everyday names of products (not symptoms): «витамин д», «д3», «рыбий жир», «омега». */
const nameAliases: [RegExp, string][] = [[/(витамин\s*[дd]\s*3?(?![а-я])|(?<![а-я])д3|d3)/i, 'vitamin-d3'], [/(рыбий жир|омег[аиу])/i, 'omega-3-epa']];
export function findProducts(text: string, index: Index): ChatProduct[] {
  const q = compact(text);
  const words = (name: string) => shortName(name).split(/[\s-]+/).filter(Boolean);
  const first = new Map<string, number>(); for (const p of index.products) { const w = compact(words(p.name)[0] ?? ''); first.set(w, (first.get(w) ?? 0) + 1); }
  // Words that name only one product («алоэ» in «Сок Алоэ Вера», «лакс»): enough on their own.
  // Everyday words in product names («Стоп аллергия», «Иммунный») are not names: «аллергия на рыбу» is not that set.
  const generic = new Set(['комплекс', 'форте', 'плюс', 'хелат', 'масло', 'маслом', 'крем', 'гель', 'шампунь', 'tropical', 'mists', 'сок', 'чай', 'витамин', 'набор', 'стоп', 'аллергия', 'иммунитет', 'иммунный', 'женский', 'мужской', 'детский', 'здоровье', 'сила', 'энергия', 'красота', 'баланс', 'очищение', 'защита', 'жидкий', 'капсулы', 'таблетки', 'порошок', 'вера', 'после', 'перед', 'против', 'кожи', 'волос', 'лица', 'тела', 'рук', 'ног', 'глаз', 'зубов', 'ногтей', 'мама', 'малыш', 'бритья', 'ухода', 'уход']);
  // A word shared by a few products (two with «алоэ», two «Хлорофилл») points to the one with the shortest name — the
  // plain product rather than a cosmetic or a set.
  const owners = new Map<string, ChatProduct[]>(); for (const p of index.products) for (const w of new Set(words(p.name).map(compact))) owners.set(w, [...(owners.get(w) ?? []), p]);
  const plainOwner = (w: string, p: ChatProduct) => { const o = owners.get(w) ?? []; return o.length <= 3 && [...o].sort((a, b) => shortName(a.name).length - shortName(b.name).length)[0] === p; };
  const hits: { p: ChatProduct; at: number; len: number }[] = [];
  for (const p of index.products) {
    const w = words(p.name); const latin = /\(([^)]+)\)/.exec(p.name)?.[1] ?? '';
    const latinHead = compact(latin.split(/[\s-]+/).slice(0, 2).join(''));
    const unique = w.map(compact).filter(x => x.length >= 4 && !generic.has(x) && plainOwner(x, p));
    const variants = [compact(shortName(p.name)), compact(w.slice(0, 2).join('')), compact(latin), latinHead, ...unique, ...(w[0] && compact(w[0]).length >= 5 && first.get(compact(w[0])) === 1 ? [compact(w[0])] : [])].filter((v, i) => v.length >= 4 || ((i === 2 || i === 3) && v.length >= 3 && new RegExp(`(^|[^a-z])${v.split('').join('[^a-z]?')}([^a-z]|$)`, 'i').test(text)));
    let best: { at: number; len: number } | null = null;
    for (const v of variants) { const at = q.indexOf(v); if (at >= 0 && (!best || v.length > best.len)) best = { at, len: v.length }; }
    if (best) hits.push({ p, ...best });
  }
  // Everyday names («витамин д», «рыбий жир») from the aliases list.
  for (const [re, id] of nameAliases) { const m = re.exec(text); const p = index.products.find(x => x.id === id); if (m && p && !hits.some(h => h.p.id === id)) hits.push({ p, at: compact(text.slice(0, m.index)).length, len: compact(m[0]).length + 3 }); }
  // Typos: a word of the question one or two letters away from a product's distinctive first word («хлорафил» —
  // «Хлорофилл», «омего» — «Омега»); «три» counts as «3».
  if (!hits.length) {
    const typed = text.toLowerCase().replace(/ё/g, 'е').replace(/(?<![а-я])три(?![а-я])/g, '3').split(/[^a-zа-я0-9]+/).filter(x => x.length >= 5);
    const dist = (a: string, b: string) => { const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
    for (const p of index.products) { const w0 = compact(words(p.name)[0] ?? ''); if (w0.length < 5 || generic.has(w0) || [...(owners.get(w0) ?? [])].sort((a, b) => shortName(a.name).length - shortName(b.name).length)[0] !== p) continue; const at = typed.findIndex(x => dist(x, w0) <= (w0.length >= 8 ? 2 : 1)); if (at >= 0) hits.push({ p, at, len: w0.length }); }
  }
  // A longer match wins over a shorter one at the same place («кальций магний хелат» over «кальций»).
  hits.sort((a, b) => b.len - a.len);
  const kept: typeof hits = [];
  for (const h of hits) if (!kept.some(k => h.at < k.at + k.len && k.at < h.at + h.len)) kept.push(h);
  return kept.sort((a, b) => a.at - b.at).map(h => h.p);
}
const deliveryText = 'Самовывоз из пункта выдачи в Санкт-Петербурге — бесплатно. Курьер по Санкт-Петербургу в пределах КАД — 350 ₽, при заказе от 12 000 ₽ бесплатно; за КАД — по тарифам CDEK. В другие города отправляем CDEK до пункта выдачи или по адресу, стоимость и срок считаются по тарифу, оплата — заранее. Менеджер подтверждает заказ в течение 1 рабочего дня; курьер ездит с понедельника по пятницу, поэтому заказ пятницы приедет с понедельника.';
const hoursText = 'Пункт выдачи работает: пн–пт с 11:00 до 19:00, сб с 12:00 до 17:30, воскресенье — выходной.';
export function shopAnswer(text: string, index: Index, previous?: string): Message | null {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  // A follow-up about the product just discussed («а сколько он стоит?», «а он есть?»).
  const direct = findProducts(text, index);
  const before = !direct.length && previous && /(^|\s)(а|он|она|оно|его|ее|её|него|нее|неё|этот|эта|это|их)(\s|\?|$)/.test(t) ? index.products.find(p => p.id === previous) : undefined;
  const found = before ? [before] : direct;
  const one = found[0];
  const name = (p: ChatProduct) => `«${shortName(p.name)}»`;
  const inStockNow = (p: ChatProduct) => inStock(p.id);
  const more = (p: ChatProduct) => pathOf(p.id, index) ?? p.path;
  const doctorFirst = ' Ваш случай лучше сначала обсудить с врачом — я не ставлю диагнозы и не подбираю лечение.';
  // «Вылечит ли…»: supplements do not treat diseases (law on advertising, art. 25).
  if (/(вылеч|излеч|лечит ли|лечат ли|поможет ли от|избавит)/.test(t)) return { from: 'bot', text: `БАД не лечат заболевания — они дополняют питание. С болезнью лучше обратиться к врачу: он подберёт лечение и скажет, можно ли вам добавки.${one ? ` Про ${name(one)} могу рассказать, зачем его принимают и как.` : ''}`, ...(one ? { products: [one.id] } : {}), chips: ['Связаться со специалистом'], warning: Boolean(one) };
  // Card prices: who sees them.
  if (/(сколько стоит (оформ|карт)|оформить карту|карт[ауы] (бесплат|платн)|покупать каждый месяц|обязательн.*(покуп|заказ))/.test(t)) return { from: 'bot', text: 'Оформить дисконтную карту NSP можно онлайн; заключать партнёрское соглашение не обязательно, но со скидкой до 30% (и накопительной скидкой по баллам) покупают только с картой. Условия по покупкам подскажет специалист.', links: [{ label: 'Оформить карту', href: partnerSignupUrl }, ...consultantLinks.slice(0, 1)] };
  if (/(не вижу цен|цен[аыу] по карт|цена для партн|ввести номер|как ввести карт|куда ввести|номер карты)/.test(t)) return { from: 'bot', text: 'Цены по дисконтной карте видны после входа в аккаунт, если в профиле указан номер карты. Войдите и добавьте номер в разделе «Дисконтная карта» — цены в каталоге и корзине пересчитаются.', links: [{ label: 'Профиль', href: '/profile/' }, { label: 'Оформить карту', href: partnerSignupUrl }] };
  if (/(дороже|дешевле на|на озоне|на вб|вайлдберриз|wildberries|ozon|маркетплейс)/.test(t)) return { from: 'bot', text: 'Мы официальный партнёр Nature’s Sunshine: продукция поставляется напрямую и маркируется в «Честном знаке», так что подделки исключены. С дисконтной картой цены ниже — до 30%.', links: [{ label: 'Оформить карту', href: partnerSignupUrl }] };
  if (/(сколько( \S+)? сто(ит|ят)|стоимост|цен[аыуе](?![а-я])|почем|по чем|за сколько|дорого)/.test(t) && !/(доставк|курьер|сдэк|cdek)/.test(t)) {
    if (!one) return { from: 'bot', text: 'Цены всех продуктов — в каталоге. Напишите название, и я скажу цену и есть ли он в наличии.', links: [{ label: 'Открыть каталог', href: '/catalog/' }] };
    return { from: 'bot', text: found.length > 1 ? `Цены: ${found.slice(0, 3).map(p => `${name(p)} — ${money(data.products.find(x => x.id === p.id)?.prices.retail ?? p.price)}`).join('; ')}. Это розничные цены; с дисконтной картой — дешевле, до 30%.` : `${name(one)} стоит ${money(data.products.find(x => x.id === one.id)?.prices.retail ?? one.price)} — это розничная цена. С дисконтной картой дешевле, до 30%: цена по карте видна после входа с номером карты.${inStockNow(one) ? '' : ' Сейчас его нет в наличии.'}`, products: found.slice(0, 3).map(p => p.id), links: [{ label: 'Подробнее о продукте', href: more(one) }] };
  }
  // In stock?
  if (/(в наличии|наличи|есть ли|есть у вас|есть\?|закончил|когда (будет|появ|привез)|поступлени)/.test(t) && one) {
    return { from: 'bot', text: inStockNow(one) ? `Да, ${name(one)} сейчас в наличии.` : `${name(one)} сейчас нет в наличии. Нажмите «Сообщить о поступлении» на карточке ниже — сайт напомнит, когда он появится.`, products: [one.id] };
  }
  // Medicines or a chronic illness: no pick, the doctor first.
  if (/(антибиотик|эутирокс|тироксин|гормон|лекарств|таблетки от|принимаю препарат|диабет|гипертон|давлени|онколог|щитовид)/.test(t)) return { from: 'bot', text: `Если вы принимаете лекарства или у вас хроническое заболевание, любые добавки — только после консультации с врачом: некоторые из них меняют действие лекарств.${one ? ` Ниже — что известно про ${name(one)}, покажите это врачу.` : ''}`, ...(one ? { products: [one.id] } : {}), chips: ['Связаться со специалистом'], warning: Boolean(one) };
  // What goes with what: the lecture pairings of the theme pages («С чем сочетают»).
  if (/(вместе|сочета|совмест|одновремен|комбинир|параллельн|с чем (пить|принима|сочета)|с чем его|и .+ (вместе|сразу))/.test(t) && one) {
    const pairsOf = (p: ChatProduct) => index.themes.filter(th => th.product === p.id).flatMap(th => th.pairs ?? []);
    if (found.length >= 2) {
      const [a, b] = found;
      const why = pairsOf(a).find(x => x.id === b.id)?.why ?? pairsOf(b).find(x => x.id === a.id)?.why;
      const listed = (siblings[a.id] ?? []).includes(b.id) || (siblings[b.id] ?? []).includes(a.id);
      return { from: 'bot', text: why ? `Да, ${name(a)} и ${name(b)} врачи в лекциях сочетают. ${why}` : listed ? `${name(a)} и ${name(b)} в лекциях врачей упоминают вместе. Как разнести приём по времени, лучше уточнить у специалиста.` : `Прямых указаний на совместный приём ${name(a)} и ${name(b)} в лекциях врачей у меня нет. Обычно такие продукты принимают вместе, но схему лучше согласовать со специалистом — особенно если вы принимаете лекарства.`, products: [a.id, b.id], chips: ['Связаться со специалистом'], warning: true };
    }
    const pairs = pairsOf(one).filter(x => index.products.some(p => p.id === x.id)).slice(0, 3);
    if (pairs.length) return { from: 'bot', text: `С ${name(one)} врачи в лекциях сочетают: ${pairs.map(x => `«${shortName(index.products.find(p => p.id === x.id)!.name)}» — ${x.why.replace(/\.$/, '')}`).join('; ')}.`, products: [one.id, ...pairs.map(x => x.id)].slice(0, 3), warning: true };
    const sib = (siblings[one.id] ?? []).filter(id => index.products.some(p => p.id === id)).slice(0, 3);
    if (sib.length) return { from: 'bot', text: `${name(one)} в лекциях врачей часто сочетают с ${sib.map(id => `«${shortName(index.products.find(p => p.id === id)!.name)}»`).join(', ')}. Схему лучше согласовать со специалистом.`, products: [one.id, ...sib].slice(0, 3), warning: true };
    return { from: 'bot', text: `О сочетаниях ${name(one)} в лекциях у меня нет данных. Специалист подскажет, с чем его лучше принимать.`, products: [one.id], links: consultantLinks };
  }
  // Who must not take a named product: the label's cautions.
  if (one && /(противопоказ|кому нельзя|нельзя (пить|принимать)|побочн|вредно ли|опасно ли)/.test(t)) {
    const contra = (one.contra ?? '').replace(/\s+/g, ' ').trim();
    return { from: 'bot', text: contra ? `По этикетке ${name(one)} не подходит: ${contra.replace(/\.$/, '').replace(/^./, c => c.toLowerCase())}. Если сомневаетесь, посоветуйтесь с врачом.` : `Противопоказания ${name(one)} указаны на упаковке; если сомневаетесь, посоветуйтесь с врачом.`, products: [one.id], warning: true };
  }
  // How to take a named product: the label's usage.
  if (one && /(как (принимать|пить|применять|употреблять)|сколько (капсул|таблет|раз|ложек|в день)|дозиров|дозу|курс|утром или вечером|до еды|после еды|натощак)/.test(t) && !/(беремен|кормл|ребен|ребён|детям|детей)/.test(t)) {
    const usage = (one.usage ?? '').replace(/\s+/g, ' ').trim();
    return { from: 'bot', text: usage ? `Как принимать ${name(one)} — по этикетке: ${usage.replace(/\.$/, '')}.${risky.test(t) ? doctorFirst : ' Если вы принимаете лекарства, схему лучше согласовать с врачом.'}` : `Схема приёма ${name(one)} указана на упаковке; уточнить её можно у специалиста.`, products: [one.id], warning: true };
  }
  // Composition and allergens.
  if (one && /(состав|желатин|аллерги|вегетариан|веган|глютен|лактоз|сахар|рыб)/.test(t)) {
    const comp = (one.composition ?? '').replace(/\s+/g, ' ').trim();
    return { from: 'bot', text: `${comp ? `Состав ${name(one)}: ${comp.replace(/\.$/, '')}.` : `Полный состав ${name(one)} — на упаковке и на странице продукта.`}${/(аллерги|рыб|желатин|вегетариан|веган|глютен|лактоз)/.test(t) ? ' Если есть аллергия или ограничения в питании, перед приёмом посоветуйтесь с врачом.' : ''}`, products: [one.id], links: [{ label: 'Подробнее о продукте', href: more(one) }] };
  }
  if (!one && /(желатин|вегетариан|веган|глютен|лактоз|без сахара|состав капсул)/.test(t)) return { from: 'bot', text: 'Состав зависит от продукта: напишите название — я покажу состав по этикетке. Если есть ограничения в питании или аллергия, перед приёмом лучше посоветоваться с врачом.', links: [{ label: 'Открыть каталог', href: '/catalog/' }] };
  // Two products compared.
  if (found.length >= 2 && /(чем отлича|разниц|что лучше|или лучше|сравни)/.test(t)) {
    const [a, b] = found;
    const about = (p: ChatProduct) => (p.highlights.slice(0, 2).join(', ') || (index.themes.find(th => th.product === p.id)?.lead ?? '').split(/(?<=[.!?])\s/)[0] || 'подробности — на странице продукта').replace(/\.$/, '');
    const line = (p: ChatProduct) => `${name(p)}: ${about(p)}`;
    return { from: 'bot', text: `${line(a)}. ${line(b)}. Что подойдёт именно вам, лучше обсудить со специалистом.`, products: [a.id, b.id], chips: ['Связаться со специалистом'], warning: true };
  }
  // Pregnancy, breastfeeding, children with a named product: the label's cautions and the doctor first.
  if (/(беремен|кормлю|грудн|кормлени|ребен|ребён|детям|детей|ребенку|сыну|дочк|дочер|с какого возраста|со скольки лет|с скольки лет|какого возраста)/.test(t) && one) {
    const contra = (one.contra ?? '').replace(/\s+/g, ' ').trim();
    const kidsUsage = (one.usage ?? '').split(/(?<=[.!?])\s+/).filter(x => /(дет|ребен|ребён|возраст|(?<![а-яё])лет(?![а-яё])|взросл)/iu.test(x)).join(' ');
    const pregnant = /(беремен|кормл|грудн)/.test(t);
    return { from: 'bot', text: `${pregnant ? 'При беременности и кормлении грудью' : 'Детям'} любые БАД — только после консультации с врачом${pregnant ? '' : ' (педиатром)'}.${!pregnant && kidsUsage ? ` По этикетке ${name(one)}: ${kidsUsage.replace(/\.$/, '')}.` : ''}${contra ? ` Не подходит: ${contra.replace(/\.$/, '').replace(/^./, c => c.toLowerCase())}.` : ''}`, products: [one.id], chips: ['Связаться со специалистом'], warning: true };
  }
  // Pregnancy, breastfeeding, children without a product: no pick, the doctor first.
  if (/(беремен|кормлю грудью|грудное вскармл|кормящ)/.test(t)) return { from: 'bot', text: 'При беременности и кормлении грудью любые БАД — только после консультации с врачом. Я не подбираю добавки в этот период; специалист NSP Center поможет вместе с вашим врачом.', chips: ['Связаться со специалистом'] };
  if (/(ребенку|ребёнку|детям|для детей|для ребен|для ребён|сыну|дочке|дочери)/.test(t)) {
    const kids = index.products.filter(p => /(herbasaur|детск|kids|для детей)/i.test(p.name) && inStock(p.id)).slice(0, 3);
    return { from: 'bot', text: `Детям добавки — только после консультации с педиатром.${kids.length ? ' У NSP есть детская линейка — покажите её врачу:' : ''}`, products: kids.map(p => p.id), chips: ['Связаться со специалистом'], warning: Boolean(kids.length) };
  }
  // Orders: status, tracking, cancelling.
  if (/(где (мой|мои) заказ|статус заказ|трек|отслед|номер отправлен|не перезвонил|не позвонил|отменить заказ|изменить заказ|заказ не приш)/.test(t)) return { from: 'bot', text: 'Менеджер подтверждает заказ по телефону в течение 1 рабочего дня (пн–пт). Посылку CDEK можно отследить по номеру из SMS на cdek.ru/tracking. Чтобы узнать о заказе, отменить или изменить его — напишите или позвоните нам.', links: consultantLinks };
  // Outside Russia.
  if (/(казахстан|беларус|белорус|армени|киргиз|узбекист|снг|за границ|другую страну)/.test(t)) return { from: 'bot', text: 'На сайте описана доставка по России. Про отправку в другую страну уточните у менеджера — он подскажет, возможно ли это.', links: consultantLinks.slice(0, 2) };
  // Delivery cost and terms.
  if (/(доставк|доставля|достав|достака|привез|курьер|сдэк|cdek|отправ|почтой|посылк|в регион|по россии|сколько ждать|сколько дней ид|срок[иа]? доставк|когда привез)/.test(t) && !/(оплат|наличн|наличк|картой|предоплат)/.test(t)) return { from: 'bot', text: deliveryText, links: [{ label: 'Условия доставки', href: '/delivery/' }] };
  // How to order (orders are not sent from the site yet: be honest).
  if (/(как (оформ|заказ|купить|сделать заказ)|оформить заказ|сделать заказ|хочу заказать|хочу купить|где купить|как купить)/.test(t)) return { from: 'bot', text: 'Положите продукты в корзину и сохраните черновик заказа, затем позвоните нам или напишите на почту — менеджер подтвердит заказ и способ получения. Оформление и оплата прямо на сайте скоро появятся.', links: [{ label: 'Корзина', href: '/cart/' }, ...consultantLinks.slice(0, 2)] };
  // Payment.
  if (/(сбп|систем[аы] быстрых|по qr|qr-код)/.test(t)) return { from: 'bot', text: 'Про оплату через СБП уточните у менеджера — на сайте этот способ пока не описан. Наличными можно в пункте выдачи и курьеру по Санкт-Петербургу.', links: [{ label: 'Способы оплаты', href: '/payments/' }, ...consultantLinks.slice(0, 1)] };
  if (/(оплат|заплат|наличн|наличк|картой|перевод|предоплат|рассрочк|оплачив)/.test(t)) return { from: 'bot', text: 'Наличными — в пункте выдачи или курьеру по Санкт-Петербургу. Отправка CDEK в другие города — только по полной предоплате. Как оплатить картой, подскажет менеджер при подтверждении заказа: оплата на сайте скоро появится.', links: [{ label: 'Способы оплаты', href: '/payments/' }] };
  // Returns.
  if (/(разбит|повреж|пришл[аои] (разбит|сломан|не то)|протек|не тот товар|не то прислали)/.test(t)) return { from: 'bot', text: 'Очень жаль! Сфотографируйте товар и упаковку и напишите нам — менеджер заменит или вернёт деньги.', links: consultantLinks };
  if (/(вернуть|возврат|обмен|обменять|не подошел|не подошло|брак|испорч)/.test(t)) return { from: 'bot', text: 'БАД по закону относятся к пищевым продуктам, а такие товары надлежащего качества не возвращают и не обменивают. Если есть сомнения в качестве, напишите нам — разберёмся; подробности на странице «Условия возврата».', links: [{ label: 'Условия возврата', href: '/company/refund/' }, ...consultantLinks.slice(0, 1)] };
  // Certificates, authenticity.
  if (/(сертифик|подделк|оригинал|настоящ|честный знак|маркировк|качество продук|качественн|gmp|гмп|кто производ|где производ|производител)/.test(t)) return { from: 'bot', text: 'Продукция Nature’s Sunshine производится в США (Спаниш-Форк, штат Юта) по международному стандарту качества GMP, у компании есть сертификаты NSF и других организаций. БАД маркируются в системе «Честный знак» — подлинность можно проверить по коду на упаковке.', links: [{ label: 'Сертификаты', href: '/company/sertifikaty/' }] };
  // Shelf life, storage.
  if (/(срок годност|годен|просроч|хранит|хранени|холодильник)/.test(t)) return { from: 'bot', text: `Срок годности и условия хранения указаны на упаковке каждого продукта. Обычно добавки хранят в сухом прохладном месте, без прямого солнца${one ? `; уточнить для ${name(one)} можно у специалиста` : ''}.`, ...(one ? { products: [one.id] } : {}), links: consultantLinks.slice(0, 1) };
  // Phone, messengers, email.
  if (/(телефон|номер ваш|ватсап|whatsapp|вотсап|телеграм|telegram|почт[аыу] ваш|e-?mail|емейл|имейл|написать вам|как связаться)/.test(t)) return { from: 'bot', text: `Телефон: ${data.site.phones?.[0] ?? phone}. Можно написать на почту ${email}.`, links: consultantLinks };
  // Promotions, promo codes, gifts, wholesale.
  if (/(подар)/.test(t) && !/(подарок к заказу|в подарок к|будет подарок)/.test(t)) return { from: 'bot', text: 'Для подарка удобно выбрать готовый набор продуктов NSP или уходовую косметику. Если подскажете, кому и для чего, — помогу выбрать; можно и позвонить нам.', links: [{ label: 'Наборы продуктов', href: '/catalog/nabory-produktov/' }, ...consultantLinks.slice(0, 1)] };
  if (/(акци|промокод|скидк[аи] на|распродаж|подар)/.test(t)) return { from: 'bot', text: 'Сейчас акций и промокодов на сайте нет. Постоянная выгода — дисконтная карта NSP: скидка до 30%. Об акциях к заказу спросите менеджера.', links: [{ label: 'Оформить карту', href: partnerSignupUrl }, ...consultantLinks.slice(0, 1)] };
  if (/(опт|оптом|большой заказ|много штук|для магазина)/.test(t)) return { from: 'bot', text: 'Для партнёров NSP цены ниже по дисконтной карте. Про большой заказ напишите менеджеру — он посчитает.', links: consultantLinks.slice(0, 2) };
  // «Ты бот?»
  if (/(ты бот|вы бот|ты робот|вы робот|это бот|ты человек|вы человек)/.test(t)) return { from: 'bot', text: 'Я бот-помощник NSP Center — программа, которая отвечает по лекциям врачей и правилам магазина. Я не врач. Если нужен живой человек — позвоните или напишите на почту, ответит специалист.', links: consultantLinks.slice(0, 2) };
  // Opening hours (today's day too).
  if (/(сегодня|сейчас).*(открыт|работает|работаете)|(открыт|работаете).*(сегодня|сейчас)/.test(t)) { const day = new Date().getDay(); return { from: 'bot', text: `${day === 0 ? 'Сегодня воскресенье — пункт выдачи не работает.' : day === 6 ? 'Сегодня суббота — работаем с 12:00 до 17:30.' : 'Сегодня работаем с 11:00 до 19:00.'} ${hoursText}`, links: [{ label: 'Контакты и карта', href: '/contacts/' }] }; }
  // Opening hours.
  if (/(во сколько|часы работы|график|режим работы|до скольки|работаете|выходн|открыт[ыо])/.test(t)) return { from: 'bot', text: `${hoursText} Адрес: ${data.site.address}.`, links: [{ label: 'Контакты и карта', href: '/contacts/' }] };
  // Becoming a partner (distributor), as opposed to only getting the card.
  if (/(pv|пв балл|баллы|бонусн)/.test(t)) return { from: 'bot', text: 'PV — баллы, которые копятся на дисконтной карте NSP с каждой покупкой. От накопленных баллов зависит накопительная скидка. Подробнее — в частых вопросах или у специалиста.', links: [{ label: 'Частые вопросы', href: '/company/faq/' }, ...consultantLinks.slice(0, 1)] };
  if (/(партнер|партнёр|дистрибьют|консультантом nsp|стать консультант|бизнес|заработ)/.test(t)) return { from: 'bot', text: 'Стать партнёром NSP можно онлайн: регистрация даёт номер дисконтной карты (скидка до 30%) и доступ к партнёрской программе. Подскажем по шагам, если напишете нам.', links: [{ label: 'Регистрация партнёра', href: partnerSignupUrl }, ...consultantLinks.slice(0, 1)] };
  // Just a product's name, maybe misspelt («хлорафил»): what it is, how to take it, who should not.
  if (one && text.trim().split(/\s+/).length <= 3) { const info = adviceFor(one.id, '', [], index); return { ...info, text: `Вот что известно про ${name(one)}: ниже — зачем это, как принимать и кому не подходит.`, chips: [] }; }
  return null;
}

function intent(text: string): Message | null {
  const t = text.toLowerCase();
  if (/^(привет|здравств|добрый)/.test(t)) return { from: 'bot', text: 'Здравствуйте! Я бот-помощник NSP Center. Расскажите, что хочется поддержать — сон, энергию, пищеварение, иммунитет — или спросите о конкретном продукте.' };
  if (/спасиб/.test(t)) return { from: 'bot', text: 'Пожалуйста! Если появятся вопросы — пишите.' };
  if (/(адрес|где вы|где вас|найти вас|вас найти|где находит|как добрат|самовывоз|пункт выдачи|офис|приехать|забрать)/.test(t)) return { from: 'bot', text: `Наш пункт выдачи: ${data.site.address}. Перед визитом лучше позвонить — ${data.site.phones?.[0] ?? ''}.`, links: [{ label: 'Контакты и карта', href: '/contacts/' }, ...consultantLinks.slice(0, 2)] };
  if (/(доставк|привез|курьер)/.test(t)) return { from: 'bot', text: 'Доставляем по всей России, условия и сроки зависят от города и способа.', links: [{ label: 'Условия доставки', href: '/delivery/' }] };
  if (/(оплат|заплат)/.test(t)) return { from: 'bot', text: 'Способы оплаты описаны на странице «Оплата».', links: [{ label: 'Оплата', href: '/payments/' }] };
  if (/(скидк|дисконт|карт|дешевле|партн)/.test(t)) return { from: 'bot', text: 'С дисконтной картой NSP товары дешевле — скидка до 30%. Карту можно оформить онлайн, а номер добавить в профиле, тогда цены по карте будут в каталоге и корзине.', links: [{ label: 'Оформить карту', href: partnerSignupUrl }, { label: 'Профиль', href: '/profile/' }] };
  if (/(врач|специалист|доктор|нутрициолог|консультац|консультант|живого человека|живой человек|с человеком|оператор|менеджер|позвон|живой|живым|связат)/.test(t)) return { from: 'bot', text: 'Помогу связаться со специалистом NSP Center: он разберёт вашу ситуацию и подскажет схему приёма. Выберите, как удобнее. Если есть боль, температура или другие тревожные признаки — сначала обратитесь к врачу.', links: consultantLinks };
  return null;
}

// Follow-up symptoms offered after the first health question, by its topic.
const followUps: [RegExp, string[]][] = [
  [/(спл|сон|сна|усну|засып|бессон|просып)/i, ['Тревожность', 'Устаю днём', 'Напряжение в мышцах']],
  [/(устал|устаю|сил|бодр|энерг|вял)/i, ['Плохо сплю', 'Много стресса', 'Часто простываю']],
  [/(тяжест|вздут|живот|желуд|изжог|перевар|аппетит|ем)/i, ['Вздутие', 'Нерегулярный стул', 'Изжога']],
  [/(запор|стул|кишеч)/i, ['Вздутие', 'Тяжесть после еды', 'Мало пью воды']],
  [/(прост|болею|орви|иммун)/i, ['Устаю днём', 'Мало овощей в рационе', 'Плохо сплю']],
  [/(волос|ногт|кож)/i, ['Ломкие ногти', 'Сухая кожа', 'Устаю днём']],
  [/(сустав|колен|связк)/i, ['Много нагрузки', 'Хруст в суставах', 'Скованность по утрам']],
];
function clarify(text: string): Message {
  const chips = followUps.find(([re]) => re.test(text))?.[1] ?? ['Устаю днём', 'Плохо сплю', 'Много стресса'];
  return { from: 'bot', text: 'Понимаю. Чтобы подсказать точнее: что ещё вас беспокоит? Опишите своими словами или выберите ниже.', chips: [...chips, 'Больше ничего'], ask: text };
}
// The recommendation reads as advice: «Попробуйте попить X. <What it does>.» The reason is the sentence of the topic text
// that says what the product does, without the "doctors say" lead-in.
function advice(name: string, text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).map(x => x.replace(/^(Врачи-нутрициологи|Нутрициологи|Врачи)\s+(рассказывают|объясняют|отмечают|советуют|называют[^,]*),?\s*(что\s+)?/u, '').trim());
  const reason = sentences.find(x => /(поддерж|помога|участв|восполн|нужен|нужна|нужны|питает|расщеп)/iu.test(x)) ?? sentences[0] ?? '';
  const why = reason ? reason[0].toUpperCase() + reason.slice(1).replace(/\.$/, '') + '. ' : '';
  return `Попробуйте попить ${name}. ${why}Принимайте по инструкции на упаковке.`;
}
// «Для чего нужен хлорофилл?» or a product name: the visitor asks about a product, not a symptom — answer at once.
function asksAboutProduct(text: string, index: Index): boolean {
  if (/^(для чего|зачем|что такое|как принимать|как пить|расскажите)/i.test(text.trim())) return true;
  const q = terms(text);
  return index.products.some(p => words(shortName(p.name)).some(w => w.length > 3 && q.has(stem(w))));
}
const anotherOption = 'Предложите что-то ещё';
// Close substitutes for products that are often out of stock (same purpose, picked from the theme pages).
const siblings: Record<string, string[]> = { glucosamine: ['coral-calcium', 'chondroitin', 'msm'], chondroitin: ['coral-calcium', 'glucosamine'], msm: ['coral-calcium', 'glucosamine'], '5-htp-power': ['magnesium-complex', 'hvp', 'lecithin'], 'mind-max': ['lecithin', 'magnesium-complex'], 'magnesium-complex': ['hvp', 'lecithin'] };
const pathOf = (id: string, index: Index) => index.themes.find(t => t.product === id)?.path;
// An advice message for one product; when it is out of stock the visitor is offered the waiting list and, at once, the next
// product that is in stock.
// What the assistant tells about a product: why it, what it does, how to take it (the label's own usage — times a day and
// course length) and for whom by age (the label's age rule; no rule on the label means adults, children only with a doctor).
const sentencesOf = (text: string) => text.split(/(?<=[.!?])\s+/).map(x => x.replace(/^(Врачи-нутрициологи|Нутрициологи|Врачи)\s+(рассказывают|объясняют|отмечают|советуют|называют[^,]*),?\s*(что\s+)?/u, '').trim()).filter(Boolean).map(x => x[0].toUpperCase() + x.slice(1));
function productSections(product: ChatProduct | undefined, theme: ChatTheme | undefined, fallback: string): Section[] {
  const lead = sentencesOf(theme?.lead ?? fallback);
  const what = theme?.sections.find(x => /(что делает|чем полез|для чего|зачем|как работает|в организме)/iu.test(x.h));
  const why = lead.find(x => /(поддерж|помога|участв|восполн|нужен|нужна|нужны|питает|расщеп)/iu.test(x)) ?? lead[0] ?? '';
  const useful = product?.highlights.length ? product.highlights.join(', ') : sentencesOf(what?.p ?? '').slice(0, 2).join(' ');
  const usage = (product?.usage ?? '').replace(/\s+/g, ' ').trim();
  const kids = usage.split(/(?<=[.!?])\s+/).filter(x => /(дет|ребен|ребён|возраст|(?<![а-яё])лет(?![а-яё]))/iu.test(x)).join(' ');
  const adult = usage.split(/(?<=[.!?])\s+/).filter(x => !/(дет|ребен|ребён|возраст|(?<![а-яё])лет(?![а-яё]))/iu.test(x)).join(' ');
  const age = kids || (/взросл/iu.test(usage) ? 'Для взрослых. Детям — только после консультации с педиатром.' : '');
  const out: Section[] = [];
  if (why) out.push({ title: 'Зачем это вам', text: why });
  if (useful && useful !== why) out.push({ title: 'Чем полезен', text: useful });
  if (adult) out.push({ title: 'Как принимать', text: adult });
  if (age) out.push({ title: 'По возрасту', text: age });
  if (product?.contra) out.push({ title: 'Не подходит', text: product.contra.replace(/\.$/, '') + '.' });
  return out;
}
/** «Источник: врач, лекция» under advice (owner, 2026-11-08): the theme page's lecture, or the product's expert comment. */
function sourceOf(product: ChatProduct | undefined, theme: ChatTheme | undefined) {
  const s = theme?.source?.speaker ? theme.source : product?.expert ? { speaker: `${product.expert.speaker}${product.expert.role ? `, ${product.expert.role}` : ''}`, lecture: product.expert.lecture } : theme?.source;
  return s ? `Источник: ${s.speaker ? `${s.speaker}, ` : ''}лекция «${s.lecture}»` : '';
}
function adviceFor(id: string, topicText: string, rest: string[], index: Index, chips?: string[]): Message {
  const product = index.products.find(p => p.id === id);
  const theme = index.themes.find(t => t.product === id);
  const name = shortName(product?.name ?? '');
  // Product names stay as they are written (nominative), so the sentence is built around them: «Вам может подойти
  // «Пчелиная пыльца»», not «Попробуйте попить Пчелиная пыльца» (owner, 2026-11-10: write like a person, in correct cases).
  const sections = productSections(product, theme, topicText);
  const text = `Вам может подойти «${name}».${sections.length ? ' Ниже коротко: зачем это, как принимать и кому не подходит.' : ''}`;
  const alt = product && !inStock(product.id) ? rest[0] : undefined;
  const path = pathOf(id, index);
  const tail = alt ? ` Сейчас этого продукта нет в наличии — нажмите «Сообщить о поступлении», и я напомню, когда он появится. А пока есть похожий вариант — «${shortName(index.products.find(p => p.id === alt)?.name ?? '')}».` : '';
  const left = alt ? rest.slice(1) : rest;
  return { from: 'bot', text: text + tail, sections, ...(sourceOf(product, theme) ? { source: sourceOf(product, theme) } : {}), product: id, ...(alt ? { altProduct: alt } : {}), links: path ? [{ label: 'Подробнее о продукте', href: path }] : undefined, warning: true, alts: left, chips: [...(left.length ? [anotherOption] : []), ...(chips ?? [])] } as Message;
}
export { productSections };
export function recommend(text: string, index: Index): Message {
  const found = answer(text, index);
  if (!found.product) return found;
  const message = adviceFor(found.product, found.text, found.alts ?? [], index, (found.chips ?? []).filter(c => c !== anotherOption));
  // Pain, fever, children, pregnancy, medicines: say plainly that a doctor comes first and offer the specialist.
  return risky.test(text) ? { ...message, text: `${message.text} Ваш случай лучше сначала обсудить с врачом — я не ставлю диагнозы и не подбираю лечение.`, chips: [...new Set([...(message.chips ?? []), 'Связаться со специалистом'])] } : message;
}

export function answer(text: string, index: Index): Message {
  const direct = intent(text);
  if (direct) return direct;
  const q = queryTerms(text);
  const productHit = index.products.map(p => ({ p, n: overlap(q, shortName(p.name)) })).filter(x => x.n > 0).sort((a, b) => b.n - a.n)[0];
  const scored = index.themes.map(t => {
    const name = shortName(index.products.find(p => p.id === t.product)?.name ?? '');
    const score = overlap(q, `${t.h1} ${name}`) * 4 + overlap(q, t.lead) * 2 + Math.max(0, ...t.faq.map(f => overlap(q, f.q))) * 2 + overlap(q, t.sections.map(s => s.h).join(' ')) + (productHit && t.product === productHit.p.id ? 6 : 0) + (aliases.some(([re, id]) => re.test(text) && id === t.product) ? 8 : 0) + (inStock(t.product) ? 1 : 0);
    return { t, score };
  }).filter(x => x.score >= 3).sort((a, b) => b.score - a.score);
  if (!scored.length) return { from: 'bot', text: 'Пока не могу ответить на этот вопрос. Я подсказываю по продуктам NSP, доставке, оплате и скидкам — опишите, что хочется поддержать, или спросите специалиста.', links: consultantLinks };
  const best = scored[0].t;
  const faq = best.faq.map(f => ({ f, n: overlap(q, f.q) })).sort((a, b) => b.n - a.n)[0];
  const body = faq && faq.n >= 3 ? faq.f.a : best.lead;
  const caution = risky.test(text) ? ' Ваш случай лучше обсудить с врачом: я не ставлю диагнозы и не подбираю лечение. Могу помочь связаться со специалистом.' : '';
  const more = [...scored.slice(1, 3).map(x => x.t.h1), ...(risky.test(text) ? ['Связаться со специалистом'] : [])];
  // Alternatives: first the products the lecture topics pair with the best one (same theme page), then the next matches.
  const paired = siblings[best.product] ?? [];
  const alts = [...paired, ...scored.slice(1).map(x => x.t.product)].filter((id, i, all) => id !== best.product && all.indexOf(id) === i && index.products.some(p => p.id === id) && inStock(id)).slice(0, 5);
  return { from: 'bot', text: body + caution, product: best.product, links: [{ label: 'Подробнее о продукте', href: best.path }], chips: [...(alts.length ? [anotherOption] : []), ...more], alts };
}

const fromChat = (href: string) => (href.startsWith('/') ? `${href}${href.includes('?') ? '&' : '?'}from=chat` : href);

/** In stock now: the site's product data, which carries the administrator's stock changes. */
const inStock = (id: string) => data.products.find(x => x.id === id)?.availability !== 'OutOfStock';
function ProductMini({ id, index }: { id: string; index: Index }) {
  const { state, add } = useStore();
  const p = index.products.find(x => x.id === id); const full = data.products.find(x => x.id === id);
  if (!p || !full) return null;
  // Price and stock from the site's product (the administrator may have changed them, src/site.ts), not the chat index.
  const price = priceOf(full, state.card); const partner = state.card && full.prices.partner !== null;
  return <div className="chat-product"><img src={productCover(full)} alt="" width="56" height="56" /><a href={fromChat(p.path)}>{shortName(p.name)}<span>{money(price)}{partner ? ' по карте' : ''}</span></a>{inStock(full.id) ? <button type="button" className="btn card-cart-button" onClick={() => add(full)}>В корзину</button> : <WaitlistButton product={full} />}</div>;
}

export function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [draft, setDraft] = useState('');
  const [index, setIndex] = useState<Index | null>(null);
  // Whether the consultation agent is connected on the server (scripts/ai-agent.mjs); off: prepared answers only.
  const [ai, setAi] = useState(false);
  useEffect(() => { fetch('/api/ai/status', { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : null).then(b => setAi(Boolean(b?.enabled))).catch(() => { /* prepared answers */ }); }, []);
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  // «↓» appears when the visitor has scrolled up more than a screen's worth from the latest messages.
  const [away, setAway] = useState(false);
  // Whether the visitor is at the latest messages: only then does a new message move the view (reading older advice is
  // not interrupted; research 2026-11-10).
  const atEnd = useRef(true);
  const onScroll = () => { const el = log.current; if (!el) return; const left = el.scrollHeight - el.scrollTop - el.clientHeight; atEnd.current = left < 80; setAway(left > 240); };
  const newChat = () => { setMessages([{ ...greeting, at: now() }]); setDraft(''); atEnd.current = true; };
  const toBottom = () => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' }); };
  // Phone keyboard: how much of the screen it covers (visualViewport), so the input row can ride above it; the log stays
  // scrolled to the latest messages. The bottom bar is never hidden.
  useEffect(() => {
    const vv = window.visualViewport;
    const fit = () => { const covered = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0; const root = document.documentElement; root.style.setProperty('--chat-kb', `${Math.round(covered)}px`); root.style.setProperty('--chat-vh', `${Math.round(vv?.height ?? window.innerHeight)}px`); root.classList.toggle('chat-kb-open', covered > 60);
      // The chat column ends exactly at the top of the bottom bar, or of the keyboard when it is open.
      const nav = document.querySelector<HTMLElement>('.bottom-nav'); const navH = nav && getComputedStyle(nav).display !== 'none' ? Math.max(0, window.innerHeight - nav.getBoundingClientRect().top) : 0;
      root.style.setProperty('--chat-bottom', `${Math.round(covered > 60 ? covered : navH)}px`); window.scrollTo(0, 0);
      if (log.current && atEnd.current) log.current.scrollTop = log.current.scrollHeight; };
    fit(); vv?.addEventListener('resize', fit); vv?.addEventListener('scroll', fit); window.addEventListener('resize', fit);
    return () => { vv?.removeEventListener('resize', fit); vv?.removeEventListener('scroll', fit); document.documentElement.style.removeProperty('--chat-kb'); document.documentElement.style.removeProperty('--chat-vh'); document.documentElement.classList.remove('chat-kb-open'); document.documentElement.style.removeProperty('--chat-bottom'); window.removeEventListener('resize', fit); };
  }, [focused]);
  useEffect(() => { try { const saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null'); if (Array.isArray(saved) && saved.length) setMessages(saved); } catch { /* new chat */ } import('./generated/chat-index.json').then(m => setIndex((m.default ?? m) as Index)); }, []);
  useEffect(() => { if (messages.some(m => !m.at)) setMessages(ms => ms.map(m => m.at ? m : { ...m, at: now() })); }, [messages]);
  useEffect(() => { try { sessionStorage.setItem(storeKey, JSON.stringify(messages.slice(-60))); } catch { /* ignore */ }
    // The visitor's own message always shows; an answer shows when the visitor was at the end, and a long answer opens at
    // its beginning rather than its end.
    const lastMsg = messages[messages.length - 1];
    if (!(lastMsg?.from === 'user' || atEnd.current)) return;
    // An answer that does not fit on the screen opens at its first line, with the question just above it.
    const show = () => { const el = log.current; if (!el) return; const nodes = el.querySelectorAll<HTMLElement>('.chat-messages > .chat-msg'); const node = nodes[nodes.length - 1];
      const fits = !node || node.offsetHeight <= el.clientHeight - 140;
      if (typing || lastMsg?.from !== 'bot' || fits) { el.scrollTop = el.scrollHeight; return; }
      // The visitor's own question stays in view at the top, with the beginning of the answer under it (owner, 2026-11-10).
      const asked = nodes[nodes.length - 2]; const top = (asked && asked.classList.contains('chat-msg--user') ? asked : node).getBoundingClientRect().top;
      el.scrollTop += top - el.getBoundingClientRect().top - 12; };
    show(); const t = window.setTimeout(show, 250); return () => clearTimeout(t); }, [messages, typing, index]);
  // A health question first gets a clarifying question (what else bothers you); the recommendation comes after the reply,
  // built from both messages, with the BAD warning. Shop questions (delivery, discount, consultant) are answered at once.
  const send = (text: string) => {
    const value = text.trim(); if (!value) return;
    // «Начать новый чат» (or «новый чат», «начать сначала», «заново») clears the conversation back to the greeting.
    if (/^(начать\s+)?(нов(ый|ую)\s+(чат|переписк\S*|разговор)|сначала|заново|начать\s+сначала|начать\s+заново)[.!]?$/iu.test(value)) { newChat(); return; }
    const asked = [...messages].reverse().find(m => m.from === 'bot')?.ask;
    // The product of the latest answer that had one, for follow-ups like «а сколько он стоит?».
    const lastBot = [...messages].reverse().find(m => m.from === 'bot');
    const lastProduct = lastBot?.product ?? lastBot?.products?.[0];
    setMessages(m => [...m, { from: 'user', text: value }]); setDraft(''); setTyping(true);
    const byRules = () => {
      let reply: Message;
      if (!index) reply = { from: 'bot', text: 'Секунду, готовлюсь… Повторите вопрос, пожалуйста.' };
      else if (value === anotherOption) { const lastBot = [...messages].reverse().find(m => m.from === 'bot'); const rest = lastBot?.alts ?? []; reply = rest.length ? adviceFor(rest[0], '', rest.slice(1), index) : { from: 'bot', text: 'К сожалению, больше ничего предложить не могу. Спросите что-то ещё.' }; }
      else if (emergency.test(value)) reply = emergencyReply;
      else if (shopAnswer(value, index, lastProduct)) reply = shopAnswer(value, index, lastProduct)!;
      else if (intent(value)) reply = intent(value)!;
      else if (asked) reply = recommend(/^больше ничего/i.test(value) ? asked : `${asked} ${value}`, index);
      else { const first = answer(value, index); reply = !first.product ? first : asksAboutProduct(value, index) ? { ...first, text: `Вот что известно про «${shortName(index.products.find(p => p.id === first.product)?.name ?? '')}»: ниже — зачем это, как принимать и кому не подходит.${risky.test(value) ? ' Ваш случай лучше сначала обсудить с врачом — я не ставлю диагнозы и не подбираю лечение.' : ''}`, sections: productSections(index.products.find(p => p.id === first.product), index.themes.find(t => t.product === first.product), first.text), source: sourceOf(index.products.find(p => p.id === first.product), index.themes.find(t => t.product === first.product)) || undefined, warning: true } : clarify(value); }
      setMessages(m => [...m, reply]); setTyping(false);
    };
    // With the agent connected (scripts/ai-agent.mjs) a health question goes to it; shop questions, warning signs and
    // «Предложите что-то ещё» keep their prepared answers, and any failure of the agent falls back to them too.
    if (ai && index && value !== anotherOption && !emergency.test(value) && !shopAnswer(value, index, lastProduct) && !intent(value)) {
      const history = messages.slice(-6).map(m => ({ role: m.from === 'bot' ? 'assistant' : 'user', text: m.text }));
      fetch('/api/ai/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: value, history }) })
        .then(async r => { const b = await r.json().catch(() => null); if (!r.ok || typeof b?.text !== 'string') throw new Error('agent'); return b as { text: string; products: string[]; sources: { speaker: string; lecture: string }[]; chips?: string[] }; })
        .then(b => { const products = b.products.filter(id => index.products.some(p => p.id === id)); setMessages(m => [...m, { from: 'bot', text: b.text, products, source: b.sources.length ? `Источник: ${b.sources.map(s => `${s.speaker ? `${s.speaker}, ` : ''}лекция «${s.lecture}»`).join('; ')}` : undefined, warning: products.length > 0, chips: b.chips }]); setTyping(false); })
        .catch(byRules);
      return;
    }
    window.setTimeout(byRules, 600);
  };
  const submit = (e: FormEvent) => { e.preventDefault(); send(draft); };
  const last = messages[messages.length - 1];
  // The page heading is for search engines and screen readers only (owner: no visible title above the chat).
  // A series: messages of one side in a row sit closer, only the last has the bubble's tail and the time under it.
  const lastOfSeries = (i: number) => messages[i + 1]?.from !== messages[i].from;
  const firstOfSeries = (i: number) => messages[i - 1]?.from !== messages[i].from;
  return <div className="chat" data-ds-id="assistant-chat"><h1 className="sr-only">Консультация NSP Center</h1>
    <div className="chat-log" ref={log} onScroll={onScroll}>
      <div className="chat-messages" role="log" aria-live="polite" aria-label="Переписка с помощником">
      {messages.map((m, i) => <div className={`chat-msg chat-msg--${m.from}${firstOfSeries(i) ? '' : ' is-cont'}${lastOfSeries(i) ? ' is-last' : ''}${m.emergency ? ' chat-msg--urgent' : ''}`} key={i}>
        {m.emergency && <strong className="chat-urgent-title">Это нужно показать врачу</strong>}
        <p>{m.text}</p>
        {m.emergency && <div className="chat-urgent-calls"><a className="btn btn--primary" href="tel:103">Позвонить 103</a><a className="btn btn--secondary" href="tel:112">112</a></div>}
        {m.sections && <dl className="chat-sections">{m.sections.map(x => <div key={x.title}><dt>{x.title}</dt><dd>{x.text}</dd></div>)}</dl>}
        {m.product && index && <ProductMini id={m.product} index={index} />}
        {m.products?.map(id => index && <ProductMini key={id} id={id} index={index} />)}
        {m.altProduct && index && <ProductMini id={m.altProduct} index={index} />}
        {m.source && <p className="chat-source">{m.source}</p>}
        {m.warning && <p className="chat-warning">БАД не является лекарственным средством. Перед применением проконсультируйтесь со специалистом.</p>}
        {m.links && <div className="chat-links">{m.links.map(l => <a key={l.href} href={fromChat(l.href)} target={l.href.startsWith('http') ? '_blank' : undefined} rel={l.href.startsWith('http') ? 'noopener' : undefined}>{l.label}<Icon name="chevron" size={16} /></a>)}</div>}
        {lastOfSeries(i) && m.at && <time className="chat-time">{m.at}</time>}
      </div>)}
      </div>
      {typing && <div className="chat-msg chat-msg--bot chat-typing" role="status" aria-label="Помощник печатает"><i /><i /><i /></div>}
      {!typing && last?.from === 'bot' && last.chips && <div className="chat-suggest" aria-label="Подсказки">{last.chips.map(c => <button type="button" key={c} onClick={() => send(c)}>{c}</button>)}</div>}
      {/* The input row ends the conversation (owner, 2026-11-10): it scrolls away with the messages, and the way back to it is
          down to the end (or the «↓» button). */}
      <div className="chat-composer">
        <form className="chat-input" onSubmit={submit}><input value={draft} onChange={e => setDraft(e.target.value)} onFocus={() => { setFocused(true); atEnd.current = true; }} onBlur={() => setFocused(false)} placeholder="Напишите ваш вопрос" aria-label="Ваш вопрос" maxLength={500} enterKeyHint="send" autoComplete="off" /><button type="submit" className="chat-send" disabled={!draft.trim()} aria-label="Отправить"><Icon name="arrow" size={20} /></button></form>
        <p className="chat-note">Помощник не заменяет консультацию врача.</p>
      </div>
      <div ref={end} />
    </div>
    {away && <button type="button" className="chat-down" onClick={toBottom} aria-label="К последним сообщениям"><Icon name="chevron" size={22} /></button>}
  </div>;
}
