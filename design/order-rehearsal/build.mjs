import {build} from 'vite';
import {resolve} from 'node:path';
import {webpPlugin} from '../../scripts/webp-plugin.mjs';
for(const [entry,outDir,name] of [['web.tsx','dist/__qa','controls'],['admin.tsx','dist/__qa/admin','admin'],['payment.tsx','dist/__qa/payment','payment']]){
 await build({configFile:false,root:process.cwd(),publicDir:false,plugins:[webpPlugin()],define:{'process.env.NODE_ENV':'"production"'},build:{outDir,emptyOutDir:false,cssCodeSplit:false,lib:{entry:resolve('design/order-rehearsal',entry),formats:['es'],fileName:()=>name+'.js',cssFileName:'style'},rollupOptions:{output:{assetFileNames:asset=>asset.name?.endsWith('.css')?'style.css':'assets/[name]-[hash][extname]'}}}});
}
await import('./render.mjs');
await import('./payment-render.mjs');
await import('./sequence.mjs');
await import('./admin-review.mjs');
