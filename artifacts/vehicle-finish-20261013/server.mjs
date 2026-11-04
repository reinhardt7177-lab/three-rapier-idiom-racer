import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:5301,strictPort:true,hmr:false}});
await server.listen();console.log('Vehicle polish QA: http://127.0.0.1:5301');
