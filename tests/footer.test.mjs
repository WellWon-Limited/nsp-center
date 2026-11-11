import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The footer is on public pages and the cart, not on the personal app screens and the chat (owner, 2026-11-10).
test('footer on public pages, not on personal screens', () => {
  const has = path => readFileSync(`dist/${path}index.html`, 'utf8').includes('class="site-footer"');
  for (const path of ['', 'catalog/', 'cart/', 'company/', 'delivery/']) assert.ok(has(path), path || '/');
  for (const path of ['profile/', 'profile/purchases/', 'health/', 'consultation/']) assert.ok(!has(path), path);
  assert.doesNotMatch(readFileSync('dist/index.html', 'utf8'), /перенесены из локального снимка/);
});

// Reviews: a visitor who is not signed in sees how to leave a review, with or without the accounts server.
test('the review form or a sign-in hint for every visitor', () => {
  const src = readFileSync('src/reviews.tsx', 'utf8');
  assert.match(src, /sessionReady && !state\.signedIn && <p className="review-signin">Чтобы оставить отзыв, <a href="\/profile\/">войдите в аккаунт<\/a>/);
  assert.doesNotMatch(src, /\{accounts === 'server' && \(state\.signedIn/, 'the hint no longer depends on the accounts server');
});
