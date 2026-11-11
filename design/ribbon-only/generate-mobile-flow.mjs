import fs from 'node:fs';
const original=fs.readFileSync('public/images/ribbon-only/satin-desktop-strip.svg','utf8');
const image=original.match(/href="([^"]+)"/)[1];
const curves=[[-50,-45,40,20,26,105,16,190],[16,190,6,270,-10,438,38,439],[38,439,100,440,294,420,355,565],[355,565,423,727,310,731,350,820],[350,820,369,862,414,903,445,945]];
const path='M-50 -45 C40 20 26 105 16 190 C6 270 -10 438 38 439 C100 440 294 420 355 565 C423 727 310 731 350 820 C369 862 414 903 445 945';
const points=[];
for(const c of curves)for(let k=0;k<151;k++){const t=k/150,u=1-t;points.push([u*u*u*c[0]+3*u*u*t*c[2]+3*u*t*t*c[4]+t*t*t*c[6],u*u*u*c[1]+3*u*u*t*c[3]+3*u*t*t*c[5]+t*t*t*c[7]]);}
const strips=[];
for(let i=0;i<points.length-1;i++){
 const [x,y]=points[i], [nx,ny]=points[i+1];const length=Math.hypot(nx-x,ny-y);if(length<.01)continue;
 const a=Math.atan2(ny-y,nx-x)*180/Math.PI;
 strips.push(`<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${a.toFixed(2)})"><svg x="-.3" y="-6" width="${(length+.6).toFixed(2)}" height="12" viewBox="550 338 8 19" preserveAspectRatio="none"><use href="#satin-texture"/></svg></g>`);
}
fs.writeFileSync('public/images/ribbon-only/satin-mobile-original-flow.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 900" preserveAspectRatio="none"><defs><image id="satin-texture" href="${image}" width="2172" height="724"/><filter id="shadow" x="-30%" y="-10%" width="160%" height="120%"><feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-color="#54402a" flood-opacity=".24"/></filter><linearGradient id="satin"><stop stop-color="#ab4c1d"/><stop offset=".3" stop-color="#e99150"/><stop offset=".6" stop-color="#c5662e"/><stop offset="1" stop-color="#d87a3b"/></linearGradient></defs><g filter="url(#shadow)"><path d="${path}" fill="none" stroke="#9c491f" stroke-width="13"/><path d="${path}" fill="none" stroke="url(#satin)" stroke-width="12"/>${strips.join('')}</g></svg>`);
