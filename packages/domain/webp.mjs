// Local presentation URLs only. Original source/catalog paths remain recoverable.
const local=/^\/(?:images|media|prototype)\/[^?#]+\.(?:jpe?g|png|gif)(?=[?#]|$)/i;
export function webpUrl(value){
 if(typeof value!=='string')return value;
 if(/^\/api\/files\/[a-f0-9]{32}$/.test(value))return value+'.webp';
 if(!local.test(value))return value;
 return value.replace(local,path=>'/webp'+path.replace(/\.(?:jpe?g|png|gif)$/i,'.webp'));
}
export function webpReferences(text){
 return text.replace(/(?:(?:https?:)?\/\/[^\s"'<>\\)]+|\/webp\/[^\s"'<>\\)]+|\/api\/files\/[a-f0-9]{32}(?:\.webp)?|\/(?:images|media|prototype)\/[^\s"'<>\\)]+\.(?:jpe?g|png|gif)(?:[?#][^\s"'<>\\)]*)?)/gi,value=>webpUrl(value));
}
export const webpContent=value=>value===undefined?undefined:JSON.parse(webpReferences(JSON.stringify(value)));
