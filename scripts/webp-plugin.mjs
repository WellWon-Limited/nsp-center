import {webpReferences} from '../packages/domain/webp.mjs';
/** Apply one URL policy to CSS, JS/TS/JSX, JSON and HTML, in dev, SSR and production. */
export function webpPlugin(){return {name:'nsp-webp',enforce:'pre',
 transform(code,id){if(/\/(?:apps\/(?:web|admin)|packages\/(?:presentation|catalog))\//.test(id)&&/\.(?:[cm]?[jt]sx?|json|css)(?:\?|$)/.test(id))return {code:webpReferences(code),map:null}},
 transformIndexHtml(html){return webpReferences(html)}
}}
