// Browser acceptance exclusively through the project-owned Canvas CLI.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
const exec=promisify(execFile);
if(process.env.WW_TEST!=='1'||!process.env.WW_TEST_ID)throw new Error('Use WW_TEST=1 WW_TEST_ID=<id> against the isolated preview.');
const origin=process.env.NSP_TEST_URL||'http://127.0.0.1:5217';
if(!/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin))throw new Error('Only the local isolated preview is accepted.');
const {routes}=JSON.parse(await readFile('packages/catalog/generated/content.json','utf8'));
async function cv(args){const {stdout}=await exec('sh',['.wellwon/canvas/cv',...args],{maxBuffer:2**20,timeout:25000});return JSON.parse(stdout.trim());}
const results=[];
for(const route of routes){try{
 await cv(['console','--clear']);
 const opened=await cv(['open',origin+route.url,'--diagnose']);if(!opened.ok)throw new Error(opened.error);
 const ready=await cv(['wait','#root[data-hydrated="true"]']);if(!ready.ok)throw new Error('React did not become ready');
 const headings=await cv(['query','','--role','heading','--limit','50']);
 if(new URL(headings.url).pathname+new URL(headings.url).search!==route.url)throw new Error('Navigation mismatch');
 if(!headings.nodes?.some(n=>n.role==='heading'&&n.name))throw new Error('No accessible heading');
 const diagnostics=await cv(['diagnose']);
 const failures=(diagnostics.console||[]).filter(e=>e.level==='error'||e.type==='error');
 if(failures.length||(diagnostics.errors||[]).length)throw new Error(JSON.stringify({console:failures,errors:diagnostics.errors}));
 results.push({url:route.url,ok:true,title:headings.title,headings:headings.nodes.filter(n=>n.role==='heading').length});
 }catch(error){results.push({url:route.url,ok:false,error:String(error)});}
 if(results.length%25===0)console.log(`Canvas ${results.length}/${routes.length}, failures ${results.filter(r=>!r.ok).length}`);
}
await writeFile('.wellwon/canvas/nsp-runtime-audit.json',JSON.stringify({instance:process.env.WW_TEST_ID,origin,results},null,2));
console.log(`Canvas: ${results.filter(r=>r.ok).length}/${routes.length} hydrated with accessible headings and no runtime errors.`);
const failed=results.filter(r=>!r.ok);if(failed.length){console.error(failed);process.exitCode=1;}
