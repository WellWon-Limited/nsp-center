import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const source = readFileSync('apps/web/src/auth-password.ts', 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, {exports});
const check = exports.registrationPasswordError;
test('Registration rejects short, missing, mismatching and overlong passwords', () => {
  for (const [password, confirmation] of [['short', 'short'], ['password8', ''], ['password8', 'Password8'], ['password8', 'password8 '], ['x'.repeat(201), 'x'.repeat(201)]]) assert.ok(check(password, confirmation));
  assert.equal(check('пароль12', 'пароль12'), '');
  assert.equal(check('x'.repeat(200), 'x'.repeat(200)), '');
});
test('Both account modes are guarded before registration and the form has no card guidance', () => {
  const auth = readFileSync('apps/web/src/auth.tsx', 'utf8');
  const handler = auth.slice(auth.indexOf('const register ='), auth.indexOf('const set ='));
  assert.ok(handler.indexOf('if (passwordError)') < handler.indexOf("accounts === 'server'"));
  assert.match(auth, /label="Повторите пароль"/);
  assert.doesNotMatch(auth, /Вы можете оформить дисконтную карту/, 'the owner removed the card hint from registration (2026-11-10)');
  assert.doesNotMatch(auth, /partnerSignupUrl|Оформить дисконтную карту ↗/);
});

test('Sign-in and registration do not offer social providers', () => {
  const auth = readFileSync('apps/web/src/auth.tsx', 'utf8');
  assert.doesNotMatch(auth, /ProviderButtons|Яндекс ID|VK ID|auth-provider|Регистрация по email/);
});

test('Registration leaves discount card setup to the profile', () => {
  const auth = readFileSync('apps/web/src/auth.tsx', 'utf8');
  assert.doesNotMatch(auth, /<Field label="Номер дисконтной карты/);
  assert.doesNotMatch(auth, /Вы можете оформить дисконтную карту/, 'the owner removed the card hint from registration (2026-11-10)');
});

test('Confirmation starts showing validation feedback while typing', () => {
  const auth = readFileSync('apps/web/src/auth.tsx', 'utf8');
  assert.match(auth, /value=\{confirmPassword\} onChange=\{value => \{ setConfirmPassword\(value\); setConfirmationTouched\(true\); \}\}/);
});
