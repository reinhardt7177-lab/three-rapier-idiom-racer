"""Use the configured Colab connector CLI; never print authentication state."""
import json,subprocess,base64,hashlib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PROOF=ROOT/'artifacts/yeosu-map-traffic-20261012'
BRIDGE_PY='E:/제미나이 코랩/.tools/colab-mcp/.venv/Scripts/python.exe'
BRIDGE_CLI='E:/제미나이 코랩/colab-codex-bridge/server/cli.py'
packet=(PROOF/'mumu-yeosu-patch.zip').read_bytes()
stage=sys.argv[1] if len(sys.argv)>1 else '1'
code="""# Verified task-only connector transfer; earlier notebook cells stay intact.
import base64,hashlib,zipfile,io,json,subprocess,sys
from pathlib import Path
blob=base64.b64decode(PACKET)
assert hashlib.sha256(blob).hexdigest()==DIGEST
r=Path('/content/mumu-racer-yeosu-20261012')
with zipfile.ZipFile(io.BytesIO(blob)) as archive:
 manifest=json.loads(archive.read('task-inputs.json'))
 for item in manifest:
  name=item['path'];data=archive.read(name)
  assert not name.startswith('/') and '..' not in Path(name).parts
  assert hashlib.sha256(data).hexdigest()==item['sha256'] and len(data)==item['bytes']
  target=r/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
(r/'artifacts/yeosu-map-traffic-20261012/remote-inputs.json').write_text(json.dumps(manifest,indent=2))
worker=r/'artifacts/yeosu-map-traffic-20261012/static-worker.py'
worker.write_text("from pathlib import Path\\nimport subprocess,json,time\\nr=Path('/content/mumu-racer-yeosu-20261012');p=r/'artifacts/yeosu-map-traffic-20261012'\\ns=time.monotonic()\\nwith (p/'static-1.log').open('w') as f:x=subprocess.run(['node','--test','--test-concurrency=1','scripts/yeosu-map.test.mjs','scripts/traffic-controls.test.mjs','scripts/korea-courses.test.mjs'],cwd=r,stdout=f,stderr=subprocess.STDOUT)\\n(p/'static-1-result.json').write_text(json.dumps({'exit':x.returncode,'seconds':time.monotonic()-s}))\\n")
log=(r/'artifacts/yeosu-map-traffic-20261012/static-worker.log').open('w')
job=subprocess.Popen([sys.executable,str(worker)],stdout=log,stderr=subprocess.STDOUT)
print(json.dumps({'filesVerified':len(manifest),'staticPID':job.pid,'device':'Colab CPU / Rapier WASM'}))
""".replace('PACKET',repr(base64.b64encode(packet).decode())).replace('DIGEST',repr(hashlib.sha256(packet).hexdigest()))
if stage!='1':code=code.replace('static-1','static-'+stage).replace('static-worker.py','static-worker-'+stage+'.py').replace('remote-inputs.json','remote-inputs-'+stage+'.json')
args={'name':'add_code_cell','arguments':{'cellIndex':30,'language':'python','code':code}}
result=subprocess.run([BRIDGE_PY,BRIDGE_CLI,'colab_call_notebook_tool'],input=json.dumps(args),capture_output=True,text=True,encoding='utf-8',timeout=230)
(PROOF/('connector-transfer-'+stage+'-response.json')).write_text(result.stdout,encoding='utf-8')
assert result.returncode==0,result.stderr[-500:]
value=json.loads(result.stdout)
def find_id(v):
 if isinstance(v,dict):
  if 'newCellId' in v:return v['newCellId']
  for x in v.values():
   result=find_id(x)
   if result:return result
 elif isinstance(v,list):
  for x in v:
   result=find_id(x)
   if result:return result
 elif isinstance(v,str):
  try:return find_id(json.loads(v))
  except (json.JSONDecodeError,TypeError):pass
cell=find_id(value);assert cell,'Connector did not return a new task cell ID'
(PROOF/('transfer-cell-'+stage+'.json')).write_text(json.dumps({'cellId':cell,'zipBytes':len(packet),'sha256':hashlib.sha256(packet).hexdigest()}),encoding='utf-8')
print(json.dumps({'cellId':cell,'bytes':len(packet)}))
