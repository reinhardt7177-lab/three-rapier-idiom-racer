import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];rows=[]
for id,prefix in [('supra','Sculpted headlamp lens'),('huracan','V6 Recessed polygon lamp housing')]:
 bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'assets-sources/vehicles-v6/{id}.blend'))
 objects=[o for o in bpy.context.scene.objects if o.name.startswith(prefix)]
 assert len(objects)==2
 def bounds(o):
  pts=[o.matrix_world@Vector(p) for p in o.bound_box]
  return [min(p[a] for p in pts) for a in range(3)],[max(p[a] for p in pts) for a in range(3)]
 objects.sort(key=lambda o:bounds(o)[0][0]);left,right=[bounds(o) for o in objects]
 error=max(abs(left[0][0]+right[1][0]),abs(left[1][0]+right[0][0]),*[abs(left[b][a]-right[b][a]) for b in [0,1] for a in [1,2]])
 assert error<.003,(id,error)
 rows.append({'id':id,'left':left,'right':right,'maxMirrorErrorMetres':error,'dataBlocksIndependent':objects[0].data!=objects[1].data})
(ROOT/'artifacts/vehicle-polish-3pass-20261015/symmetry.json').write_text(json.dumps(rows,indent=2))
