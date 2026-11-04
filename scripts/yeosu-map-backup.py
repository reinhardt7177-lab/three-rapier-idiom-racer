"""Preserve every product input touched by the actual-road course rebuild."""
import json, shutil, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PROOF=ROOT/'artifacts/yeosu-map-traffic-20261012'
paths=['scripts/blender/korea_course.py','scripts/blender/build_yeosu.py','src/rebuild/tracks.js',
       'src/rebuild/runtime.js','src/rebuild/course.js','src/rebuild/rivalPlanner.js','src/rebuild/raceDifficulty.js',
       'src/rebuild/raceRecords.js','src/rebuild/raceGhost.js','src/rebuild/main.jsx','src/rebuild/style.css',
       'src/rebuild/graphicsQuality.js','scripts/race-sim.mjs','scripts/korea-courses.test.mjs',
       'scripts/korea-medals.test.mjs','package.json','README.md','docs/NEXT_STEPS.md',
       'public/assets/rebuild/yeosu.glb','public/assets/rebuild/yeosu-route.json','assets-sources/yeosu/yeosu.blend']
manifest=[]
for name in paths:
    source=ROOT/name
    if not source.exists(): continue
    target=PROOF/'before'/name
    if target.exists(): continue
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,target)
    manifest.append({'path':name,'mtime':source.stat().st_mtime,'bytes':source.stat().st_size,'sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
(PROOF/'backup-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Backed up',len(manifest),'files')
