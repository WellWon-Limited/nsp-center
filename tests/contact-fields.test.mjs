import test from 'node:test';
import assert from 'node:assert/strict';
import { customerEmailError, emailError, emailSuggestion, formatPhone, maskPhone, phoneError } from '../packages/presentation/contact-fields.mjs';
import { normalEmail, validateRegistration } from '../scripts/accounts.mjs';

test('the phone field shows +7 and the rest as "(900) 111-22-33", whatever prefix the visitor types or pastes', () => {
  for (const typed of ['8 900 111-22-33', '89001112233', '+7 900 111 22 33', '+79001112233', '7 (900) 111-22-33', '9001112233', '+7 (900) 111-22-33'])
    assert.equal(formatPhone(typed), '+7 (900) 111-22-33', typed);
  assert.equal(maskPhone('8'), '', 'a lone country prefix leaves the field empty');
  assert.equal(maskPhone('89'), '(9');
  assert.equal(maskPhone('(900) 1'), '(900) 1', 'editing inside our mask keeps every digit');
  assert.equal(maskPhone('(900) '), '(900', 'Backspace is not stuck on the bracket');
  assert.equal(maskPhone('(800) 123'), '(800) 123', 'a number starting with 8 after +7 is kept');
  assert.equal(maskPhone('+7 (900) 111-22-334455'), '(900) 111-22-33', 'at most ten digits');
  assert.equal(phoneError(''), '', 'the phone is optional');
  assert.equal(phoneError('+7 (900) 111-22-33'), '');
  assert.match(phoneError('+7 (900) 111'), /10 цифр/);
});

test('any real mailbox is accepted, a malformed address is "Недопустимый адрес почты"', () => {
  for (const ok of ['anna@mail.ru', 'Anna.Ivanova@yandex.ru', 'name+shop@gmail.com', 'a_b-c@bk.ru', 'анна@почта.рф', 'user@xn--80a1acny.xn--p1ai', 'user@company.spb.ru'])
    assert.equal(emailError(ok), '', ok);
  for (const bad of ['anna', 'anna@', '@mail.ru', 'anna@mail', 'anna@@mail.ru', 'an na@mail.ru', 'anna.@mail.ru', 'anna..b@mail.ru', 'anna@-mail.ru', 'anna@mail.r', 'anna@mail.ru.', 'anna@mail..ru'])
    assert.match(emailError(bad), /Недопустимый адрес почты/, bad);
  assert.equal(emailError(''), 'Введите email.');
});

test('a known misspelling of the mail service is offered as a fix', () => {
  assert.equal(emailSuggestion('anna@yandex.ry'), 'anna@yandex.ru');
  assert.equal(emailSuggestion('anna@Mail.ry'), 'anna@mail.ru');
  assert.equal(emailSuggestion('anna@mail.ru'), '');
});

test('the server applies the same rules and stores the phone in one format', () => {
  const ok = { firstName: 'Анна', lastName: 'Иванова', email: 'anna@mail.ru', phone: '89001112233', password: 'password-1', consent: true };
  assert.equal(validateRegistration(ok).value.phone, '+7 (900) 111-22-33');
  assert.match(validateRegistration({ ...ok, email: 'anna@mail' }).error, /Недопустимый адрес почты/);
  assert.match(validateRegistration({ ...ok, phone: '+7 900 11' }).error, /10 цифр/);
  assert.equal(validateRegistration({ ...ok, email: 'анна@почта.рф' }).error, undefined);
});

test('a Cyrillic mail domain is one address in either spelling', () => {
  assert.equal(normalEmail('Anna@XN--80A1ACNY.XN--P1AI'), 'anna@почта.рф');
  assert.equal(normalEmail(' Anna@Почта.рф '), 'anna@почта.рф');
  assert.equal(normalEmail('Anna@Mail.ru'), 'anna@mail.ru');
});

test('customers sign in and register with Russian mail only (406-FZ); foreign services get «мы не поддерживаем»', () => {
  for (const ok of ['anna@yandex.ru', 'anna@ya.ru', 'anna@yandex.com', 'anna@mail.ru', 'anna@bk.ru', 'anna@inbox.ru', 'anna@list.ru', 'anna@internet.ru', 'anna@rambler.ru', 'anna@lenta.ru', 'анна@почта.рф', 'sales@nsp-center.ru', 'user@company.spb.ru', 'user@xn--80a1acny.xn--p1ai'])
    assert.equal(customerEmailError(ok), '', ok);
  for (const foreign of ['anna@gmail.com', 'anna@icloud.com', 'anna@outlook.com', 'anna@hotmail.com', 'anna@yahoo.com', 'anna@proton.me', 'anna@gmail.ru.com'])
    assert.match(customerEmailError(foreign), /не поддерживаем/, foreign);
  assert.match(customerEmailError('anna@mail'), /Недопустимый адрес почты/, 'a malformed address is reported as such first');
});
