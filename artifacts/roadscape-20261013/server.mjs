import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:5298,strictPort:true,hmr:false,watch:null}});
await server.listen();console.log('Roadscape QA http://127.0.0.1:5298 (no hot reload or watcher)');
