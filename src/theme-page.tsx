import './theme-page.css';
import type { Product } from './content-types';
import { data, money, shortName, useStore } from './store';
import { themesForProduct, type Theme, type ThemePair } from './themes';
import { Breadcrumbs, CardPrice, Icon } from './ui';

const productById = (id: string) => data.products.find(p => p.id === id);
const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
// Formatted by hand, not with Date: SSR and the browser must render the same text.
const russianDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${months[m - 1]} ${y}`; };

function AddButton({ product: p }: { product: Product }) {
  const { add } = useStore();
  const available = p.availability !== 'OutOfStock';
  return <button className={`icon-btn ${available ? 'icon-btn--action' : ''}`} disabled={!available} onClick={() => add(p)} aria-label={`В корзину: ${shortName(p.name)}`}><Icon name="plus" /></button>;
}

function PairCard({ product: p, why }: { product: Product; why: string }) {
  return <article className="panel theme-pair">
    <a className="theme-pair-image" href={p.path} tabIndex={-1} aria-hidden="true"><img src={p.image || undefined} alt={p.name} width="120" height="120" loading="lazy" /></a>
    <div>
      <h3><a href={p.path}>{shortName(p.name)}</a></h3>
      <p>{why}</p>
      <div className="theme-pair-buy"><CardPrice product={p} /><AddButton product={p} /></div>
    </div>
  </article>;
}

const pairsOf = (t: Theme) => t.pairs.map(pair => ({ ...pair, product: productById(pair.productId) })).filter((pair): pair is ThemePair & { product: Product } => Boolean(pair.product));

/** Product page block: what is taken together with this product, and a link to its theme page. */
export function ProductThemes({ product }: { product: Product }) {
  const list = themesForProduct(product.id);
  if (!list.length) return null;
  return <>{list.map(t => <section className="panel product-theme" key={t.slug} data-ds-id="product-theme">
    <h2>С чем сочетают</h2>
    <p>Подборка по материалам лекций врачей. <a href={t.path}>{t.h1} — подробно <Icon name="arrow" size={14} /></a></p>
    <div className="theme-pair-grid">{pairsOf(t).map(pair => <PairCard key={pair.productId} product={pair.product} why={pair.why} />)}</div>
  </section>)}</>;
}

export function ThemePage({ theme: t }: { theme: Theme }) {
  const { add, notify } = useStore();
  const main = productById(t.mainProductId);
  const pairs = pairsOf(t);
  const set = [...(main ? [main] : []), ...pairs.map(pair => pair.product)];
  const available = set.filter(p => p.availability !== 'OutOfStock');
  const retail = available.reduce((sum, p) => sum + p.prices.retail, 0);
  const partner = available.reduce((sum, p) => sum + (p.prices.partner ?? p.prices.retail), 0);
  const addAll = () => { available.forEach(p => add(p)); notify(`В корзине: ${available.length} продукта из подборки`); };
  return <>
    <Breadcrumbs items={[{ name: 'Каталог', path: '/catalog/' }, { name: t.h1 }]} />
    <article className="theme-page" data-ds-id="theme-page">
      <header className="theme-hero">
        <span className="ds-kicker">Разбираемся вместе</span>
        <h1>{t.h1}</h1>
        <p className="theme-lead">{t.lead}</p>
        <p className="theme-meta">По материалам лекций врачей · Обновлено {russianDate(t.updated)}{t.reviewedBy ? ` · Проверил(а): ${t.reviewedBy}` : ''}</p>
      </header>

      {main && <section className="theme-main panel" aria-labelledby="theme-main-title">
        <a className="theme-main-image" href={main.path}><img src={main.image || undefined} alt={main.name} width="260" height="260" /></a>
        <div className="theme-main-body">
          <span className="ds-kicker">Главный продукт</span>
          <h2 id="theme-main-title"><a href={main.path}>{shortName(main.name)}</a></h2>
          <p className="ds-muted">Арт. {main.article}</p>
          <div className="theme-main-buy"><CardPrice product={main} /><AddButton product={main} /></div>
          <a className="theme-more" href={main.path}>Состав, применение и документы <Icon name="arrow" size={16} /></a>
        </div>
      </section>}

      {pairs.length > 0 && <section className="theme-pairs" aria-labelledby="theme-pairs-title">
        <h2 id="theme-pairs-title">Что принимают вместе</h2>
        <div className="theme-pair-grid">{pairs.map(pair => <PairCard key={pair.productId} product={pair.product} why={pair.why} />)}</div>
        {available.length > 1 && <div className="theme-bundle">
          <div><strong>Вся подборка: {available.length} продукта</strong><span>{money(retail)}{partner < retail ? ` · ${money(partner)} по карте` : ''}</span></div>
          <button className="btn btn--primary" onClick={addAll}>Добавить всё в корзину <Icon name="bag" size={18} /></button>
        </div>}
      </section>}

      {t.sections.map(section => <section className="theme-section" key={section.heading}>
        <h2>{section.heading}</h2>
        {section.paragraphs.map((text, i) => <p key={i}>{text}</p>)}
      </section>)}

      {t.faq.length > 0 && <section className="theme-faq" aria-labelledby="theme-faq-title">
        <h2 id="theme-faq-title">Частые вопросы</h2>
        {t.faq.map(item => <details className="panel" key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}
      </section>}

      {t.sources.length > 0 && <aside className="theme-sources">
        <h2>Источники</h2>
        <ul>{t.sources.map(source => <li key={source.course + source.lecture}>{source.course} — «{source.lecture}»{source.speaker ? `, ${source.speaker}` : ''}</li>)}</ul>
      </aside>}

      <p className="fine-print">БАД не является лекарственным средством. Перед применением проконсультируйтесь со специалистом.</p>
    </article>
  </>;
}
