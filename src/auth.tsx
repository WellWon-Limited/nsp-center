import './auth.css';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { partnerSignupUrl, useStore, type Account } from './store';
import { Icon } from './ui';

// Sign-in and registration screens of the profile. There is no account server yet
// (docs/PASSPORT.md: authorization is not connected), so this is a demo account kept in
// this browser: registration stores it and signs in, sign-in checks it. The password is
// kept only as a salted SHA-256 hash; nothing leaves the browser. Yandex ID, VK ID and
// password recovery need the server and only explain that.

const digits = (value: string) => value.replace(/\D/g, '');
async function hashPassword(email: string, password: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`nsp-center:${email.trim().toLowerCase()}:${password}`));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const matchesLogin = (account: Account, login: string) => login.includes('@') ? account.email.toLowerCase() === login.trim().toLowerCase() : Boolean(digits(login)) && digits(account.phone).slice(-10) === digits(login).slice(-10);

// Trial account for looking around the profile until the account server exists: signing in with it puts a ready demo
// account (with a discount card) into this browser in place of any local one.
const DEMO_LOGIN = 'demo@nsp-center.ru';
const DEMO_PASSWORD = 'demo2026';
const demoAccount = async (): Promise<Account> => ({ firstName: 'Анна', lastName: 'Демо', email: DEMO_LOGIN, phone: '', partnerId: '7204118', passwordHash: await hashPassword(DEMO_LOGIN, DEMO_PASSWORD), createdAt: '2026-11-05' });

type Mode = 'signin' | 'register';

function ProviderButtons({ onPick }: { onPick: () => void }) {
  return <div className="auth-providers">
    <button type="button" className="auth-provider" onClick={onPick}><span className="auth-provider-mark auth-provider-mark--yandex" aria-hidden="true">Я</span>Яндекс ID</button>
    <button type="button" className="auth-provider" onClick={onPick}><span className="auth-provider-mark auth-provider-mark--vk" aria-hidden="true">VK</span>VK ID</button>
  </div>;
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return <div className="auth-field">
    <label htmlFor={id}>{label}{required && <span className="auth-required" aria-hidden="true"> *</span>}</label>
    {children(id)}
    {hint && <p className="auth-hint">{hint}</p>}
  </div>;
}

