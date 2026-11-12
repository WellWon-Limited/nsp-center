import test from 'node:test';
import assert from 'node:assert/strict';
import { installHomeReveal } from '../src/home-reveal.mjs';

// Entrances on scroll follow data-reveal-design (set by index.html).
test('home blocks get entrances only when a variant is chosen', () => {
  const marked = [];
  const block = { getBoundingClientRect: () => ({ top: 2000 }), closest: () => null, querySelectorAll: () => [], classList: { add: c => marked.push(c) } };
  const doc = { documentElement: { dataset: {}, classList: { add() {}, remove() {} } }, querySelector: () => ({}), querySelectorAll: () => [block], addEventListener() {}, removeEventListener() {} };
  const win = { innerHeight: 900, matchMedia: () => ({ matches: false }), IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} } };
  installHomeReveal(win, doc)();
  assert.deepEqual(marked, [], 'no variant: nothing is hidden');
  doc.documentElement.dataset.revealDesign = '2';
  installHomeReveal(win, doc)();
  assert.deepEqual(marked, ['reveal'], 'a block below the first screen waits for its entrance');
});
