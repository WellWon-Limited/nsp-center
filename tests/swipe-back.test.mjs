import test from 'node:test';
import assert from 'node:assert/strict';
import { isBackSwipe, standaloneIos } from '../apps/web/src/swipe-back.mjs';

test('a back swipe starts at the left edge and goes right: a third of the screen, or a short quick flick', () => {
  const W = 390;
  assert.equal(isBackSwipe(8, 140, 10, W, 0.05), true, 'slow but long enough: a slow deliberate swipe counts too');
  assert.equal(isBackSwipe(8, 60, 5, W, 0.6), true, 'short quick flick');
  assert.equal(isBackSwipe(8, 60, 5, W, 0.1), false, 'short and slow: let go, it springs back');
  assert.equal(isBackSwipe(40, 200, 10, W, 0.5), false, 'not from the edge');
  assert.equal(isBackSwipe(8, 30, 0, W, 1), false, 'too short even if quick');
  assert.equal(isBackSwipe(8, 200, 150, W, 0.5), false, 'mostly up or down: that is scrolling');
  assert.equal(isBackSwipe(8, 200, 10, W, -0.3), false, 'the finger went back left before letting go: cancelled');
});

test('the direction is decided after the first 10 px', async () => {
  const { swipeDirection } = await import('../apps/web/src/swipe-back.mjs');
  assert.equal(swipeDirection(4, 3), null);
  assert.equal(swipeDirection(14, 4), true);
  assert.equal(swipeDirection(6, 12), false, 'scrolling stays scrolling');
  assert.equal(swipeDirection(-12, 0), false);
});

test('fields, carousels that can scroll back, and open menus or dialogs keep their touches', async () => {
  const { ownsTouch } = await import('../apps/web/src/swipe-back.mjs');
  const win = { getComputedStyle: el => ({ overflowX: el.overflowX ?? 'visible' }) };
  const body = { nodeType: 1 };
  const el = (props, parent = body) => ({ nodeType: 1, parentElement: parent, scrollLeft: 0, scrollWidth: 100, clientWidth: 100, matches: () => false, ...props });
  const doc = (overlays = []) => ({ body, querySelectorAll: () => overlays });
  const field = el({ matches: sel => /input/.test(sel) });
  assert.equal(ownsTouch(field, doc(), win), true, 'a text field');
  const carousel = el({ overflowX: 'auto', scrollWidth: 900, clientWidth: 390, scrollLeft: 120 });
  assert.equal(ownsTouch(el({}, carousel), doc(), win), true, 'inside a carousel scrolled away from its start');
  const atStart = el({ overflowX: 'auto', scrollWidth: 900, clientWidth: 390, scrollLeft: 0 });
  assert.equal(ownsTouch(el({}, atStart), doc(), win), false, 'a carousel at its start cannot scroll further back');
  const menu = { getBoundingClientRect: () => ({ width: 300, height: 400 }) };
  assert.equal(ownsTouch(el({}), doc([menu]), win), true, 'an open menu or dialog');
});

test('only the iPhone home-screen app gets the gesture (browsers and Android have their own)', () => {
  const win = (standalone, ua, mq = false) => ({ navigator: { standalone, userAgent: ua }, matchMedia: () => ({ matches: mq }) });
  assert.equal(standaloneIos(win(true, 'iPhone')), true);
  assert.equal(standaloneIos(win(undefined, 'Mozilla/5.0 (iPhone)', true)), true);
  assert.equal(standaloneIos(win(false, 'Mozilla/5.0 (iPhone)')), false, 'Safari tab');
  assert.equal(standaloneIos(win(undefined, 'Mozilla/5.0 (Linux; Android 14)', true)), false, 'Android');
});

