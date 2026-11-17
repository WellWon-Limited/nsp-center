// Email and phone rules shared by the registration form, the profile form (apps/web/src/auth.tsx, apps/web/src/account.tsx) and the
// accounts server (scripts/accounts.mjs), so the browser and the server accept and reject the same addresses.

/** Russian numbers: "+7" and ten digits. The form shows "+7" in front of the field, and the field holds the rest,
 *  "(900) 111-22-33". What the visitor types or pastes into an empty field may start with the country prefix
 *  ("8 900…", "7900…", "+7 900…"); it is dropped. Once the field shows our "(…" mask, every digit is kept, so editing
 *  and deleting work. Returns the ten (or fewer) digits after +7. */
export const phoneDigits = value => {
  const raw = String(value ?? '').trim();
  let d = raw.replace(/\D/g, '');
  if (raw.startsWith('+7')) d = d.slice(1);
  else if (!raw.startsWith('(') && /^[78]/.test(d)) d = d.slice(1);
  return d.slice(0, 10);
};

/** The part of the number after "+7" as the field shows it while typing: "(900", "(900) 111-2", "(900) 111-22-33".
 *  Brackets and hyphens appear only before the next digit, so Backspace is never stuck on them. */
export const maskPhone = value => {
  const d = phoneDigits(value);
  if (!d) return '';
  let out = `(${d.slice(0, 3)}`;
  if (d.length > 3) out += `) ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
};

/** The full number to store and show: "+7 (900) 111-22-33"; '' when no digits were typed. */
export const formatPhone = value => { const m = maskPhone(value); return m ? `+7 ${m}` : ''; };

/** A sentence for the visitor, or '' when the phone is fine. The phone is optional: an empty field is fine. */
export const phoneError = value => {
  const d = phoneDigits(value);
  if (!d) return '';
  return d.length === 10 ? '' : 'Введите телефон полностью: 10 цифр после +7.';
};

// Local part: letters, digits and the usual signs; domain: labels of Latin or Cyrillic letters, digits and hyphens,
// the last one (the zone, "ru", "com", "рф") at least two letters. Quoted local parts and IP domains are left out on
// purpose: shops do not see them in real life, and they hide typos.
const LOCAL = /^[\p{L}\p{N}!#$%&'*+/=?^_`{|}~-]+(?:\.[\p{L}\p{N}!#$%&'*+/=?^_`{|}~-]+)*$/u;
const LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?$/u;
const ZONE = /^(?:\p{L}{2,}|xn--[a-z0-9-]+)$/u;

/** '' for an address that can be real, otherwise the sentence for the visitor. */
export const emailError = value => {
  const email = String(value ?? '').trim();
  if (!email) return 'Введите email.';
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at), domain = email.slice(at + 1);
  const labels = domain.split('.');
  const ok = at > 0 && email.indexOf('@') === at && email.length <= 254 && local.length <= 64 && LOCAL.test(local)
    && labels.length >= 2 && labels.every(l => LABEL.test(l)) && ZONE.test(labels.at(-1));
  return ok ? '' : 'Недопустимый адрес почты. Пример: name@mail.ru';
};

// Russian mail only (owner, 2026-11-11, law 406-FZ on signing in to Russian sites): the big Russian services —
// Yandex, Mail.ru (with bk, inbox, list, internet), Rambler (with lenta, ro, autorambler, myrambler) — and any
// address in the Russian zones .ru, .рф and .su (company mail such as sales@nsp-center.ru).
const RUSSIAN_SERVICES = /^(yandex\.[a-z]+|ya\.ru|narod\.ru|mail\.ru|bk\.ru|inbox\.ru|list\.ru|internet\.ru|rambler\.ru|lenta\.ru|ro\.ru|autorambler\.ru|myrambler\.ru)$/;
const RUSSIAN_ZONE = /\.(ru|su|рф|xn--p1ai)$/;
export const russianEmail = value => { const email = String(value ?? '').trim().toLowerCase(); const domain = email.slice(email.lastIndexOf('@') + 1); return RUSSIAN_SERVICES.test(domain) || RUSSIAN_ZONE.test(domain); };
export const FOREIGN_EMAIL_ERROR = 'Такую почту мы не поддерживаем: подойдёт только российская — Яндекс, Mail.ru, Рамблер или адрес на .ru и .рф. Например, name@yandex.ru';
/** For customers' sign-in and registration: a well-formed address on a Russian mail service. */
export const customerEmailError = value => emailError(value) || (russianEmail(value) ? '' : FOREIGN_EMAIL_ERROR);

// Frequent misspellings of the mail services people in Russia use most.
const TYPOS = {
  'mail.ru': ['mail.ry', 'mai.ru', 'mial.ru', 'maill.ru', 'mail.ri', 'mall.ru', 'mail.r', 'meil.ru'],
  'yandex.ru': ['yandex.ry', 'yandeks.ru', 'yndex.ru', 'yandx.ru', 'yadex.ru', 'yandex.r', 'yanex.ru', 'jandex.ru'],
  'ya.ru': ['ya.ry'],
  'bk.ru': ['bk.ry'],
  'list.ru': ['list.ry', 'lis.ru'],
  'inbox.ru': ['inbox.ry', 'inbx.ru'],
  'rambler.ru': ['rambler.ry', 'ramblr.ru', 'rambler.r', 'rambeler.ru'],
};
const FIX = Object.fromEntries(Object.entries(TYPOS).flatMap(([right, wrong]) => wrong.map(w => [w, right])));

/** The likely intended address when the domain is a known misspelling ("anna@gmial.com" -> "anna@gmail.com"), else ''. */
export const emailSuggestion = value => {
  const email = String(value ?? '').trim();
  const at = email.lastIndexOf('@');
  if (at < 1) return '';
  const right = FIX[email.slice(at + 1).toLowerCase()];
  return right ? `${email.slice(0, at)}@${right}` : '';
};
