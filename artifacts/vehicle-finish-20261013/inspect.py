import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
report={}
for id in ['supra','slk','mustang','porsche911','gtr','rx7','m3','huracan']:
 bpy.ops.wm.open_mainfile(filepath=str(root/f'assets-sources/vehicles-v6/{id}.blend'))
 report[id]={'materials':[{'name':m.name,'nodes':[{'name':n.name,'values':{s.name:list(s.default_value) if hasattr(s.default_value,'__len__') else s.default_value for s in n.inputs if hasattr(s,'default_value') and s.name in ['Base Color','Metallic','Roughness','Coat Weight','Coat Roughness']}} for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED']} for m in bpy.data.materials if m.users],
 'objects':[{'name':o.name,'parent':o.parent.name if o.parent else None,'location':list(o.location),'dimensions':list(o.dimensions),'vertices':len(o.data.vertices),'polygons':len(o.data.polygons),'materials':[m.name if m else None for m in o.data.materials]} for o in bpy.context.scene.objects if o.type=='MESH']}
(root/'artifacts/vehicle-finish-20261013/source-inventory.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
