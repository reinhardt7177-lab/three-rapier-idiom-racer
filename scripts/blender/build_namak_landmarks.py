"""Editable Namak wayfinding overlay. Game coordinates, not surveyed sign sites.
Run Blender -b --python scripts/blender/build_namak_landmarks.py.
The existing city, route and collision meshes are never rewritten.
"""
import bpy, math, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/rebuild'
SRC=ROOT/'assets-sources/namak'
EVIDENCE=ROOT/'artifacts/namak-landmarks-20261010'
for p in [OUT,SRC,EVIDENCE]:p.mkdir(parents=True,exist_ok=True)
route=json.loads((OUT/'namak-route.json').read_text(encoding='utf-8'))
points=route['points']
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
font=bpy.data.fonts.load('C:/Windows/Fonts/malgunbd.ttf')
materials={}
def material(name,colour,emit=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*colour,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*colour,1)
    bs.inputs['Roughness'].default_value=.75
    bs.inputs['Emission Color'].default_value=(*colour,1);bs.inputs['Emission Strength'].default_value=emit
    materials[name]=m
material('Wayfinding_Green',(.008,.13,.055),.12)
material('Wayfinding_Blue',(.008,.075,.22),.12)
material('Wayfinding_Brown',(.18,.065,.025),.12)
material('Wayfinding_Text',(.92,.96,1),.9)
material('Wayfinding_Accent',(.98,.61,.025),.65)
material('Wayfinding_Metal',(.23,.28,.32))
material('Wayfinding_Base',(.20,.22,.23))

def cube(parent,name,x,y,z,w,h,d,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y))
    o=bpy.context.object;o.name=name;o.dimensions=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.parent=parent;o.data.materials.append(materials[mat]);return o

def lettering(parent,name,value,y,z,size,max_width,mat='Wayfinding_Text',x=0):
    bpy.ops.object.text_add(location=(x,-z,y),rotation=(math.pi/2,0,0))
    o=bpy.context.object;o.name=name;o.parent=parent;o.data.font=font;o.data.body=value
    o.data.size=size;o.data.align_x='CENTER';o.data.align_y='CENTER';o.data.resolution_u=1
    bpy.context.view_layer.update()
    if o.dimensions.x>max_width:
        factor=max_width/o.dimensions.x;o.scale=(factor,factor,factor)
    bpy.ops.object.convert(target='MESH');o.data.materials.append(materials[mat])
    o['namak_label']=value
    return o

records=[]
def board(id,title,subtitle,x,z,yaw,kind='direction',second='',sector=''):
    width,height,y=(9.0,3.8,6.3) if kind=='direction' else (6.2,2.35,3.4) if kind=='street' else (8.6,3.2,3.5)
    group=bpy.data.objects.new('Namak_Sign_'+id,None);bpy.context.collection.objects.link(group)
    group.location=(x,-z,0);group.rotation_euler.z=yaw
    group['namak_sign']=id;group['dynamic']=True
    colour={'direction':'Wayfinding_Green','street':'Wayfinding_Blue','landmark':'Wayfinding_Brown'}[kind]
    plate_x=-9.5 if kind=='direction' else 0
    cube(group,'Sign_Frame',plate_x,y,0,width+.18,height+.18,.20,'Wayfinding_Metal')
    cube(group,'Sign_Panel',plate_x,y,.12,width,height,.12,colour)
    # Cantilever direction plates are above 4.3m vehicle clearance, while their
    # support stays on the sidewalk. This keeps the sign inside the chase view.
    post_height=y+height/2+.25 if kind=='direction' else y-height/2
    for xx in [2.8] if kind=='direction' else [-width*.39,width*.39]:
        cube(group,'Sign_Post',xx,post_height/2,0,.22,post_height,.22,'Wayfinding_Metal')
        cube(group,'Sign_Foot',xx,.24,0,.55,.48,.55,'Wayfinding_Base')
    if kind=='direction':
        lo,hi=plate_x-width/2,2.8
        cube(group,'Cantilever_Arm',(lo+hi)/2,post_height,0,hi-lo,.22,.22,'Wayfinding_Metal')
    for yy in [-height*.45,height*.45]:cube(group,'Reflective_Border',plate_x,y+yy,.19,width*.94,.035,.025,'Wayfinding_Text')
    front=.211
    if second:
        lettering(group,'Destination_Main',title,y+.75,front,1.02,width*.89,x=plate_x)
        lettering(group,'Destination_Next',second,y-.37,front,.85,width*.89,x=plate_x)
        lettering(group,'Destination_English',subtitle,y-1.28,front,.29,width*.87,x=plate_x)
    else:
        lettering(group,'Place_Main',title,y+.37,front,.83 if kind=='street' else 1.0,width*.88)
        lettering(group,'Place_English',subtitle,y-.65,front,.31,width*.87)
    if sector:
        cube(group,'Sector_Tab',plate_x+width*.42,y+height/2+.40,.02,1.05,.72,.15,'Wayfinding_Accent')
        # A separate narrow plaque avoids covering the Korean destination text.
        tab=lettering(group,'Sector_Number',sector,y+height/2+.40,.11,.44,.85,'Wayfinding_Blue')
        tab.location.x=plate_x+width*.42
    records.append(dict(id=id,title=title,subtitle=subtitle,second=second,x=x,z=z,yaw=yaw,kind=kind,width=width,height=height,y=y,boardOffset=plate_x,sector=sector))

