from pathlib import Path
import subprocess, time, json, shutil, hashlib, sys
root=Path.cwd(); dest=root/'artifacts/vehicle-motion-20261012'
manifest=json.loads((dest/'before-test-evidence/manifest.json').read_text())
started=time.time()
with (dest/'full-check.log').open('w',encoding='utf-8') as log:
    result=subprocess.run(['cmd','/c','npm','run','check'],cwd=root,stdout=log,stderr=subprocess.STDOUT)
reports=[]
for item in manifest:
    path=root/item['path']; save=dest/'final-test-evidence'/item['path']
    if path.exists():
        save.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,save)
        reports.append({'path':item['path'],'rawEvidence':str(save.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    if item['existed']:
        shutil.copy2(dest/'before-test-evidence'/item['path'],path)
        assert hashlib.sha256(path.read_bytes()).hexdigest()==item['sha256']
summary={'execution':'Local Windows CPU / Rapier WASM, no Colab connection','seconds':round(time.time()-started,2),'exitCode':result.returncode,'previousEvidenceRestored':True,'reports':reports,'note':'Some legacy test writers label device Colab CPU unconditionally. Raw outputs are preserved; this metadata identifies the actual local execution. No numerical results were relabeled or filtered.'}
(dest/'full-check-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k!='reports'},ensure_ascii=False))
sys.exit(result.returncode)
