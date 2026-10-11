import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
const previous=JSON.parse(fs.readFileSync('artifacts/visual-polish-20261011/frozen-check-evidence.json','utf8')).hashes;
const changed=['src/rebuild/runtime.js','src/rebuild/frozenComparison.js','scripts/render-timing.test.mjs'];
const hashes=Object.fromEntries(Object.keys(previous).map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const files=Object.fromEntries(changed.map(p=>[p,fs.readFileSync(p).toString('base64')]));
const payload=zlib.gzipSync(JSON.stringify({hashes,files})).toString('base64');
const code=`import json,gzip,base64,pathlib,hashlib,subprocess,sys
root=pathlib.Path('/content/mumu-racing-visual-20261011-check1')
assert (root/'node_modules').is_dir(), 'Existing remote workspace missing'
data=json.loads(gzip.decompress(base64.b64decode('${payload}')))
for p,b in data['files'].items():
 dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(base64.b64decode(b))
bad=[p for p,h in data['hashes'].items() if not (root/p).exists() or hashlib.sha256((root/p).read_bytes()).hexdigest()!=h]
assert not bad,bad
(root/'ghost-pass-input-hashes.json').write_text(json.dumps(data['hashes']))
runner="""import os,json,time,subprocess,pathlib,hashlib
root=pathlib.Path('/content/mumu-racing-visual-20261011-check1')
expected=json.loads((root/'ghost-pass-input-hashes.json').read_text())
start=time.time()
env=dict(os.environ);env['PATH']='/tools/node/bin:'+env.get('PATH','')
with (root/'ghost-pass-check.log').open('w') as log:
 result=subprocess.run(['npm','run','check'],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
(root/'ghost-pass-check-result.json').write_text(json.dumps({'exitCode':result.returncode,'seconds':time.time()-start,'hashes':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in expected},'compute':'Colab CPU'}))
"""
(root/'ghost-pass-check-runner.py').write_text(runner)
job=subprocess.Popen([sys.executable,str(root/'ghost-pass-check-runner.py')],start_new_session=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print(json.dumps({'started':True,'pid':job.pid,'hashes':len(data['hashes']),'compute':'Colab CPU'}))
`;
fs.writeFileSync('artifacts/ghost-pass-20261011/check-input-hashes.json',JSON.stringify(hashes,null,2));
fs.writeFileSync('artifacts/ghost-pass-20261011/colab-launch.py',code);
console.log(JSON.stringify({hashes:Object.keys(hashes).length,changed,cellBytes:Buffer.byteLength(code)}));
