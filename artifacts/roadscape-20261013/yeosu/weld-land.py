import bpy,bmesh,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
PROOF=Path(__file__).resolve().parent
src=ROOT/'assets-sources/yeosu/roadscape.blend'
out=ROOT/'public/assets/rebuild/yeosu-roadscape.glb'
bpy.ops.wm.open_mainfile(filepath=str(src))
for ob in bpy.context.scene.objects:
    if ob.type!='MESH' or not ob.data.materials or ob.data.materials[0].name!='YeosuRoadscape_Land':continue
    ob['roadscapeFoundation']=True
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(ob.data);bm.free();ob.data.update()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(src),compress=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True)
report=json.loads((PROOF/'asset-report.json').read_text(encoding='utf-8'))
report['bytes']=out.stat().st_size;report['glbSha256']=hashlib.sha256(out.read_bytes()).hexdigest()
for m in report['meshes']:
    ob=bpy.data.objects[m['name']];ob.data.calc_loop_triangles();m['vertices']=len(ob.data.vertices);m['triangles']=len(ob.data.loop_triangles)
report['vertices']=sum(m['vertices'] for m in report['meshes']);report['triangles']=sum(m['triangles'] for m in report['meshes'])
(PROOF/'asset-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('WELDED_LAND',json.dumps({'bytes':report['bytes'],'vertices':report['vertices'],'triangles':report['triangles']}))
