import './company-variants.css';
import './company-page.css';
import './certificates-page.css';
import { useState } from 'react';
import { Arrow } from './company-content';
import { BackLink, Icon } from './ui';

// «Сертификаты» (/company/sertifikaty/) in the style of the company page: a dark-green hero, what each certificate means in
// one plain sentence, the note on «FDA certificate», and the scans as a gallery (tap a scan to view it full size). The scans
// are the snapshot's own images; the texts retell the snapshot page in plain words.

const certificates = [
  { code: 'GMP', title: 'Надлежащая производственная практика', text: 'Международный стандарт, который проверяет каждый этап производства: чистоту цехов и воздуха, одежду сотрудников, сырьё и маркировку упаковки.' },
  { code: 'NSF', title: 'Независимая проверка продукции', text: 'Некоммерческая организация, не связанная ни с государством, ни с производителями. Она тестирует продукцию и без предупреждения проверяет заводы.' },
  { code: 'TGA', title: 'Стандарт Минздрава Австралии', text: 'Подтверждает, что производство соответствует австралийскому кодексу надлежащей практики — одному из самых строгих в мире.' },
  { code: 'Organic', title: 'Органическое производство', text: 'Производство соответствует требованиям Национальной органической программы США.' },
  { code: 'ISO 9001:2015', title: 'Система управления качеством', text: 'Международный стандарт, по которому выстроена работа компании — от производства до общения с покупателями.' },
];

const scans = [
  { src: '/media/upload/iblock/f80/f806f99422c46ff53baef6dd52f63270.jpg', label: 'GMP' },
  { src: '/media/upload/iblock/0d1/0d1cc8ca852004d0ab3d557838025eb4.jpg', label: 'NSF' },
  { src: '/media/upload/iblock/afb/afb41640b59d19fd306bbe4a021edac0.jpeg', label: 'TGA, на английском' },
  { src: '/media/upload/iblock/d51/d5132a1d5037c44bc8d831ef53aefc20.jpg', label: 'TGA, перевод' },
  { src: '/media/upload/iblock/caa/caa26695f03fb23caf30470112f237bd.jpg', label: 'Organic, на английском' },
  { src: '/media/upload/iblock/7fc/7fc36980b22fb1513f0ad96c3266b6ad.jpg', label: 'Organic, перевод' },
  { src: '/media/upload/iblock/a8c/a8cd5a9483520bd171d8775e6308c77c.jpg', label: 'ISO 9001:2015, на английском' },
  { src: '/media/upload/iblock/eac/eac56da6dd35cdf8dbbda22686c7fd87.jpg', label: 'ISO 9001:2015, перевод' },
];

export function CertificatesPage() {
  const [open, setOpen] = useState<number | null>(null);
  const scan = open === null ? null : scans[open];
  return <div className="company-page company-page--nature certificates-page" data-ds-id="page-certificates">
    <div className="company-concept company-concept--nature">
      <div className="cert-back"><BackLink fallback="/company/" label="О компании" /></div>
      <section className="co-hero cert-hero" data-ds-id="certificates-hero">
        <img className="co-hero-image" src="/images/company-concepts/research-v1.png" alt="Ботанические образцы и лабораторная посуда" />
        <div className="co-hero-copy"><span className="co-kicker">КАЧЕСТВО · СЕРТИФИКАТЫ</span><h1>Качество,<br />подтверждённое проверками.</h1><p>Продукция Nature’s Sunshine производится по международным стандартам и регулярно проходит независимые проверки.</p></div>
      </section>

      <section className="co-principles co-section" data-ds-id="certificates-list">
        <div className="co-section-heading"><span className="co-kicker">ЧТО ОЗНАЧАЕТ КАЖДЫЙ</span><h2>Пять сертификатов.<br />Простыми словами.</h2></div>
        <div className="co-principle-grid">{certificates.map((c, i) => <article key={c.code}><span>{String(i + 1).padStart(2, '0')}</span><h3>{c.code}</h3><strong className="cert-subtitle">{c.title}</strong><p>{c.text}</p></article>)}</div>
      </section>

      <section className="co-section cert-fda" data-ds-id="certificates-fda">
        <span className="co-kicker">ЧАСТЫЙ ВОПРОС</span>
        <h2>А сертификат FDA?</h2>
        <p>Такого сертификата не существует. FDA — американское ведомство, которое не выдаёт сертификаты, а проверяет производителей. Если замечаний нет, производитель получает подтверждающий номер. Nature’s Sunshine проходила все проверки FDA без замечаний.</p>
      </section>

      <section className="co-section cert-gallery-section" data-ds-id="certificates-gallery">
        <div className="co-section-heading"><span className="co-kicker">ДОКУМЕНТЫ</span><h2>Сертификаты целиком</h2><p>Нажмите на документ, чтобы рассмотреть его.</p></div>
        <div className="cert-gallery">{scans.map((s, i) => <button type="button" key={s.src} onClick={() => setOpen(i)}><img src={s.src} alt={`Сертификат ${s.label}`} loading="lazy" /><span>{s.label}</span></button>)}</div>
      </section>

      <section className="co-closing co-section" data-ds-id="certificates-closing"><span className="co-kicker">NSP CENTER · РЯДОМ С ВАМИ</span><h2>Остались вопросы о качестве?</h2><a className="co-text-link" href="/consultation/">Спросить консультанта <Arrow /></a></section>
    </div>
    {scan && <div className="cert-viewer" role="dialog" aria-modal="true" aria-label={`Сертификат ${scan.label}`} onClick={() => setOpen(null)}>
      <button type="button" className="cert-viewer-close" aria-label="Закрыть" onClick={() => setOpen(null)}><Icon name="close" size={22} /></button>
      <img src={scan.src} alt={`Сертификат ${scan.label}`} onClick={e => e.stopPropagation()} />
      <span>{scan.label}</span>
    </div>}
  </div>;
}
