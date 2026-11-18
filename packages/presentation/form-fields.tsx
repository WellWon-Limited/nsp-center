import './auth.css';
import {useId,useState,type ReactNode} from 'react';
import {Icon} from './ui';
export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: (id: string) => ReactNode; hint?: string }) {
  const id = useId();
  return <div className="auth-field">
    <label htmlFor={id}>{label}{required && <span className="auth-required" aria-hidden="true"> *</span>}</label>
    {children(id)}
    {hint && <p className="auth-hint">{hint}</p>}
  </div>;
}
export function PasswordInput({ id, autoComplete, value, onChange, error, onBlur }: { id: string; autoComplete: string; value: string; onChange: (value: string) => void; error?: string; onBlur?: () => void }) {
  const [shown, setShown] = useState(false);
  return <><div className="auth-password">
    <input id={id} className="field" type={shown ? 'text' : 'password'} autoComplete={autoComplete} placeholder="Введите пароль" value={value} onChange={e => onChange(e.target.value)} required minLength={8} maxLength={200} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onBlur={onBlur} />
    <button type="button" className="auth-eye" aria-label={shown ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={shown} onClick={() => setShown(v => !v)}><Icon name={shown ? 'eye-off' : 'eye'} size={20} /></button>
  </div>
    {error && <p id={`${id}-error`} className="auth-hint auth-password-error" role="status">{error}</p>}
  </>;
}
