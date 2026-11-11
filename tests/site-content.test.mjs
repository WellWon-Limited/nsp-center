import test from 'node:test';
import assert from 'node:assert/strict';
import { activePromos, articleOf, articleSlug, faqKey, textToHtml, validateContent, videoOf } from '../src/site-content.mjs';

test('a video is added by a link to VK Видео, Rutube or YouTube, and nothing else', () => {
  assert.equal(videoOf('https://youtu.be/bNT7e_FykCE').embed, 'https://www.youtube-nocookie.com/embed/bNT7e_FykCE?autoplay=1');
  assert.equal(videoOf('https://www.youtube.com/watch?v=bNT7e_FykCE&t=3').id, 'bNT7e_FykCE');
  assert.equal(videoOf('https://rutube.ru/video/0123456789abcdef0123456789abcdef/').embed, 'https://rutube.ru/play/embed/0123456789abcdef0123456789abcdef?autoplay=1');
  assert.equal(videoOf('https://vkvideo.ru/video-12345_456239017').embed, 'https://vkvideo.ru/video_ext.php?oid=-12345&id=456239017&autoplay=1');
  assert.equal(videoOf('https://vk.com/video?z=video-12345_456239017').source, 'vk');
  assert.equal(videoOf('https://example.com/movie.mp4'), null);
  assert.equal(videoOf('javascript:alert(1)'), null);
});

test('text becomes safe HTML: paragraphs, «## » subheadings, «- » lists; no markup gets through', () => {
  assert.equal(textToHtml('Первый абзац\n\n## Подзаголовок\n\n- раз\n- два'), '<p>Первый абзац</p><h2>Подзаголовок</h2><ul><li>раз</li><li>два</li></ul>');
  assert.equal(textToHtml('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
});

test('each form is checked and explained in words', () => {
  assert.match(validateContent('photo', { image: 'https://evil.example/x.jpg' }).error, /Загрузите фото/);
  assert.deepEqual(validateContent('photo', { image: '/api/files/0123456789abcdef0123456789abcdef', caption: ' Офис ' }).value, { image: '/api/files/0123456789abcdef0123456789abcdef', caption: 'Офис' });
  assert.match(validateContent('video', { url: 'https://example.com', title: 'Видео' }).error, /VK Видео, Rutube или YouTube/);
  assert.match(validateContent('promo', { title: 'Скидка', from: '2026-12-10', to: '2026-12-01' }).error, /раньше/);
  assert.match(validateContent('promo', { title: 'Скидка', link: 'https://other.site/' }).error, /этого сайта/);
  assert.match(validateContent('faq', { q: 'Как?', a: '' }).error, /ответ/);
  assert.match(validateContent('article', { title: 'Тема', body: 'коротко' }).error, /текст статьи/);
  assert.deepEqual(validateContent('article', { title: 'Про магний', body: 'Магний нужен каждой клетке организма.', products: ['alfalfa', 'nope'] }, { productIds: new Set(['alfalfa']) }).value.products, ['alfalfa']);
  assert.match(validateContent('banner', {}).error, /раздела/);
});

test('an offer is shown from its first to its last day', () => {
  const promos = [{ id: 1, from: '', to: '' }, { id: 2, from: '2026-12-01', to: '' }, { id: 3, from: '', to: '2026-11-10' }, { id: 4, from: '2026-11-01', to: '2026-11-30' }];
  assert.deepEqual(activePromos(promos, '2026-11-11').map(p => p.id), [1, 4]);
});

test('an added article gets its own journal address and the built article shape', () => {
  assert.equal(articleSlug('Витамин D зимой', new Set(['vitamin-d-zimoy'])), 'vitamin-d-zimoy-2');
  const a = articleOf({ id: 7, slug: 'vitamin-d-zimoy', created_at: new Date('2026-11-11T10:00:00Z'), data: { title: 'Витамин D зимой', lead: 'Коротко.', body: 'Текст статьи.', cover: '', date: '2026-11-11', products: ['alfalfa'] } }, new Map([['alfalfa', '/product/alfalfa/']]));
  assert.deepEqual([a.path, a.date, a.related, a.custom], ['/blog/vitamin-d-zimoy/', '11 ноября 2026 г.', ['/product/alfalfa/'], true]);
  assert.equal(a.html, '<p>Коротко.</p><p>Текст статьи.</p>');
  assert.equal(faqKey('  Как   оформить заказ? '), 'как оформить заказ?');
});

test('the chat section of site management shows real questions and says nothing about a neural network', async () => {
  const { readFileSync } = await import('node:fs');
  const admin = readFileSync(new URL('../src/admin.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(admin, /YandexGPT|Нейросеть пока не подключена|ИИ-консультант/);
  assert.match(admin, /\/api\/admin\/chat-log/);
  assert.match(readFileSync(new URL('../src/assistant.tsx', import.meta.url), 'utf8'), /fetch\('\/api\/chat-log'/);
});
