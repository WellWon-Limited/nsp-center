import {Field,PasswordInput} from '../../../packages/presentation/form-fields';
import '../../../packages/presentation/auth.css';
import { useId, useLayoutEffect, useState, type FormEvent, type ReactNode } from 'react';
import { restoreAccountLists, useStore, type Account, type ServerSession } from '../../../packages/presentation/store';
import { Icon } from '../../../packages/presentation/ui';
import { registrationPasswordError } from './auth-password';
import { EmailInput, PhoneInput } from '../../../packages/presentation/contact-inputs';
import { customerEmailError, phoneError } from '../../../packages/presentation/contact-fields.mjs';

// Sign-in and registration screens of the profile. With the accounts server (scripts/accounts.mjs; the store learns of it
// from /api/auth/me) both go to it, and the account with its cart, lists and plan follows the visitor to any device.
// Without it (no database connected) this is a demo account kept in this browser: registration stores it and signs in,
// sign-in checks it; the password is kept only as a salted SHA-256 hash. Password recovery is not connected yet.

const digits = (value: string) => value.replace(/\D/g, '');
async function hashPassword(email: string, password: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`nsp-center:${email.trim().toLowerCase()}:${password}`));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const matchesLogin = (account: Account, login: string) => account.email.toLowerCase() === login.trim().toLowerCase();

// Trial account for looking around the profile until the account server exists: signing in with it puts a ready demo
// account (with a discount card) into this browser in place of any local one.
const DEMO_LOGIN = 'demo@nsp-center.ru';
const DEMO_PASSWORD = 'demo2026';
const demoAccount = async (): Promise<Account> => ({ firstName: 'Анна', lastName: 'Демо', email: DEMO_LOGIN, phone: '', partnerId: '7204118', passwordHash: await hashPassword(DEMO_LOGIN, DEMO_PASSWORD), createdAt: '2026-11-05' });

type Mode = 'signin' | 'register';

