"""Add authored Namak architecture to the CURRENT saved source, preserving it.
Exports a separate visual layer; never rebuilds roads, physics or race data.
"""
import bpy,math,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
EVIDENCE=ROOT/'artifacts/namak-highdetail-20261013';EVIDENCE.mkdir(parents=True,exist_ok=True)
source=ROOT/'assets-sources/namak/namak.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
bpy.context.preferences.filepaths.save_version=0
collection=bpy.data.collections.new('Namak_Architecture_20261013');bpy.context.scene.collection.children.link(collection)
materials={}
for name,c,rough,metal in [('Stone',(.59,.62,.60),.82,0),('Ivory',(.78,.80,.76),.78,0),('Glass',(.075,.24,.29),.24,.12),('Roof',(.17,.30,.24),.85,0),('Timber',(.25,.16,.09),.9,0),('Metal',(.18,.22,.23),.45,.3)]:
 m=bpy.data.materials.new('Namak_Arch_'+name);m.diffuse_color=(*c,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal;materials[name]=m
buckets={};features=[]
def add(zone,kind,verts,faces):
 key=(zone,kind)
 if key not in buckets:buckets[key]=[[],[]]
 v,f=buckets[key];n=len(v);v.extend((x,-z,y) for x,y,z in verts);f.extend(tuple(n+i for i in face) for face in faces)
def box(zone,kind,x,y,z,w,h,d,yaw=0):
 c,s=math.cos(yaw),math.sin(yaw);v=[]
 for yy in [-h/2,h/2]:
  for xx,zz in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]:v.append((x+xx*c+zz*s,y+yy,z-xx*s+zz*c))
 faces=[(0,1,2,3),(7,6,5,4),(4,5,1,0),(5,6,2,1),(6,7,3,2),(7,4,0,3)]
 # Thin glazing has no visible cavity: paired panels avoid eight hidden tris.
 if kind=='Glass':
  if h<.1:faces=[faces[1]]
  elif d<=.4:faces=[faces[2],faces[4]]
  elif w<=.4:faces=[faces[3],faces[5]]
 add(zone,kind,v,faces)
