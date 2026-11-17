import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
function graph(entry){
 const seen=new Set();
 function visit(file){
  if(seen.has(file))return;seen.add(file);
  if(!/\.(tsx?|mjs)$/.test(file))return;
  const code=readFileSync(file,'utf8');
  for(const match of code.matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+)['"]/g)){
   const base=resolve(dirname(file),match[1]);
   const target=[base,...['.tsx','.ts','.mjs','.json','/index.ts'].map(ext=>base+ext)].find(p=>existsSync(p)&&/\.[a-z]+$/.test(p));
   assert.ok(target,`unresolved ${match[1]} in ${relative('.',file)}`);visit(target);
  }
 }
 visit(resolve(entry));return [...seen].map(p=>relative('.',p));
}
test('customer application never imports admin screens or styles, and admin never imports website boot or routing',()=>{
 const web=graph('apps/web/src/main.tsx'),admin=graph('apps/admin/main.tsx');
 assert.ok(web.includes('apps/web/src/App.tsx'));assert.ok(admin.includes('packages/presentation/index.ts'));
 assert.ok(!web.some(p=>p.startsWith('apps/admin/')));
 for(const file of ['apps/web/src/main.tsx','apps/web/src/boot.tsx','apps/web/src/App.tsx'])assert.ok(!admin.includes(file),file);
 for(const shared of ['packages/presentation/catalog.tsx','packages/presentation/site-header.tsx','packages/presentation/information-pages.tsx','packages/presentation/article-page.tsx']){
  assert.ok(web.includes(shared),shared);assert.ok(admin.includes(shared),shared);
 }
});
test('preview and editor loaders request API data rather than website HTML',()=>{
 const source=readFileSync('apps/admin/admin-preview.tsx','utf8')+readFileSync('apps/admin/admin-content.tsx','utf8');
 assert.doesNotMatch(source,/fetch\((?:product\.path|path|['"]\/['"])/);
 assert.doesNotMatch(source,/nsp-page-data/);
 assert.match(source,/\/api\/admin\/preview-data/);
 const provider=readFileSync('apps/admin/store.tsx','utf8');
 assert.doesNotMatch(provider,/localStorage|sessionStorage|\/api\/auth|\/api\/account/);
});
