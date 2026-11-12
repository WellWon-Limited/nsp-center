import { defineConfig } from 'vite';
export default defineConfig({server:{host:'127.0.0.1',port:5217,strictPort:true},preview:{host:'127.0.0.1',port:5217,strictPort:true},build:{cssCodeSplit:false,chunkSizeWarningLimit:1600,rollupOptions:{input:{main:'index.html'}}}});
