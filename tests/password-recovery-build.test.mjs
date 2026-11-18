import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
test('normal build retains local forgot-password destinations and all preview transitions',()=>{
 const source=readFileSync('apps/web/src/auth.tsx','utf8');
 const target=source.match(/location\.assign\('(\/__preview\/password-recovery\/[^']+)'\)/)?.[1];
 assert.ok(target,'local forgot-password entry must have a destination');
 assert.ok(existsSync(resolve('dist','.'+target)),'normal build must include the linked recovery page');
 for(let step=1;step<=5;step++){
  const page=readFileSync(`dist/__preview/password-recovery/step-${step}/index.html`,'utf8');
  for(const match of page.matchAll(/(?:href|src)="(\/[^"?#]+)(?:[^" ]*)"/g)){
   if(match[1].startsWith('/__preview/password-recovery/')||match[1].startsWith('/assets/'))assert.ok(existsSync(resolve('dist','.'+match[1])),`missing recovery dependency: ${match[1]}`);
  }
 }
 for(const file of ['client.js','contact-fields.js','password-rules.js'])assert.ok(existsSync(`dist/__preview/password-recovery/${file}`));
});
