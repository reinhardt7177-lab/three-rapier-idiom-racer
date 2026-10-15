import test from 'node:test';
test('one',async()=>{console.log('START one',Date.now());await new Promise(r=>setTimeout(r,500));console.log('END one',Date.now());});
