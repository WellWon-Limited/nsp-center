// Shared by the installation offer and the profile card; a phone-sized browser is not an installed application.
export function runningAsApp(env){
 return env.navigator.standalone===true||['standalone','minimal-ui'].some(mode=>env.matchMedia(`(display-mode: ${mode})`).matches);
}
/** Handsets only: narrowing a desktop browser must not enable installation offers. */
export function installationOnPhone(nav){
 const ua=nav.userAgent||'';
 return /iphone/i.test(ua)||/android/i.test(ua)&&/mobile/i.test(ua);
}
export function installationPlatform(nav){
 const ua=nav.userAgent||'';
 if(/iphone|ipad|ipod/i.test(ua)||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1))return 'ios';
 if(/android/i.test(ua))return 'android';
 if(/Edg\//.test(ua))return 'edge';
 if(/Chrome|Chromium|OPR\//.test(ua))return 'chromium';
 if(/Macintosh|MacIntel/i.test(ua+' '+nav.platform)&&/Safari\//.test(ua))return 'mac-safari';
 return 'other';
}
export async function relatedAppInstalled(env){
 if(runningAsApp(env))return true;
 if(typeof env.navigator.getInstalledRelatedApps!=='function')return false;
 try{
  const apps=await env.navigator.getInstalledRelatedApps();
  const manifest=new URL('/manifest.webmanifest',env.location.href).href;
  const id=new URL('/',env.location.href).href;
  return Array.isArray(apps)&&apps.some(app=>app.platform==='webapp'&&((app.url&&new URL(app.url,env.location.href).href===manifest)||(app.id&&new URL(app.id,env.location.href).href===id)));
 }catch{return false;}
}
