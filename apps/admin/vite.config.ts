import {webpPlugin} from '../../scripts/webp-plugin.mjs';
import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {createApiClient} from '../../scripts/api-client.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({root,publicDir:'../../public',
 plugins:[webpPlugin(),{name:'admin-runtime',transformIndexHtml(html){return html.replace('__NSP_SITE_ORIGIN__',process.env.SITE_ORIGIN||'http://127.0.0.1:5217')},configureServer(server){
  const api=createApiClient();server.middlewares.use((req,res,next)=>{if(req.url?.startsWith('/api/'))api.proxy(req,res);else next()});
 }}],
 server:{host:'127.0.0.1',port:Number(process.env.ADMIN_PORT||5218),strictPort:true},
 build:{outDir:'../../dist-admin',emptyOutDir:true,cssCodeSplit:false,chunkSizeWarningLimit:1600,manifest:true}
});
