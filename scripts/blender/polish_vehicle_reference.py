"""Three measured reference passes on editable v6 cars; mechanical rigs untouched.

Pass 1: Huracan tapered nose (Supra nose trial rejected). Pass 2: authored
optical/trim detail. Pass 3: physically separated coatings. No photographic assets.
Each pass is idempotent and requires the previous pass. Backups live in artifacts.
"""
import bpy,sys,json,math,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from web_meshes import web_meshes
IDS=['supra','slk','mustang','porsche911','gtr','rx7','m3','huracan']
if '--only' in sys.argv:IDS=sys.argv[sys.argv.index('--only')+1].split(',')
PASS=int(sys.argv[sys.argv.index('--pass')+1])
if PASS not in [1,2,3]:raise ValueError('Pass must be 1, 2 or 3')
OUT=ROOT/'artifacts/vehicle-polish-3pass-20261015'

def digest(o):
 return hashlib.sha256(b''.join(bytes(str(tuple(v.co)),'ascii') for v in o.data.vertices)).hexdigest()

def mechanical():
 return {o.name:[float(x) for row in o.matrix_world for x in row] for o in bpy.context.scene.objects if o.name.startswith(('Wheel_','Steering_','Suspension_')) or o.name=='Chassis_Rig'}

def static(o):
 p=o
 while p:
  if p.name.startswith(('Wheel_','Steering_','Suspension_')):return False
  p=p.parent
 return True

def transform_mesh(o,fn):
 # Mirrored/instanced authored parts may share their data. World-space edits
 # must be unique before deformation or each shared copy receives the edit again.
 if o.data.users>1:o.data=o.data.copy()
 inv=o.matrix_world.inverted()
 for v in o.data.vertices:v.co=inv@Vector(fn(*(o.matrix_world@v.co)))
 o.data.update()

def material(name,color,metal,rough,coat=0,emission=0):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True
 n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1)
 n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
 n.inputs['Coat Weight'].default_value=coat;n.inputs['Coat Roughness'].default_value=.13
 if emission:n.inputs['Emission Color'].default_value=(*color,1);n.inputs['Emission Strength'].default_value=emission
 return m

def tube(name,pts,radius,mat,parent,sides=6):
 # A short optical light guide/trim bead, not an extra light or transparent pass.
 verts=[];faces=[]
 for i,p in enumerate(pts):
  tangent=(Vector(pts[min(i+1,len(pts)-1)])-Vector(pts[max(0,i-1)])).normalized()
  u=tangent.cross(Vector((0,0,1)))
  if u.length<.01:u=tangent.cross(Vector((0,1,0)))
  u.normalize();v=tangent.cross(u).normalized()
  for k in range(sides):verts.append(Vector(p)+radius*(u*math.cos(k*math.tau/sides)+v*math.sin(k*math.tau/sides)))
 for i in range(len(pts)-1):
  for k in range(sides):faces.append((i*sides+k,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,(i+1)*sides+k))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.materials.append(mat);mesh.update()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.parent=parent
 for p in mesh.polygons:p.use_smooth=True
 return o

def batch_spokes():
 for code in ['FL','FR','RL','RR']:
  wheel=bpy.data.objects['Wheel_'+code]
  spokes=[o for o in list(wheel.children) if o.type=='MESH' and 'Forged V6 swept spoke' in o.name]
  if len(spokes)<2:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in spokes:o.select_set(True)
  bpy.context.view_layer.objects.active=spokes[0];bpy.ops.object.join()
  bpy.context.object.name='Finish_SplitSpokes_'+code;bpy.context.object['dynamic']=True

