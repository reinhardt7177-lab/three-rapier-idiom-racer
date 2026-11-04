"""Refine saved v6 cars in place without changing chassis/tyre geometry or rig.

Reproducible and idempotent. Sources retain separate editable parts; only the
export copy is batched. No external textures, licences, or manufacturing logos.
"""
import bpy, sys, json, math, hashlib
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from web_meshes import web_meshes
IDS=['supra','slk','mustang','porsche911','gtr','rx7','m3','huracan']
if '--only' in sys.argv: IDS=sys.argv[sys.argv.index('--only')+1].split(',')
OUT=ROOT/'artifacts/vehicle-finish-20261013'
OUT.mkdir(parents=True,exist_ok=True)

def material(name,color,metal,rough,coat=0):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
 m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF')
 n.inputs['Base Color'].default_value=(*color,1)
 n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
 n.inputs['Coat Weight'].default_value=coat;n.inputs['Coat Roughness'].default_value=.12
 return m

def rig():
 return {o.name:[float(x) for row in o.matrix_world for x in row] for o in bpy.context.scene.objects if o.name.startswith(('Wheel_','Steering_','Suspension_')) or o.name=='Chassis_Rig'}

def positions(o):
 return hashlib.sha256(b''.join(bytes(f'{tuple(v.co)}','ascii') for v in o.data.vertices)).hexdigest()

def triangulated():
 return sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')

def batch_split_spokes():
 # Preserve separately editable source spokes, but join their coloured export
 # copy per mechanical parent so a wheel needs one draw, not twenty.
 for code in ['FL','FR','RL','RR']:
  wheel=bpy.data.objects['Wheel_'+code]
  spokes=[o for o in list(wheel.children) if o.type=='MESH' and 'Forged V6 swept spoke' in o.name]
  if len(spokes)<2:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in spokes:o.select_set(True)
  bpy.context.view_layer.objects.active=spokes[0]
  bpy.ops.object.join();bpy.context.object.name='Finish_SplitSpokes_'+code
  bpy.context.object['dynamic']=True # Preserve COLOR_0 in runtime batching.

def simplify_port(o):
 # Same local bounds, 16-sided black insert in place of a tiny bevelled cylinder.
 # Flat circular silhouette remains smooth at its <1cm actual diameter.
 old=o.data;coords=[v.co for v in old.vertices]
 lo=Vector(tuple(min(v[i] for v in coords) for i in range(3)))
 hi=Vector(tuple(max(v[i] for v in coords) for i in range(3)))
 center=(lo+hi)*.5;radius=max(hi.x-lo.x,hi.y-lo.y)*.5
 verts=[(center.x,center.y,hi.z)]
 verts.extend((center.x+radius*math.cos(a*math.tau/16),center.y+radius*math.sin(a*math.tau/16),hi.z) for a in range(16))
 faces=[(0,i+1,(i+1)%16+1) for i in range(16)]
 mesh=bpy.data.meshes.new(o.name+'_compact');mesh.from_pydata(verts,[],faces);mesh.update()
 for m in old.materials:mesh.materials.append(m)
 o.data=mesh
 if old.users==0:bpy.data.meshes.remove(old)

