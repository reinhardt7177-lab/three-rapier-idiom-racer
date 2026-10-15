import test from 'node:test';
test('two',async()=>{console.log('START two',Date.now());await new Promise(r=>setTimeout(r,500));console.log('END two',Date.now());});
