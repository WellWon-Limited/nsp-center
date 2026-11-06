import './assistant.css';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { data, money, shortName, useStore } from './store';
import { Icon, WaitlistButton } from './ui';

// «Консультация» (/consultation/): a chat with the shop's assistant. Until the AI server exists (an API key cannot live in
// the site), the assistant answers from the theme pages and expert comments written from the doctors' lecture base: it finds
// the closest topic, answers in a few sentences, shows the product, and hands anything it
// cannot answer to a live consultant. It never diagnoses; health-risk questions get a "see a doctor" note. The search index
// (src/generated/chat-index.json, scripts/split-content.mjs) is loaded only on this page.

type ChatTheme = { path: string; h1: string; product: string; lead: string; sections: { h: string; p: string }[]; faq: { q: string; a: string }[]; source: { course: string; lecture: string; speaker?: string } | null };
type ChatProduct = { id: string; name: string; path: string; price: number; partner: number | null; available: boolean; expert: { speaker: string; role: string; lecture: string } | null; usage: string; contra: string; highlights: string[] };
type Index = { themes: ChatTheme[]; products: ChatProduct[] };
type Link = { label: string; href: string };
type Section = { title: string; text: string };
type Message = { sections?: Section[]; from: 'bot' | 'user'; text: string; product?: string; altProduct?: string; links?: Link[]; chips?: string[]; ask?: string; warning?: boolean; alts?: string[] };

const greeting: Message = { from: 'bot', text: 'Здравствуйте! Чем могу помочь?', chips: ['Плохо сплю', 'Нет сил днём', 'Тяжесть после еды', 'Часто простываю', 'Как получить скидку?', 'Где вы находитесь?', 'Связаться со специалистом'] };
const storeKey = 'nsp-center:chat';
const phone = data.site.phones?.[1] || '+79626854838';
const email = data.site.emails?.[0] || 'sales@nsp-center.ru';
const consultantLinks: Link[] = [{ label: 'Написать в WhatsApp', href: `https://wa.me/${phone.replace(/\D/g, '')}` }, { label: 'Позвонить', href: `tel:${phone}` }, { label: 'Написать на почту', href: `mailto:${email}` }];

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
const risky = /(беремен|кормлю|грудн|ребен|ребён|дет|боль|кров|температур|лекарств|таблетк|давлен|диабет|онко)/iu;