/** A request to the accounts server; `error` is a sentence for the visitor. */
async function callAccounts(path: string, body: unknown): Promise<{ session?: ServerSession; error?: string; staff?: boolean }> {
  try {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    const answer = await r.json().catch(() => null);
    return r.ok && answer?.account ? { session: answer } : { error: answer?.error || 'Что-то пошло не так. Попробуйте ещё раз.', staff: answer?.staff === true };
  } catch { return { error: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.' }; }
}





export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  useLayoutEffect(() => { if (mode === 'register') window.scrollTo({top:0,behavior:'instant'}); }, [mode]);
  const { state, setState, accounts, startSession } = useStore();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState('');
  // A staff account typed into the customer sign-in: point to site management's own sign-in, with the email filled in.
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmationTouched, setConfirmationTouched] = useState(false);
  const passwordError = registrationPasswordError(password, confirmPassword);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', partnerId: '', consent: false });
  const switchTo = (next: Mode) => { setMode(next); setNotice(false); setError(''); setPassword(''); setConfirmPassword(''); setConfirmationTouched(false); };
  const signIn = async (e: FormEvent) => {
    e.preventDefault(); setNotice(false);
    if (customerEmailError(login)) { setError(customerEmailError(login)); return; }
    if (accounts === 'server') {
      setBusy(true); const { session, error, staff } = await callAccounts('/api/auth/login', { login, password }); setBusy(false);
      if (!session) { setError(staff ? 'Это служебный аккаунт сотрудника. Он входит не здесь, а в управление сайтом.' : error!); return; }
      setPassword(''); setError(''); startSession(session); return;
    }
    if (login.trim().toLowerCase() === DEMO_LOGIN && password === DEMO_PASSWORD) {
      const demo = await demoAccount();
      setPassword(''); setError('');
      setState(s => ({ ...s, ...restoreAccountLists(s, demo.email), account: demo, signedIn: true, name: demo.firstName, card: true }));
      return;
    }
    const account = state.account;
    if (!account || !matchesLogin(account, login) || await hashPassword(account.email, password) !== account.passwordHash) { setError('Неверный email или пароль. Пока аккаунт хранится только в этом браузере: если вы регистрировались на другом устройстве, войти здесь не получится.'); return; }
    setPassword(''); setError('');
    setState(s => ({ ...s, ...restoreAccountLists(s, account.email), signedIn: true, card: account.partnerId ? true : s.card }));
  };
  const register = async (e: FormEvent) => {
    e.preventDefault(); setNotice(false); setError('');
    const contactError = customerEmailError(form.email) || phoneError(form.phone);
    if (contactError) { setError(contactError); return; }
    if (passwordError) { setConfirmationTouched(true); setError(passwordError); return; }
    if (accounts === 'server') {
      setBusy(true); const { session, error } = await callAccounts('/api/auth/register', { ...form, password }); setBusy(false);
      if (!session) { setError(error!); return; }
      setPassword(''); startSession(session); return;
    }
    const account: Account = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim(), partnerId: digits(form.partnerId), passwordHash: await hashPassword(form.email, password), createdAt: new Date().toISOString().slice(0, 10) };
    setPassword('');
    setState(s => ({ ...s, account, signedIn: true, name: account.firstName, card: account.partnerId ? true : s.card }));
  };
  const set = (key: keyof typeof form) => (value: string | boolean) => setForm(f => ({ ...f, [key]: value }));

  return <section className="auth" data-auth-mode={mode} data-ds-id="profile-auth">
    {mode === 'signin' ? <>
      <h1>Вход</h1>
      <p className="auth-switch">Нет аккаунта? <button type="button" className="auth-link" onClick={() => switchTo('register')}>Создать аккаунт</button></p>
      <form className="auth-form" onSubmit={signIn}>
        <Field label="Email">{id => <EmailInput id={id} autoComplete="username" value={login} onChange={setLogin} />}</Field>
        <Field label="Пароль">{id => <PasswordInput id={id} autoComplete="current-password" value={password} onChange={setPassword} />}</Field>
        <button className="btn btn--primary auth-submit" disabled={!accounts || busy || !login.trim() || password.length < 8}>{busy ? 'Входим…' : 'Войти'}</button>
        <button type="button" className="auth-link auth-forgot" onClick={() => setNotice(true)}>Забыли пароль?</button>
      </form>
    </> : <>
      <h1>Создать аккаунт</h1>
      <p className="auth-switch auth-switch--left">Уже есть аккаунт? <button type="button" className="auth-link" onClick={() => switchTo('signin')}>Войти</button></p>
      <form className="auth-form" onSubmit={register}>
        <p className="auth-hint"><span className="auth-required" aria-hidden="true">*</span> — обязательные поля.</p>
        <div className="auth-row">
          <Field label="Имя" required>{id => <input id={id} className="field" autoComplete="given-name" placeholder="Введите имя" value={form.firstName} onChange={e => set('firstName')(e.target.value)} required />}</Field>
          <Field label="Фамилия" required>{id => <input id={id} className="field" autoComplete="family-name" placeholder="Введите фамилию" value={form.lastName} onChange={e => set('lastName')(e.target.value)} required />}</Field>
        </div>
        <Field label="Email" required>{id => <EmailInput id={id} value={form.email} onChange={set('email')} />}</Field>
        <Field label="Телефон (необязательно)">{id => <PhoneInput id={id} value={form.phone} onChange={set('phone')} />}</Field>
        <Field label="Пароль" required hint="Не меньше 8 символов.">{id => <PasswordInput id={id} autoComplete="new-password" value={password} onChange={setPassword} />}</Field>
        <Field label="Повторите пароль" required>{id => <PasswordInput id={id} autoComplete="new-password" value={confirmPassword} onChange={value => { setConfirmPassword(value); setConfirmationTouched(true); }} onBlur={() => setConfirmationTouched(true)} error={confirmationTouched ? passwordError : undefined} />}</Field>
        <label className="auth-consent"><input type="checkbox" checked={form.consent} onChange={e => set('consent')(e.target.checked)} required /> <span><span className="auth-required" aria-hidden="true">* </span>Я согласен(на) на обработку персональных данных согласно <a href="/company/consent/">политике конфиденциальности</a></span></label>
        <button className="btn btn--primary auth-submit" disabled={!accounts || busy || !form.consent || Boolean(passwordError)}>{busy ? 'Создаём…' : 'Создать аккаунт'}</button>
      </form>
    </>}
    {error && <div className="auth-notice auth-notice--error" role="alert"><Icon name="close" size={20} /><p>{error}</p></div>}
    {notice && <div className="auth-notice" role="status"><Icon name="clock" size={20} /><p><strong>Скоро заработает.</strong> Восстановление пароля появится позже.</p></div>}
    <a className="auth-guest" href="/">Продолжить без входа <Icon name="chevron" size={16} /></a>
  </section>;
}

export {Field,PasswordInput} from '../../../packages/presentation/form-fields';
