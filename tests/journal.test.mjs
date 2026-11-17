import {webpUrl} from '../packages/domain/webp.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as cheerio from 'cheerio';

const root=resolve(import.meta.dirname,'..');
const content=JSON.parse(readFileSync(resolve(root,'packages/catalog/generated/content.json'),'utf8'));
const images=JSON.parse(readFileSync(resolve(root,'packages/catalog/source/journal-images.json'),'utf8'));
const normalize=value=>String(value).replace(/\s+/gu,' ').trim();
const read=path=>cheerio.load(readFileSync(resolve(root,'dist',path.replace(/^\//,'')+'index.html'),'utf8'));

test('All journal articles retain their paragraphs, lists, dates and one title in the approved layout',()=>{
 for(const article of content.articles){
  const $=read(article.path);const doc=$('.journal-article-page .av-document');
  assert.equal(doc.length,1,article.id);
  assert.equal($('h1').length,1,article.id);
  assert.equal(normalize(doc.find('h1').text()),article.title,article.id);
  assert.equal(doc.find('.av-date').text(),article.date,article.id);
  assert.equal(doc.find('.av-contents,.av-read').length,0,article.id);
  const source=cheerio.load(article.html,null,false);const rendered=normalize(doc.text());
  source('p,li').each((_,node)=>{const text=normalize(source(node).text());if(text)assert.ok(rendered.includes(text),`${article.id}: lost source text ${text.slice(0,90)}`);});
  assert.equal(doc.find('li').length,source('li').length,`${article.id}: list count`);
 }
});

test('Every article image is regenerated, local, and the cover matches the journal and homepage card',()=>{
 const blog=read('/blog/');const home=read('/');
 for(const article of content.articles){
  const $=read(article.path);const expected=images[article.id];assert.ok(expected,article.id);
  assert.equal($('.av-hero-image').attr('src'),webpUrl(expected.cover),article.id);
  const media=$('.journal-article-page .av-document img').toArray();
  assert.equal(media.length,article.images.length,`${article.id}: image count`);
  const actual=media.map(node=>$(node).attr('src'));
  assert.deepEqual(actual,[webpUrl(expected.cover),...expected.inline.map(i=>webpUrl(i.src))],article.id);
  for(const node of media){const img=$(node);assert.ok(existsSync(resolve(root,'public',img.attr('src').replace(/^\//,''))),img.attr('src'));assert.ok(img.attr('alt')?.trim(),article.id);assert.ok(!article.images.includes(img.attr('src')),`${article.id}: old image remains`);}
  const card=blog(`.article-card a[href="${article.path}"]`);assert.equal(card.length,1,article.id);assert.equal(card.find('img').attr('src'),webpUrl(expected.cover),article.id);
  const homeCard=home(`.article-card a[href="${article.path}"]`);if(homeCard.length)assert.equal(homeCard.find('img').attr('src'),webpUrl(expected.cover),article.id);
 }
});

test('Magnesium precedes immunity on the homepage and journal; cover photographs have no letter badges',()=>{
 for(const path of ['/', '/blog/']){const $=read(path);const links=$('.article-card>a').map((_,node)=>$(node).attr('href')).get();assert.deepEqual(links.slice(0,2),['/blog/interesnye-fakty-pro-magniy/','/blog/immunitet-tozhe-nuzhdaetsya-v-zashchite/']);}
 const blog=read('/blog/');for(const article of content.articles){const card=blog(`.article-card a[href="${article.path}"]`);const expected='';assert.equal(card.find('.journal-cover-mark').text(),expected,article.id);const $=read(article.path);assert.equal($('.journal-hero-mark').text(),expected,article.id);}
});
