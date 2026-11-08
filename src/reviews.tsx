import './reviews.css';
import { useEffect, useState, type FormEvent } from 'react';
import { useStore } from './store';

// Customer reviews of a product (scripts/site-admin.mjs): only signed-in visitors write them, and a review appears
// on the site after the administrator approves it (it waits in «Управление сайтом» → «Отзывы»). Without the accounts server there are no customer reviews.

type Review = { id: number; rating: number; text: string; date: string; author: string };
const dateText = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); };
const Stars = ({ value }: { value: number }) => <span className="review-stars" aria-label={`Оценка ${value} из 5`}>{[1, 2, 3, 4, 5].map(n => <span key={n} aria-hidden="true" className={n <= value ? 'on' : ''}>★</span>)}</span>;

/** Published reviews and the form; `empty`: no expert comments above, so «Отзывов пока нет» shows when there are none. */
export function CustomerReviews({ productId, empty }: { productId: string; empty: boolean }) {
  const { state, accounts } = useStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  useEffect(() => {
    if (accounts !== 'server') return;
    let off = false;
    fetch(`/api/reviews?product=${encodeURIComponent(productId)}`, { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : null).then(b => { if (!off && Array.isArray(b?.reviews)) setReviews(b.reviews); }).catch(() => { /* none shown */ });
    return () => { off = true; };
  }, [accounts, productId]);
  return <>
    {reviews.length > 0 && <div className="customer-reviews" data-ds-id="customer-reviews">{reviews.map(r => <article className="customer-review" key={r.id}>
      <header><strong>{r.author}</strong><Stars value={r.rating} /><small>{dateText(r.date)}</small></header>
      <p>{r.text}</p>
    </article>)}</div>}
    {empty && !reviews.length && <p className="reviews-empty">Отзывов пока нет</p>}
    {accounts === 'server' && (state.signedIn && state.account?.server ? <ReviewForm productId={productId} /> : <p className="review-signin">Чтобы оставить отзыв, <a href="/profile/">войдите в аккаунт</a>.</p>)}
  </>;
}

function ReviewForm({ productId }: { productId: string }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const send = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setStatus('sending');
    try {
      const r = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, rating, text }) });
      if (r.ok) { setStatus('sent'); return; }
      const b = await r.json().catch(() => null);
      setError(b?.error || 'Не удалось отправить отзыв. Попробуйте ещё раз.');
    } catch { setError('Нет связи с сервером. Попробуйте ещё раз.'); }
    setStatus('idle');
  };
  if (status === 'sent') return <div className="review-sent" role="status"><strong>Спасибо! Отзыв на рассмотрении.</strong><span>Он появится на сайте чуть позже, после проверки.</span></div>;
  return <form className="review-form" onSubmit={send} data-ds-id="review-form">
    <h3>Оставить отзыв</h3>
    <div className="review-rate" role="radiogroup" aria-label="Оценка">{[1, 2, 3, 4, 5].map(n => <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} из 5`} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>)}</div>
    <textarea className="field" rows={4} maxLength={2000} placeholder="Что понравилось, как принимали, какой результат" value={text} onChange={e => setText(e.target.value)} />
    {error && <p className="review-error" role="alert">{error}</p>}
    {(!rating || !text.trim()) && <p className="review-hint">{!rating ? 'Поставьте оценку звёздами' : 'Напишите пару слов о товаре'}, и кнопка станет активной.</p>}
    <button className="btn btn--primary" disabled={!rating || !text.trim() || status === 'sending'}>{status === 'sending' ? 'Отправляем…' : 'Отправить отзыв'}</button>
  </form>;
}