def roadside(id,index,title,subtitle,kind='direction',second='',sector=''):
    p=points[index];off=-18.2
    board(id,title,subtitle,p['x']+p['dz']*off,p['z']-p['dx']*off,math.atan2(-p['dx'],-p['dz']),kind,second,sector)

# Direction arrows refer to the game landmark positions, not real junctions.
for id,index,title,second,subtitle,sector in [
 ('civic-approach',78,'← 전라남도청','↑ 남악 상가거리','JEONNAM OFFICE / NAMAK', '01'),
 ('reservoir-turn',255,'← 남악저수지','↑ 남악로 · 상가거리','RESERVOIR / NAMAK-RO','01'),
 ('east-entry',350,'↑ 남악 상가거리','→ 중앙공원','SHOPPING / CENTRAL PARK','02'),
 ('east-exit',515,'↑ 남악 수변공원','→ 영산강 수변','WATERFRONT / YEONGSANGANG','02'),
 ('river-entry',680,'↑ 영산강 수변','← 수변 산책로','YEONGSANGANG WATERFRONT','03'),
 ('river-exit',940,'↑ 중앙공원 순환','→ 김대중광장','CENTRAL PARK / KIM DAEJUNG','03'),
 ('park-entry',1110,'→ 남악중앙공원','↑ 전라남도청','CENTRAL PARK / JEONNAM OFFICE','04'),
 ('finish-approach',1340,'↑ 도청대로 · 결승','→ 남악저수지','CIVIC BOULEVARD / FINISH','04'),
]:roadside(id,index,title,subtitle,second=second,sector=sector)

for id,index,title,subtitle in [
 ('road-hugwang',145,'후광대로','Hugwang-daero / CIVIC SECTOR'),
 ('road-oryong',285,'오룡길','Oryong-gil / PROVINCIAL OFFICE'),
 ('road-namak',420,'남악로','Namak-ro / SHOPPING SECTOR'),
 ('road-namak3',570,'남악3로','Namak 3-ro / WATERFRONT APPROACH'),
 ('road-waterfront',810,'영산강 수변길','YEONGSANGANG / RACE PROMENADE'),
 ('road-daejuk-west',1030,'대죽서로','Daejukseo-ro / PARK SECTOR'),
 ('road-park-loop',1210,'중앙공원 순환로','CENTRAL PARK / RACE LOOP'),
]:roadside(id,index,title,subtitle,'street')

for args in [
 ('office-gate','전라남도청','JEONNAM PROVINCIAL OFFICE',450,-30,0),
 ('council-gate','전라남도의회','JEONNAM PROVINCIAL COUNCIL',615,-37,0),
 ('reservoir-gate','남악저수지','NAMAK RESERVOIR / BOARDWALK',695,-30,0),
 ('shopping-gate','남악 상가거리','NAMAK / SHOPPING DISTRICT',921,320,math.pi),
 ('river-gate','남악 수변공원','NAMAK / WATERFRONT PARK',640,673,math.pi/2),
 ('park-gate','남악중앙공원','NAMAK / CENTRAL PARK',-77,220,-math.pi/2),
 ('plaza-gate','김대중광장 · 대죽도','KIM DAEJUNG PLAZA / DAEJUKDO',-77,416,-math.pi/2),
]:board(*args,kind='landmark')

bpy.context.scene['reference_mode']='Real place names, race-scaled positions; not surveyed sign locations'
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'namak-landmarks.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'namak-landmarks.glb'),export_format='GLB',export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
report={'signs':records,'count':len(records),'bytes':(OUT/'namak-landmarks.glb').stat().st_size,'referenceMode':bpy.context.scene['reference_mode']}
(OUT/'namak-landmarks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(EVIDENCE/'sign-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('NAMAK_SIGNS_EXPORTED',len(records),report['bytes'])
