import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,join,normalize} from 'node:path';

function imports(entry){
  const seen=new Set();
  const walk=file=>{
    if(seen.has(file))return;seen.add(file);
    const source=readFileSync(file,'utf8');
    for(const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+\.mjs)['"]/g))walk(normalize(join(dirname(file),match[1])));
  };walk(entry);return seen;
}
test('API deployment contains its imports and never imports frontend source or rendering',()=>{
  const docker=readFileSync('Dockerfile','utf8').split('FROM runtime AS api')[1].split('FROM runtime AS admin')[0];
  for(const file of imports('apps/api/server.mjs')){
    assert.match(file,/^(apps\/api|packages\/domain)\//,file);
    assert.ok(docker.includes(file.startsWith('apps/')?'/app/apps/api':'/app/packages/domain'),file);
  }
  assert.doesNotMatch(docker,/\/app\/(dist|src)\b/);
});
test('web deployment has no API implementation, private catalog or database import',()=>{
  const docker=readFileSync('Dockerfile','utf8').split('FROM runtime AS web')[1];
  for(const file of imports('scripts/serve.mjs')){
    assert.doesNotMatch(file,/apps\/api/);
    assert.doesNotMatch(readFileSync(file,'utf8'),/from ['"]pg['"]|DATABASE_URL|accounts\.pool/);
    assert.ok(docker.includes('/app/'+file)||file.startsWith('packages/domain/')&&docker.includes('/app/packages/domain'),file);
  }
  assert.doesNotMatch(docker,/generated\/content\.json|\/app\/apps\/api/);
});

test('admin deployment is independent of storefront runtime and database credentials',()=>{
 const docker=readFileSync('Dockerfile','utf8').split('FROM runtime AS admin')[1].split('FROM runtime AS web')[0];
 for(const file of imports('apps/admin/server.mjs')){
  assert.doesNotMatch(file,/apps\/api|scripts\/serve/);
  assert.doesNotMatch(readFileSync(file,'utf8'),/DATABASE_URL|from ['"]pg['"]/);
  assert.ok(docker.includes('/app/'+file)||file.startsWith('packages/domain/')&&docker.includes('/app/packages/domain'),file);
 }
 assert.doesNotMatch(docker,/\/app\/dist\s|generated\/content\.json|\/app\/src/);
});
