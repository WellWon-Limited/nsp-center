import { useEffect, useState } from 'react';
import type { Product } from './content-types';
import { data, today, useStore } from './store';
import { themes } from './themes';
import { Heading, Icon, ProductCard } from './ui';

// «Тест-рекомендации» (/diagnostic-test/): eight questions about how the visitor feels, then what can be taken and why,
// for their answers. Each area lists products the doctors' lectures name for it; the product reasons retell our theme
// pages (written from the lecture base, src/theme-data) in support wording. Not a diagnosis; the answers stay in this tab.

type Area = 'women' | 'energy' | 'stress' | 'digestion' | 'bowel' | 'immunity' | 'beauty' | 'joints' | 'weight' | 'heart' | 'eyes' | 'nutrition' | 'men';
type Option = { label: string; areas?: Partial<Record<Area, number>>; note?: string };
type Question = { q: string; multi?: boolean; options: Option[] };

export const questions: Question[] = [
  { q: 'Для кого подбираем?', options: [{ label: 'Для женщины до 40 лет' }, { label: 'Для женщины после 40 лет', areas: { women: 2 }, note: 'вы женщина старше 40 лет' }, { label: 'Для мужчины до 40 лет' }, { label: 'Для мужчины после 40 лет', areas: { men: 2 }, note: 'вы мужчина старше 40 лет' }] },
  { q: 'Как вы себя чувствуете в течение дня?', options: [{ label: 'Бодро весь день' }, { label: 'К вечеру сильно устаю', areas: { energy: 2 }, note: 'к вечеру вы сильно устаёте' }, { label: 'Усталость уже с утра', areas: { energy: 3, nutrition: 1 }, note: 'усталость у вас уже с утра' }] },
  { q: 'Как вы спите?', options: [{ label: 'Хорошо, высыпаюсь' }, { label: 'Долго не могу уснуть', areas: { stress: 2 }, note: 'вам трудно уснуть' }, { label: 'Просыпаюсь ночью, не высыпаюсь', areas: { stress: 2, energy: 1 }, note: 'вы просыпаетесь ночью и не высыпаетесь' }] },
  { q: 'Как часто вы чувствуете напряжение или раздражение?', options: [{ label: 'Редко' }, { label: 'Бывает в напряжённые периоды', areas: { stress: 1 }, note: 'у вас бывают напряжённые периоды' }, { label: 'Почти каждый день', areas: { stress: 3 }, note: 'напряжение у вас почти каждый день' }] },
  { q: 'Как работает пищеварение?', options: [{ label: 'Без неудобств' }, { label: 'После еды бывает тяжесть или вздутие', areas: { digestion: 3 }, note: 'после еды у вас бывает тяжесть' }, { label: 'Стул нерегулярный', areas: { bowel: 3 }, note: 'стул у вас нерегулярный' }] },
  { q: 'Как часто вы простужаетесь?', options: [{ label: 'Редко' }, { label: 'Пару раз в год', areas: { immunity: 1 }, note: 'вы простужаетесь пару раз в год' }, { label: 'Часто, особенно осенью и зимой', areas: { immunity: 3 }, note: 'вы часто простужаетесь осенью и зимой' }] },
  { q: 'Как вы питаетесь?', options: [{ label: 'Разнообразно, много овощей' }, { label: 'Часто на ходу, перекусами', areas: { nutrition: 2 }, note: 'вы часто едите на ходу' }, { label: 'Хочется есть меньше сладкого и мучного', areas: { weight: 3 }, note: 'вам хочется есть меньше сладкого' }] },
  { q: 'Что ещё хочется поддержать?', multi: true, options: [{ label: 'Кожу, волосы и ногти', areas: { beauty: 3 }, note: 'вы хотите поддержать кожу, волосы и ногти' }, { label: 'Суставы и связки', areas: { joints: 3 }, note: 'вы хотите поддержать суставы' }, { label: 'Сердце и сосуды', areas: { heart: 3 }, note: 'вы хотите поддержать сердце и сосуды' }, { label: 'Зрение', areas: { eyes: 3 }, note: 'вам важно зрение' }, { label: 'Вес', areas: { weight: 2 }, note: 'вы следите за весом' }, { label: 'Ничего из этого' }] },
];