report=[]
for id in IDS:
 source=ROOT/f'assets-sources/vehicles-v6/{id}.blend'
 bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.view_layer.update()
 chassis=bpy.data.objects['Chassis_Rig'];before=mechanical()
 tyres={o.name:digest(o) for o in bpy.context.scene.objects if o.type=='MESH' and not static(o)}
 previous=int(chassis.get('reference_polish_pass',0))
 if previous>=PASS:print('Already applied',id,PASS);continue
 if previous!=PASS-1:raise ValueError(f'{id}: previous pass missing')
 changed=[];added=[]
 if PASS==1:
  # Supra's curved-nose candidate failed visual inspection. Preserve the known
  # aligned body/housings rather than shipping the displaced optical geometry.
  if id=='supra':changed=['original body and lamp alignment retained after rejected nose trial']
  elif id=='huracan':
   def wedge(x,y,z):
    w=max(0,min(1,(-y-1.12)/1.11));w=w*w*(3-2*w)
    return (x*(1-.025*w),y+.09*w*min(1,(abs(x)/.85)**2),z-.025*w*max(0,min(1,(z-.5)/.3)))
   for o in bpy.context.scene.objects:
    if o.type=='MESH' and static(o):transform_mesh(o,wedge)
   changed=['tapered front corners','lower wedge leading edge']
 if PASS==2:
  lens=material('Finish_LampPolymer',(.008,.012,.019),.02,.08,.85)
  # Existing optical housing surfaces are smoothed but deliberate angular body
  # edges remain split. Trim uses already-exported materials to batch by parent.
  for o in bpy.context.scene.objects:
   if o.type!='MESH' or not static(o):continue
   low=o.name.lower()
   if ('lens' in low and 'mirror' not in low) or 'lamp housing' in low:
    for p in o.data.polygons:p.use_smooth=True
    changed.append(o.name)
  if id=='supra':
   # Six projector elements, as shown in the official 2025 brochure. Replace
   # only the ten authored LED discs; the housing/rig stays independently editable.
   originals=[o for o in bpy.context.scene.objects if o.name.startswith('LED projector')]
   led=originals[0].data.materials[0]
   for o in originals:bpy.data.objects.remove(o,do_unlink=True)
   for sign in [-1,1]:
    for i in range(6):
     x=.465+i*.051;y=-2.132+.12*(x-.49);z=.5972573
     bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=1,location=(sign*x,y,z))
     o=bpy.context.object;o.name='Reference six-lens projector';o.scale=(.017,.009,.015);o.parent=chassis;o.data.materials.append(led)
     for p in o.data.polygons:p.use_smooth=True
     added.append(o.name)
   # Matte dark mirrors, against a bright blue body, visible in the real photo.
   carbon=bpy.data.materials['Finish_CarbonWeave']
   for o in bpy.context.scene.objects:
    if o.type=='MESH' and o.name.startswith('Mirror housing'):o.data.materials.clear();o.data.materials.append(carbon)
  # Lower edge on the glass makes the seal readable, without clear glass that
  # reveals missing interiors. Existing material means no extra draw material.
  for code in ['FL','FR','RL','RR']:
   wheel=bpy.data.objects['Wheel_'+code];sign=-1 if code.endswith('L') else 1
   # Use the measured existing local wheel bounds, not a new nominal radius.
   inv=wheel.matrix_world.inverted();coords=[inv@(o.matrix_world@v.co) for o in wheel.children if o.type=='MESH' and o.name.startswith('Tire_') for v in o.data.vertices]
   if not coords:raise ValueError(f'{id}/{code}: tyre source missing')
   outer=(min(v.x for v in coords) if sign<0 else max(v.x for v in coords))
   radius=float(next(o['wheel_radius'] for o in bpy.context.scene.objects if o.get('wheel_radius')))*.78
   rubber=next(m for m in bpy.data.materials if m.name=='Rubber')
   pts=[(outer+sign*.0007,radius*math.cos(i*math.tau/64),radius*math.sin(i*math.tau/64)) for i in range(65)]
   added.append(tube('Reference sidewall mould bead',pts,.0018,rubber,wheel,4).name)
   # Short valve stem remains a child of the spinning wheel. Black rubber, no
   # text or tyre brands. Its sub-centimetre width is visible only close up.
   pts=[(outer+sign*.004,radius*.87,0),(outer+sign*.012,radius*.91,0)]
   added.append(tube('Reference wheel valve',pts,.003,rubber,wheel,6).name)
  if id=='supra':chassis['reference_projector_count']=12
  changed.append('optical lens smoothing and existing trim separation')
 if PASS==3:
  for m in bpy.data.materials:
   if not m.users or not m.use_nodes:continue
   n=m.node_tree.nodes.get('Principled BSDF')
   if not n:continue
   if 'Exterior_NewPaint' in m.name:
    n.inputs['Metallic'].default_value=.27;n.inputs['Roughness'].default_value=.3
    n.inputs['Coat Weight'].default_value=.95;n.inputs['Coat Roughness'].default_value=.12
   elif 'Glass' in m.name:
    n.inputs['Roughness'].default_value=.16;n.inputs['Metallic'].default_value=0
    n.inputs['Coat Weight'].default_value=.35
   elif m.name in ['Rubber','V6 Rubber']:
    n.inputs['Roughness'].default_value=.83;n.inputs['Metallic'].default_value=0
  changed=['separated clearcoat/base roughness','glass and rubber coating calibration']
 assert mechanical()==before,f'{id}: rig moved'
 assert all(digest(bpy.data.objects[n])==h for n,h in tyres.items()),f'{id}: mechanical geometry changed'
 chassis['reference_polish_pass']=PASS
 props=chassis.bl_system_properties_get()
 if props is not None:
  for k in chassis.keys():props[k]=chassis[k]
 bpy.context.preferences.filepaths.save_version=0
 bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
 batch_spokes();web_meshes()
 dest=ROOT/f'public/assets/rebuild/{id}.glb'
 bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',export_extras=True,export_animations=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
 row={'id':id,'pass':PASS,'changed':changed,'added':added,'rigBefore':before,'rigAfter':mechanical(),'mechanicalGeometry':tyres,'glbBytes':dest.stat().st_size}
 report.append(row);print('REFERENCE_PASS',PASS,id,row['glbBytes'],flush=True)
report_path=OUT/f'pass{PASS}-blender.json'
old=json.loads(report_path.read_text(encoding='utf-8')) if report_path.exists() else []
merged={r['id']:r for r in old};merged.update({r['id']:r for r in report})
report_path.write_text(json.dumps(list(merged.values()),indent=2),encoding='utf-8')
