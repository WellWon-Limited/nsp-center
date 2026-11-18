import {webpPlugin} from '../../scripts/webp-plugin.mjs';
import { defineConfig } from 'vite';
import {fileURLToPath} from 'node:url';
import {ADMIN_PATH} from '../../packages/domain/admin-path.mjs';
import {createApiClient} from '../../scripts/api-client.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({root,publicDir:'../../public',
  plugins:[webpPlugin(),{name:'nsp-api-proxy',configureServer(server){
    const api=createApiClient();
    server.middlewares.use((req,res,next)=>{
      if(req.url?.split('?')[0]===ADMIN_PATH){res.writeHead(302,{Location:new URL(req.url,process.env.ADMIN_ORIGIN||'http://127.0.0.1:5218').href});res.end();}
      else if(req.url?.startsWith('/api/'))api.proxy(req,res);
      else next();
    });
  }}],
  server:{host:'127.0.0.1',port:5217,strictPort:true},
  preview:{host:'127.0.0.1',port:5217,strictPort:true},
  build:{outDir:'../../dist',emptyOutDir:true,cssCodeSplit:false,chunkSizeWarningLimit:1600}
});
