import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {cpSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

export default defineConfig(({command})=>({
  publicDir:command==='build'?false:'public',
  plugins: [react(),{name:'rebuild-assets-only',closeBundle(){
    if(command!=='build')return;
    const out=resolve('dist/assets/rebuild');mkdirSync(out,{recursive:true});
    cpSync(resolve('public/assets/rebuild'),out,{recursive:true});
    cpSync(resolve('public/assets/audio'),resolve('dist/assets/audio'),{recursive:true});
  }}],
  build:{rollupOptions:{output:{manualChunks:{physics:['@dimforge/rapier3d-compat'],three:['three'],react:['react','react-dom/client']}}}}
}));
