import test from 'node:test';
import assert from 'node:assert/strict';
import { installHomeScrollEdges } from '../src/home-scroll-edges.mjs';

function browser(design = 'd') {
 const listeners = new Map(), frames = new Map();
 let sequence = 0, disconnected = false;
 const root = { dataset: { homeDesign: design }, scrollHeight: 3000 };
 const win = {
  innerHeight: 900, scrollY: 0,
  addEventListener(type, fn, options) { assert.equal(options.passive, true); listeners.set(type, fn); },
  removeEventListener(type, fn) { assert.equal(listeners.get(type), fn); listeners.delete(type); },
  requestAnimationFrame(fn) { const id = ++sequence; frames.set(id, fn); return id; },
  cancelAnimationFrame(id) { frames.delete(id); },
  ResizeObserver: class { observe() {} disconnect() { disconnected = true; } },
 };
 return { win, doc: { documentElement: root, body: {} }, root, listeners, frames,
  fire(type) { listeners.get(type)?.(); },
  flush() { const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(); },
  disconnected: () => disconnected,
 };
}

test('rubber-band scrolling continues white above the header and the page surface at its bottom', () => {
 const b = browser(); installHomeScrollEdges(b.win, b.doc);
 assert.equal(b.root.dataset.homeScrollEdge, 'top');
 for (const y of [2099, 2140]) {
  b.win.scrollY = y; b.fire('scroll'); b.flush();
  assert.equal(b.root.dataset.homeScrollEdge, 'bottom');
 }
 b.win.scrollY = -60; b.fire('scroll'); b.flush();
 assert.equal(b.root.dataset.homeScrollEdge, 'top');
});

test('resizing and growing content update the boundary, with scroll events batched into one frame', () => {
 const b = browser(); installHomeScrollEdges(b.win, b.doc);
 b.win.scrollY = 2100; b.fire('scroll'); b.fire('scroll'); b.fire('resize');
 assert.equal(b.frames.size, 1); b.flush();
 assert.equal(b.root.dataset.homeScrollEdge, 'bottom');
 b.root.scrollHeight = 4000; b.fire('resize'); b.flush();
 assert.equal(b.root.dataset.homeScrollEdge, 'top');
 b.win.scrollY = 3100; b.fire('pageshow'); b.flush();
 assert.equal(b.root.dataset.homeScrollEdge, 'bottom');
});

test('leaving the home page removes listeners, pending work and its root marker', () => {
 const b = browser(); const cleanup = installHomeScrollEdges(b.win, b.doc);
 b.fire('scroll'); cleanup();
 assert.equal(b.listeners.size, 0); assert.equal(b.frames.size, 0);
 assert.equal(b.root.dataset.homeScrollEdge, undefined); assert.ok(b.disconnected());
});

test('ordinary pages and other home designs do not install edge painting', () => {
 for (const design of [undefined, 'a', 'e']) {
  const b = browser(design); b.root.dataset.homeDesign = design;
  installHomeScrollEdges(b.win, b.doc)();
  assert.equal(b.listeners.size, 0); assert.equal(b.frames.size, 0);
  assert.equal(b.root.dataset.homeScrollEdge, undefined);
 }
});

test('the restyled catalog paints its bottom edge too, whatever the home design', () => {
 const b = browser(undefined); b.root.dataset.homeDesign = undefined; b.root.dataset.catalogDesign = '1';
 installHomeScrollEdges(b.win, b.doc);
 b.win.scrollY = 2100; b.fire('scroll'); b.flush();
 assert.equal(b.root.dataset.homeScrollEdge, 'bottom');
});
