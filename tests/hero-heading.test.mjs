import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as cheerio from 'cheerio';
test('Static home heading retains the full readable title and its two existing lines before JavaScript',()=>{
 const $=cheerio.load(readFileSync('dist/index.html','utf8'));
 const heading=$('h1');assert.equal(heading.length,1);
 assert.equal(heading.text(),'Забота о себе в вашем ритме');
 assert.equal(heading.attr('aria-label'),heading.text());
 assert.deepEqual(heading.find('.hero-title-line').map((_,n)=>$(n).text()).get(),['Забота о себе','в вашем ритме']);
 assert.equal(heading.find('.hero-stagger-char,.hero-fold-piece').length,0);
});
