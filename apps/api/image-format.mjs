import sharp from 'sharp';
/** Decode actual pixels, normalize orientation, retain alpha and encode WebP. */
export async function encodeWebp(bytes,{document=false}={}){
 const image=sharp(bytes,{limitInputPixels:40_000_000,animated:true});
 const meta=await image.metadata();
 if(!['jpeg','png','webp','gif'].includes(meta.format))throw Error('Unsupported image');
 return image.rotate().webp(document?{lossless:true,effort:4}:{quality:90,alphaQuality:100,effort:4}).toBuffer();
}
