import test from 'node:test';
import assert from 'node:assert/strict';
import { goBack, installAppHistory, nextStack, openedByBack, previousPage } from '../src/app-history.mjs';

const fakeWin = (path, stack = []) => {
  const store = new Map([['nsp-center:back-stack', JSON.stringify(stack)]]);
  const win = { location: { href: `https://nsp-center.ru${path}`, pathname: path.split('?')[0], search: '', origin: 'https://nsp-center.ru', replaced: null, replace(url) { this.replaced = url; } },
    sessionStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) } };
  return { win, store };
};

test('the way back in the app: a tab starts anew, a link adds the page, going back the same way removes it', () => {
  assert.deepEqual(nextStack([], '/', '/catalog/', true), [], 'tab bar: no way back to the home page');
  assert.deepEqual(nextStack([], '/catalog/', '/catalog/litso/', false), ['/catalog/']);
  assert.deepEqual(nextStack(['/catalog/'], '/catalog/litso/', '/product/x/', false), ['/catalog/', '/catalog/litso/']);
  assert.deepEqual(nextStack(['/catalog/'], '/catalog/litso/', '/catalog/', false), [], '«Категории» leads back, not forward');
});

test('the app keeps no browser history: a link replaces the page; «Назад» opens the page before at its place', () => {
  const { win, store } = fakeWin('/catalog/');
  let handler = null;
  const doc = { addEventListener: (type, fn) => { if (type === 'click') handler = fn; } };
  installAppHistory(win, doc, true);
  let prevented = false;
  const link = { href: 'https://nsp-center.ru/catalog/litso/', target: '', hasAttribute: () => false, closest: sel => (sel === 'a[href]' ? link : null) };
  handler({ defaultPrevented: false, button: 0, target: { closest: () => link }, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(win.location.replaced, 'https://nsp-center.ru/catalog/litso/', 'replaced, so iOS has nothing to swipe through');
  assert.deepEqual(JSON.parse(store.get('nsp-center:back-stack')), ['/catalog/']);
  const back = fakeWin('/catalog/litso/', ['/catalog/']);
  assert.equal(previousPage(back.win), '/catalog/');
  assert.equal(goBack(back.win, '/'), true);
  assert.equal(back.win.location.replaced, '/catalog/');
  assert.equal(back.store.get('nsp-center:back-restore'), '/catalog/');
  const arrived = fakeWin('/catalog/');
  arrived.store.set('nsp-center:back-restore', '/catalog/');
  assert.equal(openedByBack(arrived.win), true, 'the scroll position comes back');
  assert.equal(openedByBack(arrived.win), false, 'only once');
});
