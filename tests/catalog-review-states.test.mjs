import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as cheerio from 'cheerio';
import {ownsBackLink} from '../src/page-navigation.mjs';
const data=JSON.parse(fs.readFileSync('src/generated/content.json'));
test('each catalog category owns one mobile return, without a second page-level row above its heading',()=>{
 for(const category of data.categories.filter(c=>c.path!=='/catalog/')){
  assert.equal(ownsBackLink(category.path),true,category.path);
  const $=cheerio.load(fs.readFileSync('dist'+category.path+'index.html','utf8'));
  assert.equal($('.site-main>.back-link').length,0,category.path);
  assert.equal($('.catalog-page>.catalog-mobile-back').length,1,category.path);
  assert.equal($('.catalog-page>.page-heading h1').text(),category.name);
 }
});
test('every published catalog card has either real review information or an explicit empty state',()=>{
 let cards=0;
 for(const category of data.categories){
  const $=cheerio.load(fs.readFileSync('dist'+category.path+'index.html','utf8'));
  $('.product-card').each((_,card)=>{const text=$(card).find('.product-info .rating').text().trim();assert.ok(/отзыв/i.test(text),$(card).find('h3').text());cards++});
 }
 assert.ok(cards>100);
 for(const id of ['chlorophyll-lime','day-anti-age-face-cream-40'])assert.equal(data.products.find(p=>p.id===id).experts?.length??0,0,'no expert quote from a different product');
 for(const id of ['collagen-plus','smart-meal','tnt-nsp','turmeric-curcumin']){
  const notes=data.products.find(p=>p.id===id).experts;assert.ok(notes?.length);for(const note of notes){assert.ok(note.speaker&&note.lecture&&note.course&&note.text);}
 }
});
