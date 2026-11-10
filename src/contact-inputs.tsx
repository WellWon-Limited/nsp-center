import './contact-inputs.css';
import { useState } from 'react';
import { emailError, emailSuggestion, maskPhone, phoneError } from './contact-fields.mjs';

// Email and phone fields of the sign-in, registration and profile forms. Rules live in contact-fields.mjs, shared with
// the accounts server. Errors appear when the visitor leaves the field (not on every key press) and disappear as soon
// as the value becomes right; a known misspelling of the mail service ("gmial.com") is offered as a one-tap fix.

type Common = { id: string; value: string; onChange: (value: string) => void; className?: string };

export function EmailInput({ id, value, onChange, autoComplete = 'email', required = true, className = 'field' }: Common & { autoComplete?: string; required?: boolean }) {
  const [touched, setTouched] = useState(false);
  const error = touched && value.trim() ? emailError(value) : '';
  const suggestion = touched ? emailSuggestion(value) : '';
  const describedBy = [error && `${id}-error`, suggestion && `${id}-suggestion`].filter(Boolean).join(' ') || undefined;
  return <>
    <input id={id} className={className} type="email" inputMode="email" autoComplete={autoComplete} autoCapitalize="none" spellCheck={false} placeholder="name@mail.ru" maxLength={120}
      value={value} onChange={e => onChange(e.target.value.replace(/\s/g, ''))} onBlur={() => setTouched(true)} required={required} aria-invalid={Boolean(error)} aria-describedby={describedBy} />
    {error && <p id={`${id}-error`} className="contact-error" role="alert">{error}</p>}
    {suggestion && !error && <p id={`${id}-suggestion`} className="contact-suggestion">Возможно, вы имели в виду <button type="button" onClick={() => onChange(suggestion)}>{suggestion}</button>?</p>}
  </>;
}

/** "+7" stands in front of the field; the field keeps the rest as "(900) 111-22-33". `value` and `onChange` carry
 *  the full number, "+7 (900) 111-22-33", or '' for an empty field. */
export function PhoneInput({ id, value, onChange, className = 'field' }: Common) {
  const [touched, setTouched] = useState(false);
  const shown = maskPhone(value);
  const error = touched ? phoneError(value) : '';
  return <>
    <div className="phone-field">
      <span className="phone-field-prefix" aria-hidden="true">+7</span>
      <input id={id} className={className} type="tel" inputMode="tel" autoComplete="tel" placeholder="(900) 000-00-00"
        value={shown} onChange={e => { const next = maskPhone(e.target.value); onChange(next ? `+7 ${next}` : ''); }} onBlur={() => setTouched(true)}
        aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
    </div>
    {error && <p id={`${id}-error`} className="contact-error" role="alert">{error}</p>}
  </>;
}
