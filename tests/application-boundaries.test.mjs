import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {dirname,resolve,relative,sep} from 'node:path';
import ts from 'typescript';

const root=resolve('.');
function sourceFiles(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
 const path=resolve(dir,entry.name);
 return entry.isDirectory()?sourceFiles(path):/\.(?:[cm]?[jt]sx?|css)$/.test(path)?[path]:[];
});}

test('applications consume shared packages without importing one another; shared code never imports applications',()=>{
 const violations=[];
 for(const area of ['apps/web','apps/admin','apps/api','packages/presentation','packages/domain']){
  for(const file of sourceFiles(area)){
   const code=readFileSync(file,'utf8');
   const imports=file.endsWith('.css')?[...code.matchAll(/@import\s+(?:url\()?['"]([^'"]+)/g)].map(m=>m[1]):ts.preProcessFile(code,true,true).importedFiles.map(i=>i.fileName);
   for(const specifier of imports){
    if(!specifier.startsWith('.'))continue;
    const target=relative(root,resolve(dirname(file),specifier)).split(sep).join('/');
    if(area.startsWith('packages/')&&target.startsWith('apps/')||area.startsWith('apps/')&&target.startsWith('apps/')&&!target.startsWith(area+'/'))violations.push(`${relative(root,file)} -> ${specifier}`);
    if(area==='apps/api'&&target.startsWith('packages/presentation/'))violations.push(`${relative(root,file)} imports browser presentation`);
   }
  }
 }
 assert.deepEqual(violations,[]);
 assert.equal(existsSync('src'),false,'no legacy source tree remains');
});
