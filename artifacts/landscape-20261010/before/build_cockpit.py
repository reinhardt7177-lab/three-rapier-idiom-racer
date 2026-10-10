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

leather = material('Cockpit_Leather', (.025,.033,.043), rough=.77)
soft = material('Cockpit_Dash', (.045,.057,.068), rough=.68)
carbon = material('Cockpit_Carbon', (.016,.022,.03), .35,.34)
chrome = material('Cockpit_BrushedMetal', (.26,.31,.36), .8,.3)
black = material('Cockpit_GaugeFace', (.005,.009,.015), rough=.65)
white = material('Cockpit_IlluminatedWhite', (.62,.88,1), emission=.65)
blue = material('Cockpit_Accent', (.01,.27,.5), .35,.27, .25)
red = material('Cockpit_Red', (.7,.035,.025), emission=.45)
needle = material('Cockpit_Needle', (1,.42,.08), emission=1)

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

# Broad curved-looking dashboard, padded brow and recessed instrument binnacle.
box('LowerDash',(.28,1.22,-.55),(2.3,.52,.55),leather,bevel=.08)
box('DashTop',(.28,1.35,-.255),(2.30,.64,.18),soft,bevel=.075)
box('InstrumentPod',(0,1.13,-.285),(.66,.20,.31),carbon,bevel=.045)
box('InstrumentBrow',(0,1.10,-.106),(.72,.24,.055),soft,bevel=.023)
box('MetalTrim',(.29,.935,-.445),(2.19,.022,.014),chrome,bevel=.004)
box('AmbientTrim',(.29,.92,-.462),(2.19,.014,.009),blue,bevel=.003)
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

gauge('Speedometer',-.149,260,'KM/H','SpeedNeedle')
gauge('Tachometer',.149,8,'RPM x1000','RPMNeedle',6.5)
text('GearLabel','GEAR',(0,.983,-.239),.013,white)
text('BrandLabel','MUMU',(0,.981,-.283),.012,blue)
for i,x in enumerate([-.035,0,.035]):
    cylinder('Indicator',(x,.985,-.322),.004,.006,blue if i!=1 else red,vertices=16)

# Centre console: inset display, rotary knobs and real gear selector.
box('CentreConsole',(.67,.99,-.586),(.42,.13,.37),carbon,bevel=.038)
box('DisplayBezel',(.67,.905,-.52),(.32,.02,.15),chrome,bevel=.012)
box('DisplayGlass',(.67,.889,-.52),(.30,.01,.13),black,bevel=.009)
text('ConsoleTitle','COASTAL SIX',(.67,.881,-.487),.02,white)
text('ConsoleSubtitle','DRIVE / 01',(.67,.88,-.536),.016,blue)
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
bar('LeftAFrame',(-.74,1.12,-.31),(-.98,1.27,.35),.045,.06,leather)
bar('RightAFrame',(1.28,1.12,-.31),(1.51,1.27,.35),.045,.06,leather)

wheel=empty('SteeringWheel',(0,.77,-.374),root)
wheel['steering_ratio']=4
ring('LeatherRim',(0,0,0),.196,.019,leather,wheel)
ring('InnerStitch',(0,-.009,0),.181,.0025,chrome,wheel)
for side in [-1,1]:
    bar('WheelSpoke',(side*.057,0,-.005),(side*.174,0,.033),.031,.024,chrome,wheel)
    box('WheelButtonBank',(side*.106,-.018,.008),(.058,.014,.035),carbon,wheel,.01)
    for k in [-1,1]:
        box('WheelButton',(side*.106+k*.015,-.027,.01),(.010,.008,.014),soft,wheel,.003)
bar('LowerSpoke',(0,0,-.05),(0,0,-.178),.037,.024,chrome,wheel)
cylinder('Airbag',(0,-.016,0),.062,.037,leather,wheel)
text('WheelBadge','M',(0,-.041,0),.026,chrome,wheel)
box('WheelCentreStripe',(0,-.003,.195),(.017,.039,.021),blue,wheel,.005)
for x in [-.142,.142]:
    box('Paddle',(x,.055,.022),(.027,.016,.10),chrome,wheel,.009)

source=ROOT/'assets-sources/cockpit-v1/cockpit.blend'
output=ROOT/'public/assets/rebuild/cockpit.glb'
source.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
mesh_count=web_meshes()
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
print(f'COCKPIT_EXPORTED meshes={mesh_count} bytes={output.stat().st_size} source={source}')