function PasswordInput({ id, autoComplete, value, onChange }: { id: string; autoComplete: string; value: string; onChange: (value: string) => void }) {
  const [shown, setShown] = useState(false);
  return <div className="auth-password">
    <input id={id} className="field" type={shown ? 'text' : 'password'} autoComplete={autoComplete} placeholder="Введите пароль" value={value} onChange={e => onChange(e.target.value)} required minLength={8} />
    <button type="button" className="auth-eye" aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={shown} onClick={() => setShown(v => !v)}><Icon name={shown ? 'eye-off' : 'eye'} size={20} /></button>
  </div>;
}

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const { state, setState } = useStore();
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', partnerId: '', consent: false });
  const switchTo = (next: Mode) => { setMode(next); setNotice(false); setError(''); setPassword(''); };
  const signIn = async (e: FormEvent) => {
    e.preventDefault(); setNotice(false);
    if (login.trim().toLowerCase() === DEMO_LOGIN && password === DEMO_PASSWORD) {
      const demo = await demoAccount();
      setPassword(''); setError('');
      setState(s => ({ ...s, account: demo, signedIn: true, name: demo.firstName, card: true }));
      return;
    }
    const account = state.account;
    if (!account || !matchesLogin(account, login) || await hashPassword(account.email, password) !== account.passwordHash) { setError('Неверный телефон, email или пароль. Пока аккаунт хранится только в этом браузере: если вы регистрировались на другом устройстве, войти здесь не получится.'); return; }
    setPassword(''); setError('');
    setState(s => ({ ...s, signedIn: true, card: account.partnerId ? true : s.card }));
  };
  const register = async (e: FormEvent) => {
    e.preventDefault(); setNotice(false); setError('');
    const account: Account = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim(), partnerId: digits(form.partnerId), passwordHash: await hashPassword(form.email, password), createdAt: new Date().toISOString().slice(0, 10) };
    setPassword('');
    setState(s => ({ ...s, account, signedIn: true, name: account.firstName, card: account.partnerId ? true : s.card }));
  };
  const set = (key: keyof typeof form) => (value: string | boolean) => setForm(f => ({ ...f, [key]: value }));

  return <section className="auth" data-ds-id="profile-auth">
    {mode === 'signin' ? <>
      <h1>Вход</h1>
      <p className="auth-switch">Нет аккаунта? <button type="button" className="auth-link" onClick={() => switchTo('register')}>Создать аккаунт</button></p>
      <form className="auth-form" onSubmit={signIn}>
        <Field label="Телефон или email">{id => <input id={id} className="field" autoComplete="username" placeholder="+7 900 000-00-00 или mail@example.ru" value={login} onChange={e => setLogin(e.target.value)} required />}</Field>
        <Field label="Пароль">{id => <PasswordInput id={id} autoComplete="current-password" value={password} onChange={setPassword} />}</Field>
        <button className="btn btn--primary auth-submit" disabled={!login.trim() || password.length < 8}>Войти</button>
        <button type="button" className="auth-link auth-forgot" onClick={() => setNotice(true)}>Забыли пароль?</button>
      </form>
      <div className="auth-divider"><span>или</span></div>
      <ProviderButtons onPick={() => setNotice(true)} />
    </> : <>
      <h1>Создать аккаунт</h1>
      <ProviderButtons onPick={() => setNotice(true)} />
      <div className="auth-divider"><span>или</span></div>
      <h2 className="auth-subtitle">Регистрация по email</h2>
      <p className="auth-switch auth-switch--left">Уже есть аккаунт? <button type="button" className="auth-link" onClick={() => switchTo('signin')}>Войти</button></p>
      <form className="auth-form" onSubmit={register}>
        <div className="auth-row">
          <Field label="Имя" required>{id => <input id={id} className="field" autoComplete="given-name" placeholder="Введите имя" value={form.firstName} onChange={e => set('firstName')(e.target.value)} required />}</Field>
          <Field label="Фамилия" required>{id => <input id={id} className="field" autoComplete="family-name" placeholder="Введите фамилию" value={form.lastName} onChange={e => set('lastName')(e.target.value)} required />}</Field>
        </div>
        <Field label="Email" required>{id => <input id={id} className="field" type="email" autoComplete="email" placeholder="mail@example.ru" value={form.email} onChange={e => set('email')(e.target.value)} required />}</Field>
        <Field label="Телефон">{id => <input id={id} className="field" type="tel" autoComplete="tel" placeholder="+7 900 000-00-00" value={form.phone} onChange={e => set('phone')(e.target.value)} />}</Field>
        <Field label="Пароль" required hint="Не меньше 8 символов.">{id => <PasswordInput id={id} autoComplete="new-password" value={password} onChange={setPassword} />}</Field>
        <Field label="Номер дисконтной карты (ID партнёра NSP)" hint="Если есть, тогда в корзине будут цены по карте.">{id => <input id={id} className="field" inputMode="numeric" placeholder="Например, 446621" value={form.partnerId} onChange={e => set('partnerId')(e.target.value)} />}</Field>
        <p className="auth-hint">Нет карты? <a href={partnerSignupUrl} target="_blank" rel="noopener">Оформить дисконтную карту ↗</a></p>
        <label className="auth-consent"><input type="checkbox" checked={form.consent} onChange={e => set('consent')(e.target.checked)} required /> <span>Я согласен(на) на обработку персональных данных согласно <a href="/company/consent/">политике конфиденциальности</a></span></label>
        <button className="btn btn--primary auth-submit" disabled={!form.consent || password.length < 8}>Создать аккаунт</button>
      </form>
    </>}
    {error && <div className="auth-notice auth-notice--error" role="alert"><Icon name="close" size={20} /><p>{error}</p></div>}
    {notice && <div className="auth-notice" role="status"><Icon name="clock" size={20} /><p><strong>Скоро заработает.</strong> Вход через Яндекс ID и VK ID и восстановление пароля появятся, когда подключим сервер аккаунтов.</p></div>}
    <a className="auth-guest" href="/">Продолжить без входа <Icon name="arrow" size={16} /></a>
  </section>;
}
