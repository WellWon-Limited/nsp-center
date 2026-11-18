import './loyalty-card.css';

type Props = {
  partnerId?: string;
  points?: number;
  status?: 'pending' | 'processing' | 'approved' | 'rejected';
  attach?: boolean;
};
export function LoyaltyCard({partnerId = '', points, status, attach}: Props) {
  const active = Boolean(partnerId);
  const title = active ? partnerId.replace(/\B(?=(\d{3})+$)/g, ' ')
    : status === 'pending' ? (attach ? 'Номер на проверке' : 'Заявка отправлена')
    : status === 'processing' ? 'Оформляем карту'
    : status === 'rejected' ? 'Уточните данные' : 'Ваша карта NSP';
  return <div className="discount-card-scale"><section className={`discount-card loyalty-card${active ? '' : ' loyalty-card--pending'}`} data-ds-id="account-card">
    <div className="loyalty-top"><span className="brand loyalty-brand">NSP<span className="brand-light"> Center</span></span><span className="loyalty-kind">Дисконтная карта</span></div>
    <div className="loyalty-middle"><span className="loyalty-label">{active ? 'Номер карты' : 'Номер после подтверждения'}</span><strong className={`loyalty-number${partnerId.length > 9 ? ' loyalty-number--long' : ''}`}>{title}</strong></div>
    <div className="loyalty-bottom"><div className="loyalty-points"><strong>{active && Number.isFinite(points) ? points!.toLocaleString('ru-RU') : '—'}</strong><span>баллов</span></div>
      <div className="loyalty-benefit"><span>{active ? 'Скидка' : 'Статус'}</span><strong>{active ? 'до 30%' : status === 'pending' || status === 'processing' ? 'На рассмотрении' : status === 'rejected' ? 'Нужно уточнение' : 'Не оформлена'}</strong></div>
    </div>
  </section></div>;
}
