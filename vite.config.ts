import { defineConfig } from 'vite';
import {createApiClient} from './scripts/api-client.mjs';
export default defineConfig({
  plugins:[{name:'nsp-api-proxy',configureServer(server){
    const api=createApiClient();
    server.middlewares.use((req,res,next)=>{
      if(req.url?.startsWith('/api/'))api.proxy(req,res);
      else next();
    });
  }}],
  server:{host:'127.0.0.1',port:5217,strictPort:true},
  preview:{host:'127.0.0.1',port:5217,strictPort:true},
  build:{cssCodeSplit:false,chunkSizeWarningLimit:1600,rollupOptions:{input:{main:'index.html'}}}
});
