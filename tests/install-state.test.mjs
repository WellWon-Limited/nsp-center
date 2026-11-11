import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installationPlatform,relatedAppInstalled,runningAsApp} from '../src/install-state.mjs';
const environment=({mode='browser',standalone=false,apps}={})=>({navigator:{standalone,...(apps?{getInstalledRelatedApps:apps}:{})},matchMedia:query=>({matches:query===`(display-mode: ${mode})`}),location:{href:'https://nsp.example/profile/'}});
test('Installed launch modes suppress installation on both desktop and iPhone; browser launches do not',()=>{
 for(const mode of ['standalone','minimal-ui'])assert.equal(runningAsApp(environment({mode})),true);
 assert.equal(runningAsApp(environment({standalone:true})),true);
 assert.equal(runningAsApp(environment()),false);
});
test('An installed related NSP web app is recognized without confusing unrelated applications',async()=>{
 assert.equal(await relatedAppInstalled(environment({apps:async()=>[{platform:'webapp',url:'/manifest.webmanifest',id:'/'}]})),true);
 assert.equal(await relatedAppInstalled(environment({apps:async()=>[{platform:'webapp',url:'https://other.example/manifest.webmanifest',id:'https://other.example/'}]})),false);
 assert.equal(await relatedAppInstalled(environment({apps:async()=>[]})),false);
 assert.equal(await relatedAppInstalled(environment({apps:async()=>{throw Error('unavailable')}})),false);
 assert.equal(await relatedAppInstalled(environment()),false);
});
test('Installation guidance distinguishes iPhone, Android, Safari for Mac and desktop Chromium',()=>{
 for(const [nav,expected] of [[{userAgent:'iPhone Version/26 Safari/604.1'},'ios'],[{userAgent:'Macintosh Version/26 Safari/605.1',platform:'MacIntel'},'mac-safari'],[{userAgent:'Macintosh Chrome/145 Safari/537'},'chromium'],[{userAgent:'Windows Chrome/145 Edg/145'},'edge'],[{userAgent:'Android Chrome/145'},'android'],[{platform:'MacIntel',maxTouchPoints:5},'ios']])assert.equal(installationPlatform(nav),expected);
 const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));
 assert.ok(manifest.related_applications.some(app=>app.platform==='webapp'&&app.id===manifest.id&&app.url==='/manifest.webmanifest'));
});
