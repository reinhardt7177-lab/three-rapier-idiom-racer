from pathlib import Path
import subprocess,time,json,shutil,hashlib,sys
root=Path.cwd();dest=root/'artifacts/race-duel-20261012'
paths=[
 'artifacts/championship-20261011/physical-series.json',
 'artifacts/engine-feel-20261010/physical-fleet.json',
 'artifacts/namak-20261010/physical-laps.json',
 'artifacts/namak-20261010/stationary-grid-rivals.json',
 'artifacts/content-resume-20261011/progression-race.json',
 'artifacts/content-resume-20261011/rain-races.json',
 'artifacts/rival-ai-20261010/full-course.json',
 'artifacts/content-resume-20261011/rival-personality-races.json',
 'artifacts/steering-turn-20261010/namak-player-lap.json',
 'artifacts/wall-recovery-20261011/namak-lap.json',
]
manifest=[]
for name in paths:
    p=root/name;item={'path':name,'existed':p.exists()}
    if p.exists():
        item['sha256']=hashlib.sha256(p.read_bytes()).hexdigest()
        backup=dest/'before-test-evidence'/name;backup.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,backup)
    manifest.append(item)
(dest/'before-test-evidence').mkdir(parents=True,exist_ok=True)
(dest/'before-test-evidence/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
shutil.copy2(dest/'duel-races.json',dest/'duel-races-first.json')
started=time.time()
with (dest/'full-check.log').open('w',encoding='utf-8') as log:
    result=subprocess.run(['cmd','/c','npm','run','check'],cwd=root,stdout=log,stderr=subprocess.STDOUT)
reports=[]
for item in manifest:
    path=root/item['path'];save=dest/'final-test-evidence'/item['path']
    if path.exists():
        save.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,save)
        reports.append({'path':item['path'],'rawEvidence':str(save.relative_to(root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    if item['existed']:
        shutil.copy2(dest/'before-test-evidence'/item['path'],path)
        assert hashlib.sha256(path.read_bytes()).hexdigest()==item['sha256']
summary={'execution':'Local Windows CPU / Rapier WASM, no Colab connection','seconds':round(time.time()-started,2),'exitCode':result.returncode,'previousEvidenceRestored':True,'reports':reports,'note':'Some old report writers hardcode Colab CPU. The raw results are preserved; this metadata records the actual local execution.'}
(dest/'full-check-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k!='reports'},ensure_ascii=False))
sys.exit(result.returncode)