def ring(zone,kind,x,z,rx,rz,w,y,h,start=0,end=math.tau,steps=40):
 for k in range(steps):
  a=start+(end-start)*k/steps;b=start+(end-start)*(k+1)/steps
  v=[(x+rr*math.cos(t),yy,z+ss*math.sin(t)) for yy in [y,y+h] for rr,ss in [(rx-w/2,rz-w/2),(rx+w/2,rz+w/2)] for t in [a,b]]
  faces=[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
  add(zone,kind,v,[tuple(reversed(f)) for f in faces])
# Blue civic tower: deep white side piers and continuous curtain-wall mullions.
for x in [348,382]:box('civic','Ivory',x,39,-97.8,1.5,76,.9)
for x in range(352,380,4):box('civic','Metal',x,40,-98.3,.12,72,.15)
for y in range(6,77,4):box('civic','Metal',365,y,-98.2,32,.12,.2)
for x in [347,383]:box('civic','Ivory',x,83,-112,1.8,7,28)
box('civic','Ivory',365,86.7,-112,40,1.4,30)
# Long straight civic facade; curved frontage belongs to the separate council.
for x in range(405,542,7):
 box('civic','Metal',x,11.5,-63.7,.14,8.6,.18)
for y in [8,11.5,15]:box('civic','Metal',470,y,-63.65,146,.14,.18)
# Separate council pavilion facing the reservoir, photo-inspired and scaled.
for k in range(22):
 a=math.pi*k/22;b=math.pi*(k+1)/22;t=(a+b)/2
 x=615+25*math.cos(t);z=-72+18*math.sin(t)
 width=math.hypot(25*(math.cos(b)-math.cos(a)),18*(math.sin(b)-math.sin(a)))+.06
 # Boxes align local X with the ellipse tangent.
 yaw=math.atan2(-18*(math.sin(b)-math.sin(a)),25*(math.cos(b)-math.cos(a)))
 box('civic','Glass',x,13.3,z,width,12.5,.35,yaw)
 box('civic','Ivory',x,6.6,z,width,.65,.8,yaw)
 box('civic','Roof',x,23.6,z,width+.15,.7,4.0,yaw)
 box('civic','Metal',x,13.3,z+.25,.14,12.5,.2)
 if k%2==0:box('civic','Ivory',x,3.05,z+1.9,.8,6.1,.8)
 for y in [9.2,12.4,15.6]:box('civic','Metal',x,y,z+.22,width,.12,.15,yaw)
# Open civic forecourt: reflecting basin, stone rim, paths and pergola.
box('plaza','Glass',440,.045,-33,36,.02,9)
for x in [421.5,458.5]:box('plaza','Stone',x,.22,-33,.5,.35,10)
for z in [-38,-28]:box('plaza','Stone',440,.22,z,37,.35,.5)
for x in range(500,576,7):
 box('plaza','Stone',x,.24,-28,4.8,.45,5)
 box('plaza','Roof',x,.56,-28,4.3,.25,4.3)
for x in [580,607]:
 for z in [-48,-32]:box('plaza','Timber',x,1.8,z,.35,3.6,.35)
for x in range(580,608,2):box('plaza','Timber',x,3.7,-40,.3,.25,18)
ring('lake','Timber',630,-154,95,68,4,.055,.07,steps=72)
# Housing: alternate recessed-looking end cores, stepped roof crowns and bays.
report=json.loads((ROOT/'artifacts/namak-20261010/map-report.json').read_text(encoding='utf-8'))
for i,b in enumerate(report['buildingFootprints']):
 name=b['name'];x,z,w,d,h,angle=[b[k] for k in ['x','z','w','d','h','angle']]
 c,s=math.cos(angle),math.sin(angle)
 zone='east' if x>750 else 'west' if x<0 else 'housing'
 def local(kind,xx,yy,zz,ww,hh,dd):box(zone,kind,x+xx*c+zz*s,yy,z-xx*s+zz*c,ww,hh,dd,angle)
 if 'Apartment' in name or 'Residential' in name:
  local('Stone',-w/2-.12,h/2,0,.24,h-1,d*.32)
  local('Roof' if i%3==0 else 'Stone',w/2+.18,h/2,0,.32,h-2,d*.38)
  local('Ivory',0,h+1.0,0,w*.56,1.8,d*.55)
  local('Stone',w*.23,h+2.7,0,4,2.0,4)
  for xx in [-w*.28,w*.28]:
   for side in [-1,1]:
    local('Ivory',xx,h/2,side*(d/2+.38),.3,h-.8,.72)
    for y in range(6,int(h)-1,6):local('Glass',xx,y,side*(d/2+.45),3.0,1.55,.12)
  # Side windows give the previously blank slab ends a readable stairwell.
  for y in range(5,int(h)-1,4):
   local('Glass',w/2+.38,y,0,.12,1.8,1.8)
 elif ('Shop' in name or 'Storefront' in name or 'StreetCafe' in name or 'RetailPodium' in name) and h<25:
  for k in range(max(2,int(w/7))):
   xx=-w/2+3.5+k*7;side=1
   local('Metal',xx-2.7,1.55,d/2+.23,.13,2.9,.17)
   local('Metal',xx+2.7,1.55,d/2+.23,.13,2.9,.17)
   local('Metal',xx+.8,1.5,d/2+.27,.15,2.8,.15)
   local('Ivory' if (k+i)%3 else 'Timber',xx,3.3,d/2+1.35,5.5,.20,2.6)
   local('Stone',xx,3.85,d/2+.25,5.4,.65,.2)
   local('Metal',xx+1.15,1.5,d/2+.38,.10,.45,.06)
  local('Stone',-w*.24,h+1,0,w*.22,1.7,d*.42)
  for xx in [-w*.22,w*.22]:local('Metal',xx,h+.65,0,2,.9,3)
 else:continue
 features.append({'name':name,'zone':zone,'x':x,'z':z,'height':h})
# Riverbank: sloping revetment edge, tiered steps and linked lookout pergolas.
for x in range(-60,941,25):
 box('river','Stone',x,-.02,775,25,.20,5)
 box('river','Stone',x,-.15,780,25,.16,5)
for x in [180,520,780]:
 for j in range(4):box('river','Stone',x,.24-j*.065,786+j*1.6,12,.15,2)
 for dx in [-12,12]:
  for zz in [756,772]:box('river','Timber',x+dx,1.65,zz,.24,3.3,.24)
 for dx in range(-12,13,2):box('river','Timber',x+dx,3.5,764,.22,.23,18)
objects=[];triangles=0
for (zone,kind),(verts,faces) in buckets.items():
 m=bpy.data.meshes.new('Namak_Arch_'+zone+'_'+kind);m.from_pydata(verts,[],faces);m.update()
 o=bpy.data.objects.new(m.name,m);collection.objects.link(o);m.materials.append(materials[kind]);o['namak_architecture']=True;o['visualOnly']=True;o['zone']=zone
 m.calc_loop_triangles();triangles+=len(m.loop_triangles);objects.append(o)
# Save editable original plus separate collection, under a new filename.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-sources/namak/namak-highdetail.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
glb=ROOT/'public/assets/rebuild/namak-architecture.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
(EVIDENCE/'architecture-report.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'bytes':glb.stat().st_size,'meshes':len(objects),'triangles':triangles,'features':features,'zones':sorted(set(z for z,k in buckets))},indent=2),encoding='utf-8')
print('NAMAK ARCHITECTURE',len(objects),triangles,glb.stat().st_size)