test('the swipe works only on a screen with a back button, and does what that button does', async () => {
  const { backButton, BACK_BUTTONS } = await import('../apps/web/src/swipe-back.mjs');
  const shown = { getBoundingClientRect: () => ({ width: 80, height: 32 }) };
  const hidden = { getBoundingClientRect: () => ({ width: 0, height: 0 }) };
  assert.equal(backButton({ querySelectorAll: sel => (sel === '.back-action' ? [] : [hidden, shown]) }), shown);
  const step = { getBoundingClientRect: () => ({ width: 60, height: 30 }) };
  assert.equal(backButton({ querySelectorAll: sel => (sel === '.back-action' ? [step] : [shown]) }), step, 'the test\'s «Назад» goes to the previous question first');
  assert.equal(backButton({ querySelectorAll: () => [] }), null, 'home and tabs without a back button: no swipe');
  assert.equal(backButton({ querySelectorAll: () => [hidden] }), null);
  assert.match(BACK_BUTTONS, /\.back-link/);
  assert.match(BACK_BUTTONS, /\.catalog-mobile-back/);
  const { readFileSync } = await import('node:fs');
  const code = readFileSync(new URL('../apps/web/src/swipe-back.mjs', import.meta.url), 'utf8');
  assert.match(code, /button\.click\(\);/);
  assert.doesNotMatch(code, /history\.back\(\)/);
});

test('a disabled or hidden return control cannot capture the edge swipe', async()=>{
 const {backButton,STEP_BACK}=await import('../apps/web/src/swipe-back.mjs');
 const visible={getBoundingClientRect:()=>({width:80,height:44})};
 const disabled={...visible,disabled:true};
 const inert={...visible,closest:()=>({})};
 assert.equal(backButton({querySelectorAll:s=>s===STEP_BACK?[disabled,inert]:[visible]}),visible);
 assert.equal(backButton({querySelectorAll:()=>[disabled,inert]}),null);
});

test('a completed app gesture returns exactly once; scroll, cancellation, notifications and cleanup stay safe',async()=>{
 const {installSwipeBack,OVERLAYS,STEP_BACK}=await import('../apps/web/src/swipe-back.mjs');
 const handlers=new Map(),settings=new Map();let clicks=0,prevented=0,overlay=false;
 const body={nodeType:1},target={nodeType:1,parentElement:body,matches:()=>false,scrollLeft:0,scrollWidth:100,clientWidth:100};
 const back={getBoundingClientRect:()=>({width:80,height:44}),click:()=>{assert.ok(prevented>clicks,'suppress the synthesized tap before activating Back');clicks++;}};
 const doc={body,querySelectorAll:s=>s===OVERLAYS?(overlay?[back]:[]):s===STEP_BACK?[]:[back],addEventListener:(type,fn,options)=>{handlers.set(type,fn);settings.set(type,options);},removeEventListener:type=>handlers.delete(type)};
 const win={navigator:{standalone:true},innerWidth:402,getComputedStyle:()=>({overflowX:'visible'})};
 const stop=installSwipeBack(win,doc);
 const event=(x,y,time,touches=1)=>({target,touches:Array.from({length:touches},()=>({clientX:x,clientY:y})),changedTouches:[{clientX:x,clientY:y}],timeStamp:time,cancelable:true,preventDefault:()=>prevented++});
 const send=(type,...args)=>handlers.get(type)(event(...args));
 send('touchstart',8,120,0);send('touchmove',70,122,70);send('touchend',170,124,180,0);
 assert.equal(clicks,1);assert.equal(prevented,1);
 assert.equal(settings.get('touchmove').passive,true,'vertical scrolling is never blocked');
 assert.equal(settings.get('touchend').passive,false,'only a completed gesture suppresses its duplicate tap');
 send('touchstart',8,120,200);send('touchmove',12,200,250);send('touchend',170,250,400,0);
 assert.equal(clicks,1,'a vertical scroll never returns');
 send('touchstart',8,120,500);send('touchmove',160,122,560);send('touchcancel',160,122,570,0);send('touchend',170,122,580,0);
 assert.equal(clicks,1,'a cancelled touch never returns');
 send('touchstart',8,120,600);send('touchmove',80,122,650,2);send('touchend',180,122,700,0);
 assert.equal(clicks,1,'a second finger cancels the gesture');
 overlay=true;
 send('touchstart',8,120,800);send('touchmove',100,122,850);send('touchend',180,122,900,0);
 assert.equal(clicks,1,'notifications and other open layers keep the gesture');
 stop();assert.equal(handlers.size,0,'unmount removes every gesture handler');
});