const areas: Record<Area, { title: string; products: [string, string][] }> = {
  energy: { title: 'Энергия и бодрость', products: [['khlorofill-zhidkiy-chlorophyll-liquid', 'Помогает крови переносить кислород и участвует в выведении водорастворимых токсинов; его пьют в течение дня.'], ['bee-pollen', 'Мягкий адаптоген: помогает организму легче переносить нагрузки и стресс.']] },
  stress: { title: 'Сон и спокойствие', products: [['magnesium-complex', 'Поддерживает нервную систему при стрессе и помогает мышцам расслабляться.'], ['lecithin', 'Фосфолипиды и холин — базовая поддержка мозга и нервной системы.']] },
  digestion: { title: 'Лёгкость после еды', products: [['food-enzymes', 'Помогают расщеплять белки, жиры и углеводы из еды, когда своих ферментов не хватает.'], ['aloe-vera-juice', 'Поддерживает пищеварение и слизистую желудка и кишечника.']] },
  bowel: { title: 'Работа кишечника', products: [['bifidophilus-flora-force', 'Пробиотик: поддерживает полезную микрофлору кишечника.'], ['nature-lax', 'Растительный комплекс, который помогает кишечнику опорожняться регулярно.']] },
  immunity: { title: 'Защита в сезон простуд', products: [['vitamin-c-long', 'Участвует в работе иммунной системы; организм не вырабатывает и не запасает его надолго.'], ['zinc-lozenge', 'Цинк поддерживает иммунитет и защитные барьеры слизистой рта и горла.'], ['vitamin-d3', 'Поддерживает кости, мышцы и иммунитет; в северных широтах его не хватает многим.']] },
  beauty: { title: 'Кожа, волосы и ногти', products: [['hsn-w', 'Растительный комплекс с хвощом и красной водорослью для волос, кожи и ногтей.'], ['omega-3-epa', 'Незаменимые жирные кислоты, которые входят в оболочки клеток кожи.']] },
  joints: { title: 'Суставы и связки', products: [['glucosamine', 'Строительный материал хряща и синовиальной жидкости.'], ['msm', 'Органическая сера, нужная для коллагена, хрящей и связок.']] },
  weight: { title: 'Аппетит и вес', products: [['garcinia-combination', 'Помогает сдерживать аппетит и тягу к сладкому.'], ['carbo-grabbers', 'Помогает контролировать углеводы из еды — его принимают во время еды.'], ['l-carnitine', 'Переносит жирные кислоты в митохондрии, где из них образуется энергия.']] },
  heart: { title: 'Сердце и сосуды', products: [['omega-3-epa', 'Незаменимые жирные кислоты, которые организм получает только с едой.'], ['hawthorn-plus', 'Поддерживает кровоснабжение сердечной мышцы и микроциркуляцию.']] },
  eyes: { title: 'Зрение', products: [['perfect-eyes', 'Лютеин, черника и витамины для тканей глаза.']] },
  nutrition: { title: 'Витамины и минералы', products: [['super-complex', 'Восполняет витамины и минералы, которых не хватает в рационе.'], ['alfalfa', 'Растительный белок, витамины и минералы — питательная поддержка обмена веществ.']] },
  women: { title: 'Женское здоровье', products: [['fc-with-dong-quai', 'Мягкий источник фитоэстрогенов: поддерживает самочувствие, когда начинаются первые изменения перед менопаузой.']] },
  men: { title: 'Мужское здоровье', products: [['saw-palmetto', 'Его чаще всего выбирают мужчины после 40 лет для поддержки мужского здоровья.']] },
};
const basic: Area[] = ['nutrition', 'immunity'];

const productById = (id: string) => data.products.find(p => p.id === id);
const themeFor = (id: string) => themes.find(t => t.mainProductId === id);

type Result = { area: Area; why: string[]; items: { product: Product; reason: string }[] };
export function results(answers: number[][]): Result[] {
  const score = new Map<Area, number>(); const why = new Map<Area, string[]>();
  answers.forEach((picked, qi) => picked.forEach(oi => { const o = questions[qi].options[oi]; for (const [a, w] of Object.entries(o.areas ?? {}) as [Area, number][]) { score.set(a, (score.get(a) ?? 0) + w); if (o.note) why.set(a, [...(why.get(a) ?? []), o.note]); } }));
  const ranked = [...score].sort((a, b) => b[1] - a[1]).map(([a]) => a).slice(0, 4);
  const seen = new Set<string>();
  return (ranked.length ? ranked : basic).map(area => ({ area, why: why.get(area) ?? [], items: areas[area].products.flatMap(([id, reason]) => { const product = productById(id); if (!product || seen.has(id)) return []; seen.add(id); return [{ product, reason }]; }) })).filter(r => r.items.length);
}

// Answers are kept in this tab (sessionStorage), so «Назад» from a product or theme page returns to the same result.
const answersKey = 'nsp-center:recommend';
const savedAnswers = (): number[][] => { try { const v = JSON.parse(sessionStorage.getItem(answersKey) || '[]'); return Array.isArray(v) && v.length <= questions.length && v.every(a => Array.isArray(a) && a.every(Number.isInteger)) ? v : []; } catch { return []; } };

