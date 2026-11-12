import test from 'node:test';
import assert from 'node:assert/strict';
import {homeStoryLinks,homeStoryReturn} from '../src/home-story-navigation.mjs';

test('Home details article and company links carry their section, with a safe return destination',()=>{
 const original='<p><a href="/blog/vitamin-c/">Статья</a><a href="/company/">Компания</a><a href="/catalog/">Каталог</a><a href="https://example.com/company/">Внешний</a></p>';
 const result=homeStoryLinks(original,'reading');
 assert.ok(result.includes('href="/blog/vitamin-c/?from=home-about&amp;section=reading"'));
 assert.ok(result.includes('href="/company/?from=home-about&amp;section=reading"'));
 assert.ok(result.includes('href="/catalog/"'));
 assert.ok(result.includes('href="https://example.com/company/"'));
 assert.equal(homeStoryReturn('/blog/vitamin-c/?from=home-about&section=reading'),'/#about-reading');
 assert.equal(homeStoryReturn('/company/?from=home-about&section=company'),'/#about-company');
 assert.equal(homeStoryReturn('/company/?from=home-about&section=https://example.com'),'/#home-about');
 assert.equal(homeStoryReturn('/company/'),null);
 assert.equal(homeStoryReturn('/company/?from=chat'),null);
});

test('Journal index, reviews and contacts preserve their exact home section',()=>{
 for(const [path,section] of [['/blog/','reading'],['/company/reviews/','reviews'],['/contacts/','contacts']]){
  const html=homeStoryLinks(`<a href="${path}">Open</a>`,section);
  assert.ok(html.includes(`href="${path}?from=home-about&amp;section=${section}"`));
  assert.equal(homeStoryReturn(`${path}?from=home-about&section=${section}`),`/#about-${section}`);
 }
});

test('«Задать вопрос» from the home page comes back to the question band of the home page', () => {
 assert.equal(homeStoryReturn('/consultation/?from=home-about&section=consult'), '/#home-consult');
 assert.equal(homeStoryReturn('/consultation/'), null);
});
