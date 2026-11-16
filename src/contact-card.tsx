import { data } from './store';
import { Icon } from './ui';
import './contact-card.css';

// «Прямой контакт · Начнём с разговора»: the mint card with the phone, the mail and the three useful pages. It stood
// beside the chat on the consultation page; it now sits in the home page's pickup-point block, on its right (owner,
// 2026-11-13), and the chat has the consultation page to itself.
export function ContactCard({ className = '', address = true, heading = 'h2' }: { className?: string; address?: boolean; heading?: 'h2' | 'h3' }) {
  const Heading = heading;
  return <aside className={`contact-card ${className}`.trim()} data-ds-id="contact-card">
    <span className="contact-card-kicker">Прямой контакт</span>
    <Heading>Начнём с разговора</Heading>
    <a className="contact-card-phone" href="tel:+79626854838">{data.site.phones[0]}</a>
    <a className="contact-card-mail" href={`mailto:${data.site.emails[0]}`}>{data.site.emails[0]}</a>
    {address && <p>{data.site.address}</p>}
    <nav aria-label="Полезные страницы">
      <a href="/company/faq/">Частые вопросы <Icon name="chevron" size={16} /></a>
      <a href="/delivery/">Условия доставки <Icon name="chevron" size={16} /></a>
      <a href="/payments/">Способы оплаты <Icon name="chevron" size={16} /></a>
    </nav>
  </aside>;
}
