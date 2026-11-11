import test from 'node:test';
import {ownsBackLink} from '../src/page-navigation.mjs';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import * as cheerio from 'cheerio';
import {cleanInfoHtml,videoSections,contactSections} from '../src/information-content.mjs';
const root=resolve(import.meta.dirname,'..');
const data=JSON.parse(readFileSync(resolve(root,'src/generated/content.json'),'utf8'));
const page=path=>data.pages.find(p=>p.path===path);
const read=path=>cheerio.load(readFileSync(resolve(root,'dist',path.replace(/^\//,'')+'index.html'),'utf8'));
const words=text=>text.normalize('NFKC').match(/[\p{L}\p{N}]+/gu)||[];

test('Footer destinations share the editorial page frame and render one title before JavaScript',()=>{
 for(const path of ['/delivery/','/payments/','/company/faq/','/contacts/','/shares/','/company/reviews/','/photo/','/video/','/design-system/','/company/consent/','/company/privacy-policy/','/company/refund/']){
  const $=read(path);assert.equal(ownsBackLink(path),true,`${path}: shared navigation must defer to the internal back link`);assert.equal($('.information-page').length,1,path);assert.equal($('h1').length,1,path);assert.ok($('h1').text().trim(),path);assert.equal($('.information-heading .information-home[href="/"]').length,1,path);
  assert.equal($('.site-header,.site-footer,.bottom-nav').length,3,path);
 }
});
test('Payment and legal page words stay unchanged through paragraph formatting and rendering',()=>{
 for(const path of ['/payments/','/company/consent/','/company/privacy-policy/','/company/refund/']){
  const original=cheerio.load(page(path).html,null,false);original('img').remove();
  const formatted=cheerio.load(cleanInfoHtml(page(path).html),null,false);
  assert.deepEqual(words(formatted.text()),words(original.text()),`${path}: formatter altered source words`);
  const $=read(path);assert.deepEqual(words($('.information-content>.rich-content').text()),words(original.text()),`${path}: rendered wording differs`);
 }
});
test('FAQ retains every question and answer; reviews retain authors and complete source paragraphs',()=>{
 for(const [path,selector]of [['/company/faq/','.information-faq'],['/company/reviews/','.information-reviews']]){
  const source=cheerio.load(page(path).html,null,false),$=read(path);const rendered=$(selector).text().replace(/\s+/g,' ').trim();
  source('h3,p').each((_,n)=>{const text=source(n).text().replace(/\s+/g,' ').trim();if(text)assert.ok(rendered.includes(text),`${path}: omitted ${text.slice(0,80)}`);});
  assert.equal(path.includes('faq')?$('.information-question').length:$('.information-review').length,source('h3').length,path);
 }
});
test('Empty offers and photos say so, and all twenty videos retain their destinations and local posters',()=>{
 assert.equal(read('/shares/')('.information-empty-message').text(),'Акций пока нет');
 assert.equal(read('/photo/')('.information-empty-message').text(),'Фото пока нет');assert.equal(read('/photo/')('.information-empty svg').length,0);assert.ok(read('/photo/')('.information-empty').hasClass('information-empty--plain'));assert.equal(read('/video/')('input[type=search]').length,0);
 for(const path of ['/photo/','/video/','/shares/','/contacts/','/company/reviews/','/payments/','/delivery/','/company/faq/']){const $=read(path);assert.ok($('.information-heading').hasClass('information-heading--plain'));assert.equal($('.information-heading .information-kicker').length,0);}
 for(const path of ['/photo/','/shares/']){const $=read(path);assert.equal($('.information-empty a,.information-empty svg,.information-empty h2').length,0);}
 for(const path of ['/contacts/','/company/reviews/','/payments/'])assert.equal(read(path)('.information-heading img').length,0);
 assert.equal(read('/delivery/')('.information-heading .information-kicker').length,0);
 const videos=videoSections(page('/video/').html),$=read('/video/');assert.equal(videos.length,20);assert.equal($('.information-video').length,20);
 for(const v of videos){assert.equal($(`.information-video a[href="${v.href}"]`).length,1,v.id);assert.equal($(`img[src="${v.poster}"]`).length,1,v.id);assert.ok(existsSync(resolve(root,'public',v.poster.slice(1))),v.id);}
});
test('Contact hours and unique business details are preserved; obsolete form labels are absent',()=>{
 const contact=contactSections(page('/contacts/').html),$=read('/contacts/');
 for(const html of [contact.hoursHtml,contact.bankHtml]){const fragment=cheerio.load(html,null,false);fragment('p').each((_,p)=>assert.ok($('.information-page').text().replace(/\s+/g,' ').includes(fragment(p).text().replace(/\s+/g,' '))));}
 assert.ok($('.information-contact-grid a[href^="tel:"]').attr('href').includes('79626854838'));
 assert.equal($('.information-page').text().includes('Введите проверочный код'),false);
});

test('The care journal keeps its original heading and card-grid structure',()=>{
 const $=read('/blog/');assert.equal($('.information-heading,.information-page').length,0);assert.equal($('.page-heading h1').text(),'Журнал о заботе');assert.equal($('.article-grid .article-card').length,data.articles.length);// The back link is the shared one, named after the page the visitor came from (added in the browser), not a fixed «На главную».
 assert.equal($('.information-home').length,0);assert.equal($('.page-heading .information-home').length,0);
});

// Owner, 2026-11-09: every destination from the homepage must provide an explicit way back.
test('The company page provides a homepage return and the certificates page keeps its company fallback',()=>{
 assert.equal(read('/company/')('.co-home-return .back-link[href="/"]').length,1);
 assert.ok(read('/company/')('.co-home-return').text().includes('На главную'));
 const $=read('/company/sertifikaty/');assert.equal($('.cert-back .back-link').attr('href'),'/company/');assert.ok($('.cert-back .back-link').text().includes('О компании'));
});

test('Company article keeps its introduction, six principles, timeline and product/document links',()=>{
 const $=read('/company/');
 const intro='NSP-центр помогает выбирать продукты на основе растительных ингредиентов и находить понятную информацию о составе, применении и качестве. Чтобы забота о себе становилась частью повседневной жизни.';
 assert.equal($('h1').length,1);
 assert.equal($('.co-hero p').length,0);
 assert.equal($('.co-article-lead').text(),intro);
 assert.equal($('.company-page').text().split(intro).length-1,1);
 assert.ok(!/Nature[’']s Sunshine/i.test($('.company-page').text()));
 assert.equal($('.co-principle-grid>article').length,6);
 assert.deepEqual($('.co-timeline article>strong').map((_,e)=>$(e).text()).get(),['1972','1974','2015','Сегодня']);
 assert.equal($('.co-research a[href="/company/sertifikaty/"]').length,1);
 assert.equal($('.co-closing a[href="/catalog/"]').length,1);
});
