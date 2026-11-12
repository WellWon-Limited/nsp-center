import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The footer is on every page on a computer; on a phone the personal app screens and the chat end without it
// (owner, 2026-11-10 and 2026-11-12).
test('footer on every page on a computer; personal screens hide it on a phone', () => {
  const footer = path => readFileSync(`dist/${path}index.html`, 'utf8').match(/<footer class="site-footer([^"]*)"/)?.[1];
  for (const path of ['', 'catalog/', 'cart/', 'company/', 'delivery/']) assert.equal(footer(path), '', path || '/');
  for (const path of ['profile/', 'profile/purchases/', 'health/', 'consultation/']) assert.equal(footer(path), ' site-footer--computer-only', path);
  assert.match(readFileSync('src/app.css', 'utf8'), /@media\(max-width:959px\)\{\.site-footer--computer-only\{display:none\}\}/);
  assert.doesNotMatch(readFileSync('dist/index.html', 'utf8'), /перенесены из локального снимка/);
});

// Reviews: a visitor who is not signed in sees how to leave a review, with or without the accounts server.
test('the review form or a sign-in hint for every visitor', () => {
  const src = readFileSync('src/reviews.tsx', 'utf8');
  assert.match(src, /sessionReady && !state\.signedIn && <p className="review-signin">Чтобы оставить отзыв, <a href="\/profile\/">войдите в аккаунт<\/a>/);
  assert.doesNotMatch(src, /\{accounts === 'server' && \(state\.signedIn/, 'the hint no longer depends on the accounts server');
});