function intent(text: string): Message | null {
  const t = text.toLowerCase();
  if (/^(привет|здравств|добрый)/.test(t)) return { from: 'bot', text: 'Здравствуйте! Расскажите, что хочется поддержать — сон, энергию, пищеварение, иммунитет — или спросите о конкретном продукте.' };
  if (/спасиб/.test(t)) return { from: 'bot', text: 'Пожалуйста! Если появятся вопросы — пишите.' };
  if (/(адрес|где вы|где находит|как добрат|самовывоз|пункт выдачи|офис|приехать|забрать)/.test(t)) return { from: 'bot', text: `Наш пункт выдачи: ${data.site.address}. Перед визитом лучше позвонить — ${data.site.phones?.[0] ?? ''}.`, links: [{ label: 'Контакты и карта', href: '/contacts/' }, ...consultantLinks.slice(0, 2)] };
  if (/(доставк|привез|курьер)/.test(t)) return { from: 'bot', text: 'Доставляем по всей России, условия и сроки зависят от города и способа.', links: [{ label: 'Условия доставки', href: '/delivery/' }] };
  if (/(оплат|заплат)/.test(t)) return { from: 'bot', text: 'Способы оплаты описаны на странице «Оплата».', links: [{ label: 'Оплата', href: '/payments/' }] };
  if (/(скидк|дисконт|карт|дешевле|партн)/.test(t)) return { from: 'bot', text: 'С дисконтной картой NSP товары дешевле — скидка до 30%. Карту можно оформить онлайн, а номер добавить в профиле, тогда цены по карте будут в каталоге и корзине.', links: [{ label: 'Оформить карту', href: 'https://nsp25.com/signup?sid=446621' }, { label: 'Профиль', href: '/profile/' }] };
  if (/(врач|специалист|доктор|нутрициолог|консультац|консультант|человек|менеджер|позвон|живой|живым|связат)/.test(t)) return { from: 'bot', text: 'Помогу связаться со специалистом NSP Center: он разберёт вашу ситуацию и подскажет схему приёма. Выберите, как удобнее. Если есть боль, температура или другие тревожные признаки — сначала обратитесь к врачу.', links: consultantLinks };
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
function adviceFor(id: string, topicText: string, rest: string[], index: Index, chips?: string[]): Message {
  const product = index.products.find(p => p.id === id);
  const theme = index.themes.find(t => t.product === id);
  const name = shortName(product?.name ?? '');
  const text = `Попробуйте попить ${name}.`;
  const sections = productSections(product, theme, topicText);
  const alt = !product?.available ? rest[0] : undefined;
  const path = pathOf(id, index);
  const tail = alt ? ` Сейчас его нет в наличии — нажмите «Сообщить о поступлении», и я напомню, когда он появится. А пока можно попробовать ${shortName(index.products.find(p => p.id === alt)?.name ?? '')}.` : '';
  const left = alt ? rest.slice(1) : rest;
  return { from: 'bot', text: text + tail, sections, product: id, ...(alt ? { altProduct: alt } : {}), links: path ? [{ label: 'Подробнее', href: path }] : undefined, warning: true, alts: left, chips: [...(left.length ? [anotherOption] : []), ...(chips ?? [])] } as Message;
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
    const score = overlap(q, `${t.h1} ${name}`) * 4 + overlap(q, t.lead) * 2 + Math.max(0, ...t.faq.map(f => overlap(q, f.q))) * 2 + overlap(q, t.sections.map(s => s.h).join(' ')) + (productHit && t.product === productHit.p.id ? 6 : 0) + (aliases.some(([re, id]) => re.test(text) && id === t.product) ? 8 : 0) + (index.products.find(p => p.id === t.product)?.available ? 1 : 0);
    return { t, score };
  }).filter(x => x.score >= 3).sort((a, b) => b.score - a.score);
  if (!scored.length) return { from: 'bot', text: 'Пока не могу ответить на этот вопрос. Опишите подробнее, что хочется поддержать, или задайте вопрос консультанту.', links: consultantLinks };
  const best = scored[0].t;
  const faq = best.faq.map(f => ({ f, n: overlap(q, f.q) })).sort((a, b) => b.n - a.n)[0];
  const body = faq && faq.n >= 3 ? faq.f.a : best.lead;
  const caution = risky.test(text) ? ' Ваш случай лучше обсудить с врачом: я не ставлю диагнозы и не подбираю лечение. Могу помочь связаться со специалистом.' : '';
  const more = [...scored.slice(1, 3).map(x => x.t.h1), ...(risky.test(text) ? ['Связаться со специалистом'] : [])];
  // Alternatives: first the products the lecture topics pair with the best one (same theme page), then the next matches.
  const paired = siblings[best.product] ?? [];
  const alts = [...paired, ...scored.slice(1).map(x => x.t.product)].filter((id, i, all) => id !== best.product && all.indexOf(id) === i && index.products.find(p => p.id === id)?.available).slice(0, 5);
  return { from: 'bot', text: body + caution, product: best.product, links: [{ label: 'Подробнее', href: best.path }], chips: [...(alts.length ? [anotherOption] : []), ...more], alts };
}

const fromChat = (href: string) => (href.startsWith('/') ? `${href}${href.includes('?') ? '&' : '?'}from=chat` : href);

function ProductMini({ id, index }: { id: string; index: Index }) {
  const { state, add } = useStore();
  const p = index.products.find(x => x.id === id); const full = data.products.find(x => x.id === id);
  if (!p || !full) return null;
  const price = state.card && p.partner ? p.partner : p.price;
  return <div className="chat-product"><img src={full.image || undefined} alt="" width="56" height="56" /><a href={fromChat(p.path)}>{shortName(p.name)}<span>{money(price)}{state.card && p.partner ? ' по карте' : ''}</span></a>{p.available ? <button type="button" className="btn card-cart-button" onClick={() => add(full)}>В корзину</button> : <WaitlistButton product={full} />}</div>;
}

