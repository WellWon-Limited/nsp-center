const sections=new Set(['service','answers','reading','reviews','company','contacts']);
// «Задать вопрос» under the story (the home consult band) comes back to that band (owner, 2026-11-12).
const places={consult:'/#home-consult'};
export function homeStoryReturn(url){
 const u=new URL(url,'http://nsp.local');
 if(u.searchParams.get('from')!=='home-about')return null;
 const section=u.searchParams.get('section');
 if(places[section])return places[section];
 return sections.has(section)?`/#about-${section}`:'/#home-about';
}
export function homeStoryLinks(html,section){
 if(!sections.has(section))return html;
 return html.replace(/href="([^"]+)"/g,(attribute,href)=>{
  if(!/^\/(?:blog\/(?:[^/?#]+\/)?|company\/(?:[^/?#]+\/)?|contacts\/)(?:[?#]|$)/.test(href))return attribute;
  const u=new URL(href,'http://nsp.local');
  u.searchParams.set('from','home-about');u.searchParams.set('section',section);
  return `href="${u.pathname}${u.search.replace(/&/g,'&amp;')}${u.hash}"`;
 });
}
