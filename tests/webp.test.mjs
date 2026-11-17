import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {webpUrl,webpReferences} from '../packages/domain/webp.mjs';
import {encodeWebp} from '../apps/api/image-format.mjs';
import {productCover} from '../src/product-media.mjs';

test('WebP URLs are idempotent, preserve source URLs and leave external images and vectors alone',()=>{
 const source='/images/photo.png';const result='/webp/images/photo.webp';
 assert.equal(webpUrl(source),result);assert.equal(webpUrl(result),result);
 for(const url of ['https://cdn.example/images/a.png','//cdn.example/images/a.png','/icons/app.png','/images/mask.svg','/api/files/123','/images/photo.webp'])assert.equal(webpUrl(url),url);
 const input=`<img src="${source}"><img src="https://cdn.example/images/a.png"><div style="background:url('/images/banner.jpg')"></div>`;
 const output=webpReferences(input);assert.ok(output.includes(result));assert.ok(output.includes('/webp/images/banner.webp'));assert.ok(output.includes('https://cdn.example/images/a.png'));assert.equal(webpReferences(output),output);assert.equal(webpReferences('//cdn.example/images/a.png'),'//cdn.example/images/a.png');
});
test('uploaded photos become actual WebP; certificate pixels and alpha remain intact',async()=>{
 const png=await sharp({create:{width:8,height:6,channels:4,background:{r:20,g:150,b:100,alpha:.5}}}).png().toBuffer();
 const output=await encodeWebp(png,{document:true});const meta=await sharp(output).metadata();
 assert.equal(meta.format,'webp');assert.equal(meta.width,8);assert.equal(meta.height,6);assert.equal(meta.hasAlpha,true);
 assert.deepEqual(await sharp(output).raw().toBuffer(),await sharp(png).raw().toBuffer());
 await assert.rejects(encodeWebp(Buffer.from('not an image')));
});
test('all catalog covers resolve to existing genuine WebP with preserved dimensions',async()=>{
 const products=JSON.parse(readFileSync('packages/catalog/generated/public.json','utf8')).products;
 const manifest=JSON.parse(readFileSync('public/webp/manifest.json','utf8'));
 for(const p of products){const url=productCover(p);assert.match(url,/\.webp$/);assert.doesNotMatch(url,/\.(png|jpe?g|gif)\.webp$/);assert.ok(existsSync('public'+url),url);const meta=await sharp('public'+url).metadata();assert.equal(meta.format,'webp',url);
  const original=Object.values(manifest.entries).find(e=>e.url===url);if(original){assert.equal(meta.width,original.width,url);assert.equal(meta.height,original.height,url);assert.equal(meta.hasAlpha,original.alpha,url);}
 }
});

test('prerendered image URLs and built CSS reference WebP instead of local raster originals',()=>{
 for(const dir of ['dist/assets','dist-admin/assets'])for(const file of readdirSync(dir).filter(f=>f.endsWith('.css'))){const css=readFileSync(dir+'/'+file,'utf8');assert.equal(webpReferences(css),css,dir+'/'+file);}
 const manifest=JSON.parse(readFileSync('dist/prerender-manifest.json','utf8'));
 for(const route of manifest.routes){const html=readFileSync('dist/'+route.file,'utf8');
  for(const [,url] of html.matchAll(/<img[^>]+src="([^"]+)"/g))assert.equal(webpUrl(url),url,route.url+' '+url);
 }
});