export function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [draft, setDraft] = useState('');
  const [index, setIndex] = useState<Index | null>(null);
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  // «↓» appears when the visitor has scrolled up more than a screen's worth from the latest messages.
  const [away, setAway] = useState(false);
  const onScroll = () => { const el = log.current; if (el) setAway(el.scrollHeight - el.scrollTop - el.clientHeight > 240); };
  const toBottom = () => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' }); };
  // Phone keyboard: how much of the screen it covers (visualViewport), so the input row can ride above it; the log stays
  // scrolled to the latest messages. The bottom bar is never hidden.
  useEffect(() => {
    const vv = window.visualViewport;
    const fit = () => { const covered = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0; document.documentElement.style.setProperty('--chat-kb', `${Math.round(covered)}px`); if (log.current) log.current.scrollTop = log.current.scrollHeight; };
    fit(); vv?.addEventListener('resize', fit); vv?.addEventListener('scroll', fit);
    return () => { vv?.removeEventListener('resize', fit); vv?.removeEventListener('scroll', fit); document.documentElement.style.removeProperty('--chat-kb'); };
  }, [focused]);
  useEffect(() => { try { const saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null'); if (Array.isArray(saved) && saved.length) setMessages(saved); } catch { /* new chat */ } import('./generated/chat-index.json').then(m => setIndex((m.default ?? m) as Index)); }, []);
  useEffect(() => { try { sessionStorage.setItem(storeKey, JSON.stringify(messages.slice(-60))); } catch { /* ignore */ } const toEnd = () => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }; toEnd(); const t = window.setTimeout(toEnd, 250); return () => clearTimeout(t); }, [messages, typing, index]);
  // A health question first gets a clarifying question (what else bothers you); the recommendation comes after the reply,
  // built from both messages, with the BAD warning. Shop questions (delivery, discount, consultant) are answered at once.
  const send = (text: string) => {
    const value = text.trim(); if (!value) return;
    // «Начать новый чат» (or «новый чат», «начать сначала», «заново») clears the conversation back to the greeting.
    if (/^(начать\s+)?(нов(ый|ую)\s+(чат|переписк\S*|разговор)|сначала|заново|начать\s+сначала|начать\s+заново)[.!]?$/iu.test(value)) { setMessages([greeting]); setDraft(''); return; }
    const asked = [...messages].reverse().find(m => m.from === 'bot')?.ask;
    setMessages(m => [...m, { from: 'user', text: value }]); setDraft(''); setTyping(true);
    window.setTimeout(() => {
      let reply: Message;
      if (!index) reply = { from: 'bot', text: 'Секунду, готовлюсь… Повторите вопрос, пожалуйста.' };
      else if (value === anotherOption) { const lastBot = [...messages].reverse().find(m => m.from === 'bot'); const rest = lastBot?.alts ?? []; reply = rest.length ? adviceFor(rest[0], '', rest.slice(1), index) : { from: 'bot', text: 'К сожалению, больше ничего предложить не могу. Спросите что-то ещё.' }; }
      else if (asked) reply = recommend(/^больше ничего/i.test(value) ? asked : `${asked} ${value}`, index);
      else { const first = answer(value, index); reply = !first.product ? first : asksAboutProduct(value, index) ? { ...first, text: `Расскажу про ${shortName(index.products.find(p => p.id === first.product)?.name ?? '')}.`, sections: productSections(index.products.find(p => p.id === first.product), index.themes.find(t => t.product === first.product), first.text), warning: true } : clarify(value); }
      setMessages(m => [...m, reply]); setTyping(false);
    }, 600);
  };
  const submit = (e: FormEvent) => { e.preventDefault(); send(draft); };
  const last = messages[messages.length - 1];
  return <div className="chat" data-ds-id="assistant-chat">
    <div className="chat-log" role="log" aria-live="polite" ref={log} onScroll={onScroll}>
      {messages.map((m, i) => <div className={`chat-msg chat-msg--${m.from}`} key={i}>
        <p>{m.text}</p>
        {m.sections && <dl className="chat-sections">{m.sections.map(x => <div key={x.title}><dt>{x.title}</dt><dd>{x.text}</dd></div>)}</dl>}
        {m.product && index && <ProductMini id={m.product} index={index} />}
        {m.altProduct && index && <ProductMini id={m.altProduct} index={index} />}
        {m.warning && <p className="chat-warning">БАД не является лекарственным средством. Перед применением проконсультируйтесь со специалистом.</p>}
        {m.links && <div className="chat-links">{m.links.map(l => <a key={l.href} href={fromChat(l.href)} target={l.href.startsWith('http') ? '_blank' : undefined} rel={l.href.startsWith('http') ? 'noopener' : undefined}>{l.label}</a>)}</div>}
      </div>)}
      {typing && <div className="chat-msg chat-msg--bot chat-typing" aria-label="Помощник печатает"><i /><i /><i /></div>}
      {!typing && last?.from === 'bot' && last.chips && <div className="chat-suggest" aria-label="Подсказки">{last.chips.map(c => <button type="button" key={c} onClick={() => send(c)}>{c}</button>)}</div>}
      <div ref={end} />
    </div>
    {away && <button type="button" className="chat-down" onClick={toBottom} aria-label="К последним сообщениям"><Icon name="chevron" size={22} /></button>}
    <form className="chat-input" onSubmit={submit}><input value={draft} onChange={e => setDraft(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholder="Напишите ваш вопрос" aria-label="Ваш вопрос" maxLength={500} enterKeyHint="send" autoComplete="off" /><button type="submit" className="chat-send" disabled={!draft.trim()} aria-label="Отправить"><Icon name="arrow" size={20} /></button></form>
  </div>;
}
