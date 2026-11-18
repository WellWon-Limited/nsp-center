import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// The soft lights behind the pages are gradients, not discs under filter:blur(): iPhone painted those large blurred
// layers in pieces while a page opened, and light squares of the bare page colour showed around the home heading.
const css = ['../apps/web/src/','../packages/presentation/'].flatMap(dir =>
  readdirSync(new URL(dir, import.meta.url)).filter(f => f.endsWith('.css'))
    .map(f => [f, readFileSync(new URL(dir+f, import.meta.url), 'utf8')]));

test('no light behind the pages is a blurred layer', () => {
  for (const [file, text] of css) {
    for (const rule of text.match(/\.ambient i[^{]*\{[^}]*\}/g) ?? []) {
      assert.doesNotMatch(rule, /filter:blur/, `${file}: ${rule.slice(0, 120)}`);
      assert.doesNotMatch(rule, /background:var\(--color-/, `${file}: the colour goes into --ambient-c`);
    }
  }
  const shared = css.find(([f]) => f === 'app.css')[1];
  const bare = shared.replace(/\/\*[\s\S]*?\*\//g, '');
  const before = bare.slice(0, bare.indexOf('.ambient i{box-sizing'));
  assert.equal(before.split('{').length - before.split('}').length, 0, 'the shared rule is not inside a media query');
  assert.match(shared, /\.ambient i\{box-sizing:content-box;padding:calc\(var\(--ambient-b,70px\) \* 2\);margin:calc\(var\(--ambient-b,70px\) \* -2\);filter:none;background:radial-gradient\(closest-side,var\(--ambient-c\)/);
});

test('the loading screen has no blurred layers either', () => {
  const html = readFileSync(new URL('../apps/web/index.html', import.meta.url), 'utf8');
  const style = html.slice(html.indexOf('.nsp-launch{display:none}'), html.indexOf('</style>', html.indexOf('.nsp-launch{display:none}')));
  assert.doesNotMatch(style, /filter:blur/);
});
