import './theme-page.css';
import type { Product } from './content-types';
import { data, money, useStore } from './store';
import type { Theme, ThemePair } from './themes';
import { BackLink, Icon, ProductCard, ProductGrid } from './ui';

const productById = (id: string) => data.products.find(p => p.id === id);

const pairsOf = (t: Theme) => t.pairs.map(pair => ({ ...pair, product: productById(pair.productId) })).filter((pair): pair is ThemePair & { product: Product } => Boolean(pair.product));

/** Product page block: the catalog cards of what is taken together with this product; the reasons live on the
    theme page behind «Подробнее». */
export function ProductThemes({ themes: list }: { themes: Theme[] }) {
  return <>{list.map(t => <section className="product-theme--cards" key={t.slug} data-ds-id="product-theme">
    <h2>С чем сочетают?</h2>
    <a className="product-theme-more" href={t.path}>Подробнее <Icon name="arrow" size={16} /></a>
    <ProductGrid products={pairsOf(t).map(pair => pair.product)} />
  </section>)}</>;
}

export function ThemePage({ theme: t }: { theme: Theme }) {
  const { state, add, notify } = useStore();
  const main = productById(t.mainProductId);
  const pairs = pairsOf(t);
  const set = [...(main ? [main] : []), ...pairs.map(pair => pair.product)];
  const available = set.filter(p => p.availability !== 'OutOfStock');
  const retail = available.reduce((sum, p) => sum + p.prices.retail, 0);
  const partner = available.reduce((sum, p) => sum + (p.prices.partner ?? p.prices.retail), 0);
  const addAll = () => { available.forEach(p => add(p)); notify(`В корзине: ${available.length} продукта из подборки`); };
  return <>
    <BackLink fallback={main?.path || '/catalog/'} />
    <article className="theme-page" data-ds-id="theme-page">
      <header className="theme-hero">
        <h1>{t.h1}</h1>
        <p className="theme-lead">{t.lead}</p>
      </header>

      {main && <section className="theme-cards-section theme-cards-section--main" aria-label="Главный продукт">
        <div className="theme-cards theme-cards--main"><ProductCard product={main} /></div>
      </section>}

      {pairs.length > 0 && <section className="theme-cards-section" aria-labelledby="theme-pairs-title">
        <h2 id="theme-pairs-title">Что принимают вместе?</h2>
        <div className="theme-cards">{pairs.map(pair => <div className="theme-card-with-note" key={pair.productId}><ProductCard product={pair.product} /><p><strong>Зачем?</strong>{pair.why}</p></div>)}</div>
        {available.length > 1 && <div className="theme-bundle">
          <div><strong>Вся подборка: {available.length} продукта</strong><span>{state.card && partner < retail ? `${money(partner)} по карте` : money(retail)}</span></div>
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

      {t.sources.length > 0 && <details className="theme-sources theme-sources--collapsible">
        <summary><h2>Источники</h2><Icon name="chevron" size={18} /></summary>
        <ul>{t.sources.map(source => <li key={source.course + source.lecture}>{source.course} — «{source.lecture}»{source.speaker ? `, ${source.speaker}` : ''}</li>)}</ul>
      </details>}

      <p className="fine-print">БАД не является лекарственным средством. Перед применением проконсультируйтесь со специалистом.</p>
    </article>
  </>;
}
