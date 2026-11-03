/**
 * Adapts the supplied Claude Design prototype for Factory device frames
 * without touching the source file:
 * - the app fills the frame instead of a drawn 390x844 phone with a caption;
 * - the fake "9:41" status bar is removed and the screen respects the real
 *   safe-area inset of the frame;
 * - benign "ResizeObserver loop" notices no longer paint the bundle's red
 *   error banner (real errors still do).
 * Every edit must match exactly once, so a changed source fails loudly.
 */
import assert from 'node:assert/strict';

export const ORIGINAL_PROTOTYPE = 'assets/NSP App Prototype.html';

const TEMPLATE_ISLAND = /(<script type="__bundler\/template">\s*)([\s\S]*?)(\s*<\/script>)/;

// Design status bar height the screens were laid out under (padding-top 52-58px).
const DESIGN_STATUS_BAR = 48;
// Wider frames (tablet, laptop) show the app as a phone-width column.
const MAX_APP_WIDTH = 440;

const TEMPLATE_EDITS = [
  {
    name: 'viewport covers the safe areas',
    find: '<meta name="viewport" content="width=device-width, initial-scale=1">',
    replace: '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
  },
  {
    name: 'stage fills the frame',
    find: '<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px 16px;box-sizing:border-box">',
    replace: '<div style="position:fixed;inset:0;display:flex;justify-content:center">',
  },
  {
    name: 'caption above the phone is removed',
    find: /<div style="font:600 12px Manrope,sans-serif;color:#4f6d68;letter-spacing:\.04em">[^<]*<\/div>\n?/,
    replace: '',
  },
  {
    name: 'drawn phone body becomes a full-height column',
    find: '<div style="width:390px;height:844px;border-radius:54px;background:#15171a;padding:10px;box-sizing:border-box;box-shadow:0 30px 70px rgba(20,50,45,.28);flex:none">',
    replace: `<div style="position:relative;width:min(100%,${MAX_APP_WIDTH}px);height:100%;background:#eaf3f1;flex:none">`,
  },
  {
    // overflow:clip, not hidden: the blurred background blobs reach 120px past the right edge,
    // and a hidden-overflow box can still be scrolled sideways by focus or scrollIntoView.
    name: 'screen starts under the real status bar and cannot scroll sideways',
    find: '<div style="position:relative;width:100%;height:100%;border-radius:44px;overflow:hidden;',
    replace: `<div style="position:absolute;left:0;right:0;bottom:0;top:max(0px,calc(env(safe-area-inset-top,0px) - ${DESIGN_STATUS_BAR}px));overflow:clip;`,
  },
  {
    // The catalog pointed set cards at a Claude Design upload path that the export does not ship,
    // so they rendered empty. Use the bundled resource, exactly as the home screen already does.
    name: 'catalog set cards use the bundled set photo',
    find: "imgBg: p.set ? 'url(uploads/pasted-1790409141694-0.png) 72% 45%/auto 135% #dfeee0'",
    replace: "imgBg: p.set ? `url(${(window.__resources&&window.__resources.setsImg)||'uploads/pasted-1790409141694-0.png'}) 72% 45%/auto 135% #dfeee0`",
  },
  {
    name: 'fake status bar is removed',
    find: /<div style="position:absolute;top:0;left:0;right:0;height:48px;[^"]*"><span>9:41<\/span><span style="[^"]*"><\/span><\/div>\n?/,
    replace: '',
  },
];

const ERROR_GUARD = `<script>
// Adapted prototype: "ResizeObserver loop" is a benign browser notice, not an app error.
// Registered before the bundle's own listener, so its error banner never shows it.
window.addEventListener('error', function (e) {
  if (/ResizeObserver loop/.test((e && e.message) || '')) { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);
</script>`;

const replaceOnce = (text, { name, find, replace }) => {
  const count = typeof find === 'string' ? text.split(find).length - 1 : (text.match(new RegExp(find.source, 'g')) ?? []).length;
  assert.equal(count, 1, `Prototype edit "${name}" expected one match, found ${count}`);
  return text.replace(find, () => replace);
};

export function readTemplate(html) {
  const island = html.match(TEMPLATE_ISLAND);
  assert(island, 'Prototype template island is missing');
  return JSON.parse(island[2]);
}

export function adaptPrototype(html) {
  const template = TEMPLATE_EDITS.reduce(replaceOnce, readTemplate(html));
  // Same escaping as the bundler: "</" must not close the island's script tag.
  const island = JSON.stringify(template).replaceAll('</', '<\\u002F');
  const withTemplate = html.replace(TEMPLATE_ISLAND, (_, open, _body, close) => `${open}${island}${close}`);
  return replaceOnce(withTemplate, { name: 'error guard before the bundle loader', find: /^<!DOCTYPE html>\s*<html>\s*<head>/, replace: `<!DOCTYPE html>\n<html>\n<head>\n${ERROR_GUARD}` });
}
