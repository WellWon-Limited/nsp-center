import sharp from 'sharp';
import {readdir,readFile,writeFile,mkdir,stat,unlink} from 'node:fs/promises';
import {join,dirname,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {webpUrl} from '../packages/domain/webp.mjs';
const target='public/webp',cachePath=target+'/manifest.json';
const policy='webp-q90-alpha100-effort5-v1';
let previous={};try{previous=JSON.parse(await readFile(cachePath,'utf8'))}catch{}
const files=[];
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true}).catch(()=>[])){const path=join(dir,item.name);if(item.isDirectory())await walk(path);else if(/\.(jpe?g|png|gif)$/i.test(item.name))files.push(path)}}
for(const dir of ['public/images','public/media','public/prototype'])await walk(dir);
files.sort();const outputs=new Set();for(const file of files){const url=webpUrl(file.slice(6));if(outputs.has(url))throw Error('Duplicate WebP filename: '+url);outputs.add(url)}
await mkdir(target,{recursive:true});
const entries={};let cursor=0,converted=0;
async function worker(){for(;;){const file=files[cursor++];if(!file)return;
 const input=await readFile(file),url=file.slice(6),output=webpUrl(url),dest='public'+output;
 const hash=createHash('sha256').update(policy).update(input).digest('hex');
 const cached=previous.entries?.[url];
 if(cached?.hash===hash){
  if((await stat(dest).catch(()=>null))?.size===cached.bytes){entries[url]={...cached,url:output};continue;}
  if(cached.url?.startsWith('/webp/')&&!cached.url.includes('..')&&(await stat('public'+cached.url).catch(()=>null))?.size===cached.bytes){await mkdir(dirname(dest),{recursive:true});await writeFile(dest,await readFile('public'+cached.url));entries[url]={...cached,url:output};continue;}
 }
 const image=sharp(input,{animated:true,limitInputPixels:64_000_000});
 const meta=await image.metadata();
 const bytes=await image.rotate().webp({quality:90,alphaQuality:100,effort:5}).toBuffer();
 await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes);
 entries[url]={url:output,hash,sourceBytes:input.length,bytes:bytes.length,width:meta.width,height:meta.height,alpha:Boolean(meta.hasAlpha)};
 converted++;
}}
await Promise.all([worker(),worker(),worker()]);
const ordered=Object.fromEntries(Object.keys(entries).sort().map(k=>[k,entries[k]]));
const totals=Object.values(entries).reduce((s,e)=>({source:s.source+e.sourceBytes,webp:s.webp+e.bytes}),{source:0,webp:0});
// Remove obsolete generated copies only; source originals are never removed.
for(const old of Object.values(previous.entries??{})){if(typeof old.url!=='string'||outputs.has(old.url)||!old.url.endsWith('.webp'))continue;const file=resolve('public'+old.url);if(file.startsWith(resolve(target)+sep))await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e})}
await writeFile(cachePath,JSON.stringify({policy,entries:ordered,totals},null,2)+'\n');
console.log(`WebP: ${files.length} files (${converted} converted); ${(totals.source/1048576).toFixed(1)} MiB -> ${(totals.webp/1048576).toFixed(1)} MiB.`);