report=[]
for id in IDS:
 source=ROOT/f'assets-sources/vehicles-v6/{id}.blend'
 bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.view_layer.update()
 before=rig();tri_before=triangulated()
 protected={o.name:positions(o) for o in bpy.context.scene.objects if o.type=='MESH' and (o.name.startswith('Tire_') or 'body' in o.name.lower() or 'QuadShell' in o.name)}
 chassis=bpy.data.objects['Chassis_Rig']
 already=chassis.get('vehicle_finish_revision')==1
 lamp=material('Finish_LampPolymer',(.008,.012,.019),.02,.08,.85)
 mirror=material('Finish_MirrorSilver',(.55,.59,.63),.95,.10)
 carbon=material('Finish_CarbonWeave',(.018,.024,.033),.22,.38,.35)
 machined=material('Finish_MachinedAlloy',(.36,.40,.45),.92,.22,.25)
 graphite=material('Finish_WheelGraphite',(.055,.062,.075),.82,.31,.3)
 alloy=material('Finish_TwoToneAlloy',(1,1,1),.88,.27,.3)
 bsdf=alloy.node_tree.nodes.get('Principled BSDF')
 attribute=alloy.node_tree.nodes.get('FinishColor')
 if not attribute:
  attribute=alloy.node_tree.nodes.new('ShaderNodeVertexColor');attribute.name='FinishColor';attribute.layer_name='FinishColor'
 alloy.node_tree.links.new(attribute.outputs['Color'],bsdf.inputs['Base Color'])
 glass_objects=0;carbon_objects=0;split_spokes=0;compact_ports=0;smooth_objects=0
 for o in list(bpy.context.scene.objects):
  if o.type!='MESH':continue
  name=o.name.lower();mats=[m for m in o.data.materials if m]
  if 'rotor drilled port' in name:
   if not already:simplify_port(o)
   compact_ports+=1
  # Opaque lamp lenses and mirror inserts no longer share window glazing.
  if 'mirror' in name and (any('Glass' in m.name for m in mats) or any('MirrorSilver' in m.name for m in mats)):
   o.data.materials.clear();o.data.materials.append(mirror);glass_objects+=1
  elif any('Smoked lamp polymer' in m.name or 'LampPolymer' in m.name for m in mats) or ('lamp' in name and ('lens' in name or 'smoked' in name)):
   o.data.materials.clear();o.data.materials.append(lamp);glass_objects+=1
  if any(term in name for term in ['splitter','diffuser','aero strake','side skirt','engine louver']):
   if all('NewPaint' not in m.name for m in mats):
    o.data.materials.clear();o.data.materials.append(carbon);carbon_objects+=1
  if 'forged v6 swept spoke' in name:
   # Outward polished face, darker sculpted sides. Retain existing topology,
   # edges and shape; slots batch by material during web export.
   o.data.materials.clear();o.data.materials.append(alloy)
   colors=o.data.color_attributes.get('FinishColor') or o.data.color_attributes.new(name='FinishColor',type='FLOAT_COLOR',domain='CORNER')
   side=-1 if o.parent.name.endswith('R') else 1
   rotation=o.matrix_local.to_3x3()
   for p in o.data.polygons:
    cut=(rotation@p.normal).normalized().x*side>.72
    color=(.36,.40,.45,1) if cut else (.055,.062,.075,1)
    p.material_index=0
    for loop in p.loop_indices:colors.data[loop].color=color
   o['dynamic']=True
   split_spokes+=1
  if any('NewPaint' in m.name or 'Glass' in m.name for m in mats):
   # Explicit normals prevent flat polygons in glazed/cabin curved panels.
   # Sharp edges already authored into the shell remain split by Blender.
   for p in o.data.polygons:p.use_smooth=True
   smooth_objects+=1
 # Preserve authored paint hue; align saved source coatings with runtime.
 for m in bpy.data.materials:
  if not m.users or not m.use_nodes:continue
  n=m.node_tree.nodes.get('Principled BSDF')
  if n and 'NewPaint' in m.name:
   n.inputs['Metallic'].default_value=.34;n.inputs['Roughness'].default_value=.26
   n.inputs['Coat Weight'].default_value=.8;n.inputs['Coat Roughness'].default_value=.16
  elif n and 'Glass' in m.name:
   n.inputs['Metallic'].default_value=.02;n.inputs['Roughness'].default_value=.2
   n.inputs['Coat Weight'].default_value=.35;n.inputs['Coat Roughness'].default_value=.18
 bpy.context.view_layer.update()
 assert before==rig(),f'{id}: rig moved'
 assert all(positions(bpy.data.objects[n])==sha for n,sha in protected.items()),f'{id}: protected shell/tyre moved'
 assert all(math.isfinite(x) for o in bpy.context.scene.objects if o.type=='MESH' for v in o.data.vertices for x in v.co)
 chassis['vehicle_finish_revision']=1
 # Some restored sources carry glTF system extras. Blender gives these
 # precedence over regular custom props, including newly added properties.
 properties=chassis.bl_system_properties_get()
 if properties is not None:
  for key in chassis.keys():properties[key]=chassis[key]
 bpy.context.preferences.filepaths.save_version=0
 bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
 tri_after=triangulated();batch_split_spokes();meshes=web_meshes()
 dest=ROOT/f'public/assets/rebuild/{id}.glb'
 bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',export_extras=True,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
 assert dest.stat().st_size<1_000_000
 row={'id':id,'alreadyPolished':already,'sourceBytes':source.stat().st_size,'glbBytes':dest.stat().st_size,'trianglesBefore':tri_before,'trianglesAfter':tri_after,'exportMeshes':meshes,'rigBefore':before,'rigAfter':rig(),'protectedGeometry':protected,'lensMirrorParts':glass_objects,'carbonParts':carbon_objects,'splitSpokes':split_spokes,'compactPorts':compact_ports,'smoothPanels':smooth_objects}
 report.append(row);print('FINISH',id,dest.stat().st_size,tri_before,tri_after,flush=True)
(OUT/'blender-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
