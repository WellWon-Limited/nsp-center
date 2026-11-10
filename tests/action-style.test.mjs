import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as cheerio from 'cheerio';
const iconPath='m9 5 7 7-7 7';
const read=path=>cheerio.load(readFileSync(`dist/${path}index.html`,'utf8'));
test('Editorial action buttons share the homepage chevron instead of a diagonal text arrow',()=>{
 for(const route of ['company/','contacts/','delivery/','payments/','company/reviews/','company/faq/']){
  const $=read(route);const actions=$('.information-button,.co-button,.information-text-link,.delivery-tracking');
  assert.ok(actions.length>0,route);
  actions.each((_,e)=>{assert.doesNotMatch($(e).text(),/[↗→]/,route);assert.equal($(e).find('svg path').attr('d'),iconPath,route);assert.equal($(e).find('svg[aria-hidden=true]').length,1,route)});
 }
 for(const route of ['blog/immunitet-tozhe-nuzhdaetsya-v-zashchite/','blog/interesnye-fakty-pro-magniy/']){
  const $=read(route);assert.equal($('.av-end a svg path').attr('d'),iconPath,route);
 }
});
test('Editorial buttons use the same rounding token as standard homepage buttons',()=>{
 const core=readFileSync('src/design-system.css','utf8');
 assert.match(core,/\.btn\s*\{[^}]*border-radius:\s*var\(--radius-control\)/);
 for(const [file,selector] of [['src/information-pages.css','information-button'],['src/company-variants.css','co-button']]){
  const css=readFileSync(file,'utf8');const rule=css.match(new RegExp('\\.'+selector+'\\{([^}]+)\\}'))?.[1];
  assert.ok(rule,file);assert.match(rule,/border-radius:var\(--radius-control\)/,file);assert.doesNotMatch(rule,/border-radius:[0-4]px/,file);
 }
});

test('Return links use a chevron instead of a text arrow',()=>{
 for(const route of ['company/','company/sertifikaty/','company/reviews/','contacts/','delivery/','product/omega-3-epa/']){
  const $=read(route);const links=$('.back-link,.information-home');
  assert.ok(links.length>0,route);
  links.each((_,e)=>{assert.doesNotMatch($(e).text(),/←/,route);assert.equal($(e).find('svg path').attr('d'),iconPath,route)});
 }
});