export function RecommendTest() {
  const { setState, notify } = useStore();
  const [answers, setAnswersState] = useState<number[][]>([]);
  useEffect(() => { setAnswersState(savedAnswers()); }, []);
  const setAnswers = (next: number[][] | ((a: number[][]) => number[][])) => setAnswersState(prev => { const value = typeof next === 'function' ? next(prev) : next; try { sessionStorage.setItem(answersKey, JSON.stringify(value)); } catch { /* ignore */ } return value; });
  const [multi, setMulti] = useState<number[]>([]);
  const step = answers.length; const done = step === questions.length;
  const answer = (picked: number[]) => { setAnswers(a => [...a, picked]); setMulti([]); window.scrollTo({ top: 0 }); };
  const restart = () => { setAnswers([]); setMulti([]); window.scrollTo({ top: 0 }); };
  // Opened from the plan or the marathon tab (?from=…): the back link returns there.
  const [from, setFrom] = useState<'plan' | 'marathon' | ''>('');
  useEffect(() => { const f = new URLSearchParams(location.search).get('from'); if (f === 'plan' || f === 'marathon') setFrom(f); }, []);
  const back = from ? <a className="back-link" href={from === 'marathon' ? '/health/#marathon' : '/health/'} onClick={e => { let fromSite = false; try { fromSite = new URL(document.referrer).pathname === '/health/'; } catch { /* no referrer */ } if (fromSite && history.length > 1) { e.preventDefault(); history.back(); } }}><Icon name="chevron" size={18} />{from === 'marathon' ? 'Назад к марафону' : 'Назад к плану'}</a> : null;
  if (done) {
    const list = results(answers);
    return <div className="recommend" data-ds-id="recommend-result">
      {back}
      <Heading title="Ваши рекомендации" description="Подобрали по вашим ответам и материалам лекций врачей-нутрициологов." />
      {list.map(r => <section className="recommend-area" key={r.area}>
        <h2>{areas[r.area].title}</h2>
        {r.why.length > 0 && <p className="recommend-why"><strong>Почему вам:</strong> {r.why.join(', ')}.</p>}
        <div className="theme-cards">{r.items.map(({ product, reason }) => { const theme = themeFor(product.id); return <div className="theme-card-with-note" key={product.id}><ProductCard product={product} /><p><strong>Зачем?</strong>{reason}{theme && <> <a href={theme.path}>Подробнее</a></>}</p></div>; })}</div>
      </section>)}
      <div className="recommend-actions"><button type="button" className="btn waitlist-button" onClick={restart}>Пройти ещё раз</button></div>
      <p className="fine-print">Тест не ставит диагноз и не заменяет врача. Схему приёма согласуйте со специалистом. БАД не является лекарственным средством.</p>
    </div>;
  }
  const q = questions[step];
  return <div className="recommend" data-ds-id="recommend-test">
    {back}
    <Heading title="Тест-рекомендации" description="Несколько вопросов о самочувствии — и подборка того, что можно попить, с объяснением, зачем это именно вам." />
    <section className="panel questionnaire recommend-question">
      <div className="section-heading"><span className="ds-kicker">Вопрос {step + 1} из {questions.length}</span><span className="ds-muted">{Math.round(step / questions.length * 100)}%</span></div>
      <div className="progress"><div style={{ width: `${step / questions.length * 100}%` }} /></div>
      <h2>{q.q}</h2>
      {q.multi && <p className="ds-muted">Можно выбрать несколько.</p>}
      <div className="answer-list">{q.options.map((o, i) => q.multi
        ? <button type="button" className={`panel panel--interactive ${multi.includes(i) ? 'is-selected' : ''}`} aria-pressed={multi.includes(i)} key={o.label} onClick={() => setMulti(m => o.areas ? (m.includes(i) ? m.filter(x => x !== i) : [...m.filter(x => questions[step].options[x].areas), i]) : [i])}>{o.label}{multi.includes(i) && <Icon name="check" size={18} />}</button>
        : <button type="button" className="panel panel--interactive" key={o.label} onClick={() => answer([i])}>{o.label}<Icon name="chevron" size={18} /></button>)}</div>
      {q.multi && <button type="button" className="btn card-cart-button recommend-next" disabled={!multi.length} onClick={() => answer(multi)}>Показать рекомендации</button>}
      {step > 0 && <button type="button" className="text-button back-action" onClick={() => { setAnswers(a => a.slice(0, -1)); setMulti([]); }}><Icon name="chevron" size={18}/>Назад</button>}
    </section>
  </div>;
}
