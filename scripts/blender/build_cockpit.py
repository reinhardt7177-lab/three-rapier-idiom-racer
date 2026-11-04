"""Editable camera-space racing cockpit. Blender +Y faces the road, +Z is up.

Run: blender -b --python scripts/blender/build_cockpit.py
The steering/needle parents survive mesh batching as independent glTF pivots.
"""
import bpy
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))
from web_meshes import web_meshes

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0

def material(name, color, metal=0, rough=.5, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    if emission:
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = emission
    return m

leather = material('Cockpit_Leather', (.012,.014,.017), rough=.88)
soft = material('Cockpit_Dash', (.024,.027,.031), rough=.83)
carbon = material('Cockpit_Carbon', (.016,.022,.03), .35,.34)
chrome = material('Cockpit_BrushedMetal', (.19,.20,.21), .7,.43)
black = material('Cockpit_GaugeFace', (.005,.009,.015), rough=.65)
white = material('Cockpit_IlluminatedWhite', (.62,.88,1), emission=.65)
blue = material('Cockpit_Accent', (.018,.17,.24), .25,.4, .18)
red = material('Cockpit_Red', (.7,.035,.025), emission=.45)
needle = material('Cockpit_Needle', (1,.42,.08), emission=1)
display = material('Cockpit_Display', (.005,.014,.021), rough=1)

def empty(name, pos=(0,0,0), parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o)
    o.parent=parent; o.location=pos
    return o

root=empty('CockpitRoot')
root['cockpit_rig_version']=1
root['coordinate_space']='camera: driver at origin, Blender +Y forward'

def finish(o,name,mat,parent=root,bevel=0):
    o.name=name; o.parent=parent; o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('Rounded manufactured edge','BEVEL'); b.width=bevel; b.segments=2
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.modifier_apply(modifier=b.name)
    for p in o.data.polygons:p.use_smooth=True
    if bevel:
        n=o.modifiers.new('Weighted panel normals','WEIGHTED_NORMAL'); n.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=n.name)
    return o

def box(name,pos,size,mat,parent=root,bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,bevel)

def cylinder(name,pos,radius,depth,mat,parent=root,vertices=32):
    # Facing the driver: round face in X/Z, depth along Y.
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=pos,rotation=(math.pi/2,0,0))
    return finish(bpy.context.object,name,mat,parent, .002)

def ring(name,pos,radius,tube,mat,parent=root):
    bpy.ops.mesh.primitive_torus_add(major_segments=48,minor_segments=8,location=pos,rotation=(math.pi/2,0,0),major_radius=radius,minor_radius=tube)
    return finish(bpy.context.object,name,mat,parent)

def text(name,value,pos,size,mat,parent=root):
    bpy.ops.object.text_add(location=pos,rotation=(math.pi/2,0,0))
    o=bpy.context.object; o.data.body=value; o.data.size=size; o.data.align_x='CENTER';o.data.align_y='CENTER';o.data.extrude=0; o.data.resolution_u=2
    bpy.ops.object.convert(target='MESH'); return finish(bpy.context.object,name,mat,parent)

def bar(name,a,b,width,depth,mat,parent=root):
    a,b=Vector(a),Vector(b)
    o=box(name,(a+b)/2,(width,depth,(b-a).length),mat,parent, min(width*.24,.015))
    o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
    return o

def section(name,profile,width,centre,mat,bevel=.015):
    # Extrude a manufactured panel cross-section along the dashboard width.
    vertices=[(centre-width/2,y,z) for y,z in profile]+[(centre+width/2,y,z) for y,z in profile]
    n=len(profile)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    # Recalculate winding before export; the footwell must be opaque from inside.
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    return finish(obj,name,mat,bevel=bevel)

def screen(name,pos,width,height,upper):
    # One atlas: upper half = live instruments, lower half = music console.
    bpy.ops.mesh.primitive_plane_add(size=1,location=pos,rotation=(math.pi/2,0,0))
    o=bpy.context.object;o.scale=(width,height,1)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for loop in o.data.uv_layers.active.data:
        loop.uv.y=loop.uv.y*.5+(.5 if upper else 0)
    return finish(o,name,display)

# Continuous cowl, lower dash, footwell and door cards: never a floating fascia.
section('DashShell',[(.92,-.44),(.98,-.23),(1.24,-.19),(1.64,-.29),(1.71,-.41),(1.52,-.84),(1.03,-.84),(.98,-.63)],2.5,.28,leather,.04)
section('DashUpper',[(.99,-.26),(1.12,-.21),(1.40,-.22),(1.64,-.30),(1.63,-.35),(1.1,-.31)],2.48,.28,soft,.018)
box('FootwellFloor',(.22,.60,-1.06),(5.2,3.2,.18),leather,bevel=.035)
for x in [-1.03,1.55]:
    section('DoorInner',[(0,-.95),(0,-.55),(.48,-.24),(1.31,-.25),(1.55,-.48),(1.35,-.96)],.11,x,leather,.018)
    bar('DoorArmrest',(x,.1,-.64),(x,.97,-.54),.10,.10,soft)
    bar('DoorInlay',(x,.15,-.50),(x,.99,-.41),.009,.02,chrome)
