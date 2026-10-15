import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
out={}
for id in ['supra','huracan']:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets-sources/vehicles-v6/{id}.blend'))
 rows=[]
 for o in bpy.context.scene.objects:
  if o.type!='MESH' or o.parent is None or o.parent.name!='Chassis_Rig':continue
  if not any(t in o.name.lower() for t in ['body','headlamp','projector','bridge','return','splitter','ducktail','lamp housing','y daytime']):continue
  pts=[o.matrix_world@Vector(v) for v in o.bound_box]
  rows.append({'name':o.name,'lo':[min(p[a] for p in pts) for a in range(3)],'hi':[max(p[a] for p in pts) for a in range(3)],'modifiers':[m.type for m in o.modifiers]})
 out[id]=rows
(ROOT/'artifacts/vehicle-polish-3pass-20261015/source-bounds.json').write_text(json.dumps(out,indent=2))
