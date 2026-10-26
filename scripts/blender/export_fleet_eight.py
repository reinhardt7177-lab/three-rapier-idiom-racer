"""Export saved sources; reconcile imported system extras with current rig props."""
import bpy,sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from web_meshes import web_meshes
ids=sys.argv[sys.argv.index('--only')+1].split(',') if '--only' in sys.argv else ['supra','slk','mustang','porsche911','gtr','rx7','m3','huracan']
version=sys.argv[sys.argv.index('--source-version')+1] if '--source-version' in sys.argv else '6'
if version != '6':raise ValueError('Current editable source revision: 6')
sources=ROOT/f'assets-sources/vehicles-v{version}'
destination=Path(sys.argv[sys.argv.index('--out')+1]) if '--out' in sys.argv else ROOT/'public/assets/rebuild'
destination.mkdir(parents=True,exist_ok=True)
for id in ids:
 bpy.ops.wm.open_mainfile(filepath=str(sources/f'{id}.blend'))
 changed=False
 for o in bpy.context.scene.objects:
  properties=o.bl_system_properties_get()
  if properties and o.get('vehicle_rig_version'):
   for key in o.keys():
    if key in properties and properties[key]!=o[key]:properties[key]=o[key];changed=True
 if changed:
  bpy.context.preferences.filepaths.save_version=0
  bpy.ops.wm.save_as_mainfile(filepath=str(sources/f'{id}.blend'),compress=True)
 print('Export source revision',id,[(o.name,o.get('vehicle_detail_version')) for o in bpy.context.scene.objects if o.get('vehicle_rig_version')],flush=True)
 web_meshes()
 bpy.ops.export_scene.gltf(filepath=str(destination/f'{id}.glb'),export_format='GLB',export_extras=True,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