box('Glovebox',(.99,.924,-.62),(.72,.025,.24),soft,bevel=.023)
box('GloveboxLatch',(.99,.904,-.55),(.13,.015,.011),chrome,bevel=.004)
box('InstrumentPod',(0,1.13,-.285),(.66,.20,.31),carbon,bevel=.045)
# One continuous arched instrument shade: separate bars leave visible ribs.
hood_vertices=[];hood_faces=[]
for i in range(33):
    x=-.36+i*.0225;z=-.21+.125*math.sqrt(max(0,1-(x/.36)**2))
    hood_vertices += [(x,.966,z),(x,1.25,z),(x,1.25,z+.028),(x,.966,z+.028)]
    if i:
        a=(i-1)*4;b=i*4
        for k in range(4):hood_faces.append((a+k,a+(k+1)%4,b+(k+1)%4,b+k))
hood_faces += [(3,2,1,0),(128,129,130,131)]
hood_mesh=bpy.data.meshes.new('InstrumentCanopy');hood_mesh.from_pydata(hood_vertices,[],hood_faces);hood_mesh.update()
hood_obj=bpy.data.objects.new('InstrumentCanopy',hood_mesh);bpy.context.collection.objects.link(hood_obj)
finish(hood_obj,'InstrumentCanopy',soft)
for x,w in [(-.44,.61),(1.10,.62)]:
    box('MetalTrim',(x,.935,-.445),(w,.017,.009),chrome,bevel=.003)
    box('AmbientTrim',(x,.921,-.458),(w,.009,.004),blue,bevel=.001)
for x in [-.49,.51,.82,1.22]:
    box('VentSurround',(x,1.002,-.315),(.19,.045,.102),chrome,bevel=.014)
    box('VentWell',(x,.972,-.315),(.172,.014,.081),black,bevel=.006)
    for z in [-.341,-.315,-.289]:
        box('VentSlat',(x,.961,z),(.158,.012,.009),soft,bevel=.003)
    box('VentTab',(x,.945,-.318),(.023,.018,.012),chrome,bevel=.003)

def gauge(name,x,max_value,unit,pivot_name,red_from=None):
    y,z=1.008,-.21
    cylinder(name+'Case',(x,y+.02,z),.127,.031,carbon)
    ring(name+'Bezel',(x,y,z),.122,.008,chrome)
    cylinder(name+'Face',(x,y-.006,z),.115,.008,black)
    steps, major = (26, 2) if max_value == 260 else (24, 3)
    for i in range(steps+1):
        angle=math.radians(-130+260*i/steps)
        r0=.093 if i%major==0 else .10
        r1=.107
        bar(name+'Tick',(x+math.sin(angle)*r0,y-.015,z+math.cos(angle)*r0),(x+math.sin(angle)*r1,y-.015,z+math.cos(angle)*r1),.003,.003,red if red_from is not None and i/steps*max_value>=red_from else white)
        if i%major==0:
            v=int(i/steps*max_value)
            text(name+'Number',str(v),(x+math.sin(angle)*.077,y-.02,z+math.cos(angle)*.077),.015,white)
    text(name+'Unit',unit,(x,y-.026,z-.043),.015,white)
    pivot=empty(pivot_name,(x,y-.031,z),root)
    pivot['sweep_degrees']=260
    pivot['max_value']=max_value
    # Needle rests upward; JS rotates around local glTF Z (-Blender Y).
    box(name+'Pointer',(0,0,.04),(.005,.004,.094),needle,pivot,bevel=.001)
    cylinder(name+'Hub',(0,-.003,0),.012,.011,chrome,pivot,vertices=24)

gauge('Speedometer',-.175,260,'KM/H','SpeedNeedle')
gauge('Tachometer',.175,8,'RPM x1000','RPMNeedle',6.5)
box('ClusterDisplayBezel',(0,.988,-.203),(.119,.012,.092),carbon,bevel=.007)
screen('ClusterDisplay',(0,.979,-.203),.112,.085,True)
for i,x in enumerate([-.035,0,.035]):
    cylinder('Indicator',(x,.985,-.322),.004,.006,blue if i!=1 else red,vertices=16)

