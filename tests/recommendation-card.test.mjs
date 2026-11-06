import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as cheerio from 'cheerio';
const page=path=>cheerio.load(readFileSync(new URL(`../dist/${path}index.html`,import.meta.url),'utf8'));
test('Home, plan and marathon render the same recommendation card and preserve the test return context',()=>{
 const home=page('');const expected=home('.recommendation-card').html();
 assert.ok(expected?.includes('Что подойдёт'));
 assert.equal(home('.recommendation-card').attr('href'),'/diagnostic-test/');
 for(const [path,from] of [['health/','plan'],['health-marafon/','marathon']]){
  const $=page(path),card=$('.recommendation-card');assert.equal(card.length,1,path);
  assert.equal(card.html(),expected,path);
  assert.equal(card.attr('href'),`/diagnostic-test/?from=${from}`,path);
  assert.ok(card.parent().hasClass('home-care--editorial'),`${path}: shared card styling is absent`);
 }
});
