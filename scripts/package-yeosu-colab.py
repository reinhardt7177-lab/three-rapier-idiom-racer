"""Only task sources/geometry are sent; never include secrets or user notes."""
import json,zipfile,hashlib,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
proof=ROOT/'artifacts/yeosu-map-traffic-20261012'
changed=subprocess.check_output(['git','diff','--name-only'],cwd=ROOT,text=True).splitlines()
allowed=[p for p in changed if p.startswith(('src/','scripts/','public/','assets-sources/yeosu/')) or p=='package.json']
allowed+=['src/rebuild/roadTraffic.js','src/rebuild/trafficView.js','scripts/yeosu-map.test.mjs','scripts/traffic-controls.test.mjs','scripts/blender/yeosu_map_geometry.py']
allowed += [p.relative_to(ROOT).as_posix() for base in ['src','scripts'] for p in (ROOT/base).rglob('*') if p.is_file() and p.suffix in ['.js','.jsx','.mjs','.py','.css']]
allowed += [p.relative_to(ROOT).as_posix() for p in (ROOT/'assets-sources/yeosu/map').glob('*') if p.is_file()]
allowed += [p.relative_to(ROOT).as_posix() for p in (proof/'yeosu').glob('*') if p.is_file()]
allowed=list(dict.fromkeys(allowed));manifest=[]
target=proof/'mumu-yeosu-patch.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as archive:
    for rel in allowed:
        data=(ROOT/rel).read_bytes();archive.writestr(rel,data)
        manifest.append({'path':rel,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    archive.writestr('task-inputs.json',json.dumps(manifest,indent=2))
(proof/'task-inputs.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps({'files':len(manifest),'zipBytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}))
