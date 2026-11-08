import test from 'node:test';
import assert from 'node:assert/strict';
import {homeStoryLinks,homeStoryReturn,homeStoryIsOpen,rememberHomeStory} from '../src/home-story-navigation.mjs';

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

test('Returning to the home history entry retains the expanded details without changing other history data',()=>{
 const previous={catalogFilter:'retained'};const history={state:previous,replaceState(state){this.state=state;}};
 rememberHomeStory(history,true);const homeEntry=history.state;assert.equal(homeStoryIsOpen(homeEntry),true);assert.equal(homeEntry.catalogFilter,'retained');assert.equal(previous.nspHomeStoryOpen,undefined);
 history.state=null;assert.equal(homeStoryIsOpen(history.state),false);history.state=homeEntry;assert.equal(homeStoryIsOpen(history.state),true);rememberHomeStory(history,false);assert.equal(homeStoryIsOpen(history.state),false);
});