# Centre console: inset display, rotary knobs and real gear selector.
box('CentreConsole',(.67,.99,-.586),(.42,.13,.37),carbon,bevel=.038)
box('DisplayBezel',(.67,.905,-.52),(.32,.02,.15),chrome,bevel=.012)
box('DisplayGlass',(.67,.889,-.52),(.30,.01,.13),black,bevel=.009)
screen('AudioDisplay',(.67,.881,-.52),.30,.13,False)
for x in [.55,.67,.79]:
    cylinder('ClimateKnob',(x,.898,-.665),.028,.032,chrome)
    cylinder('KnobCap',(x,.875,-.665),.021,.012,carbon)
    box('KnobMark',(x,.866,-.646),(.003,.003,.008),white,bevel=.001)
box('Tunnel',(.61,.48,-.91),(.36,1.05,.25),leather,bevel=.05)
box('ShifterBase',(.60,.62,-.76),(.21,.25,.035),chrome,bevel=.02)
box('ShifterGaiter',(.60,.62,-.735),(.15,.19,.043),carbon,bevel=.022)
bar('SelectorStem',(.60,.62,-.73),(.60,.61,-.59),.025,.03,chrome)
box('SelectorGrip',(.60,.60,-.58),(.055,.082,.09),leather,bevel=.024)
text('ShifterMark','M',(.60,.555,-.57),.012,white)
for z in [-.55,-.60,-.65]:
    box('LeftControl',(-.41,.924,z),(.054,.018,.021),carbon,bevel=.006)

# Narrow windshield frame at the edges, never a wall across the road.
bar('LeftAFrame',(-1.03,1.12,-.31),(-1.45,1.47,1.8),.06,.085,leather)
bar('RightAFrame',(1.53,1.12,-.31),(1.97,1.47,1.8),.06,.085,leather)
box('RoofHeader',(.26,1.47,1.8),(3.48,.14,.09),leather,bevel=.025)

wheel=empty('SteeringWheel',(0,.77,-.374),root)
wheel['steering_ratio']=4
ring('LeatherRim',(0,0,0),.196,.019,leather,wheel)
ring('InnerStitch',(0,-.009,0),.181,.0025,chrome,wheel)
for side in [-1,1]:
    bar('WheelSpoke',(side*.057,0,-.005),(side*.174,0,.033),.034,.026,carbon,wheel)
    bar('SpokeInlay',(side*.067,-.015,-.012),(side*.165,-.015,.019),.006,.004,chrome,wheel)
    box('WheelButtonBank',(side*.106,-.018,.008),(.058,.014,.035),carbon,wheel,.01)
    for k in [-1,1]:
        box('WheelButton',(side*.106+k*.015,-.027,.01),(.010,.008,.014),soft,wheel,.003)
bar('LowerSpoke',(0,0,-.05),(0,0,-.178),.037,.024,carbon,wheel)
bar('LowerSpokeInlay',(0,-.014,-.076),(0,-.014,-.167),.009,.005,chrome,wheel)
box('Airbag',(0,-.019,-.009),(.156,.066,.114),leather,wheel,.038)
box('AirbagInset',(0,-.057,-.003),(.086,.009,.055),carbon,wheel,.018)
text('WheelBadge','M',(0,-.066,0),.021,chrome,wheel)
for side in [-1,1]:
    box('ThumbGrip',(side*.169,-.004,.071),(.04,.04,.082),leather,wheel,.016)
bar('SteeringColumn',(0,.84,-.39),(0,1.14,-.52),.115,.09,leather)
box('WheelCentreStripe',(0,-.003,.195),(.017,.039,.021),blue,wheel,.005)
for x in [-.142,.142]:
    box('Paddle',(x,.055,.022),(.027,.016,.10),chrome,wheel,.009)

source=ROOT/'assets-sources/cockpit-v1/cockpit.blend'
output=ROOT/'public/assets/rebuild/cockpit.glb'
source.parent.mkdir(parents=True,exist_ok=True)
# Meter-scale UVs also cover generated sections, without changing screen UVs.
# The web renderer shares a tiny grain normal map between these materials.
bpy.context.view_layer.update()
for obj in bpy.context.scene.objects:
    if obj.type!='MESH' or not obj.data.materials:continue
    if obj.data.materials[0] not in [leather,soft,carbon]:continue
    uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='SurfaceGrain')
    for poly in obj.data.polygons:
        normal=obj.matrix_world.to_3x3()@poly.normal
        axis=max(range(3),key=lambda k:abs(normal[k]))
        axes=[k for k in range(3) if k!=axis]
        for index in poly.loop_indices:
            point=obj.matrix_world@obj.data.vertices[obj.data.loops[index].vertex_index].co
            uv.data[index].uv=(point[axes[0]],point[axes[1]])
bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
mesh_count=web_meshes()
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
print(f'COCKPIT_EXPORTED meshes={mesh_count} bytes={output.stat().st_size} source={source}')
