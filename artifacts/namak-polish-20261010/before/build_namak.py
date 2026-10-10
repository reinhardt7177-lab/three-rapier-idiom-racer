"""Photo-referenced Namak race corridor, not a surveyed city replica.
Blender axes are explicitly converted from gameplay metres (X,Y up,Z south).
Run: blender -b --python scripts/blender/build_namak.py
"""
import bpy, math, json, random, array
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/rebuild'
SRC=ROOT/'assets-sources/namak'
EVIDENCE=ROOT/'artifacts/namak-20261010'
for p in [OUT,SRC,EVIDENCE]:p.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
random.seed(1729)
font=bpy.data.fonts.load('C:/Windows/Fonts/malgun.ttf')
materials={}
def mat(name,color,metal=0,rough=.8,emit=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
    if emit:bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emit
    materials[name]=m;return m
for args in [
 ('Asphalt',(.07,.085,.105)),('Concrete',(.44,.45,.43)),('Paving',(.38,.37,.32)),
 ('Grass',(.115,.19,.085)),('Terrain',(.16,.22,.11)),('Water',(.06,.24,.28),.2,.28),
 ('Namak_White',(.69,.72,.70)),('Namak_Beige',(.46,.46,.40)),('Namak_Glass',(.07,.17,.22),.55,.24),
 ('Namak_Silver',(.27,.32,.34),.65,.4),('Namak_Dark',(.025,.035,.041)),
 ('Namak_Teal',(.055,.21,.22)),('Namak_Roof',(.18,.30,.23)),('Namak_Window',(.055,.075,.082),.2,.3),
 ('Namak_Leaf',(.08,.20,.065)),('Namak_LeafLight',(.16,.28,.095)),('Namak_Pine',(.045,.12,.075)),
 ('Namak_Bark',(.15,.105,.07)),('Namak_Reed',(.32,.35,.14)),('Namak_Wood',(.26,.17,.11)),
 ('Namak_Yellow',(.83,.56,.07)),('Namak_Red',(.64,.065,.04)),('Namak_Line',(.82,.82,.76)),
 ('Namak_Blue',(.025,.20,.34)),('Namak_GreenSignal',(.1,.6,.25),0,.5,1.2),
 ('Namak_WarmWindow',(.54,.37,.16),0,.6,.25)]:mat(*args)

# Accumulate static manufactured parts by 128m spatial cell and material.
# This avoids one draw call per window while retaining district-level culling.
buckets={};footprints=[]
def vertex(p):return (p[0],-p[2],p[1])
def add(name,verts,faces,material,collider=False,cell=True):
    if cell:
        cx=sum(p[0] for p in verts)/len(verts);cz=sum(p[2] for p in verts)/len(verts)
        key=(material,math.floor(cx/128),math.floor(cz/128),collider,name if collider else '')
    else:key=(material,name,collider)
    if key not in buckets:buckets[key]=[[],[],name,material,collider]
    vs,fs,*_=buckets[key];n=len(vs);vs.extend(vertex(p) for p in verts);fs.extend(tuple(n+i for i in f) for f in faces)
def box(name,x,y,z,w,h,d,material,angle=0,collider=False):
    c,s=math.cos(angle),math.sin(angle)
    v=[]
    for yy in [-h/2,h/2]:
        for xx,zz in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]:
            v.append((x+xx*c+zz*s,y+yy,z-xx*s+zz*c))
    add(name,v,[(0,1,2,3),(7,6,5,4),(4,5,1,0),(5,6,2,1),(6,7,3,2),(7,4,0,3)],material,collider)
def ellipsoid(name,x,y,z,rx,ry,rz,material):
    v=[(x,y+ry,z),(x,y-ry,z)]
    for j in range(1,6):
        a=math.pi*j/6
        for k in range(10):
            t=math.tau*k/10;v.append((x+rx*math.sin(a)*math.cos(t),y+ry*math.cos(a),z+rz*math.sin(a)*math.sin(t)))
    f=[]
    for k in range(10):f.extend([(0,2+(k+1)%10,2+k),(1,42+k,42+(k+1)%10)])
    for j in range(4):
        for k in range(10):a=2+j*10+k;b=2+j*10+(k+1)%10;f.append((a,b,b+10,a+10))
    add(name,v,f,material)
def text(name,value,x,y,z,size,material,angle=0):
    bpy.ops.object.text_add(location=vertex((x,y,z)),rotation=(math.pi/2,0,angle))
    o=bpy.context.object;o.name=name;o.data.font=font;o.data.body=value;o.data.size=size;o.data.align_x='CENTER';o.data.align_y='CENTER';o.data.resolution_u=2
    bpy.ops.object.convert(target='MESH');o.data.materials.append(materials[material]);o['namak_detail']=name
def tree(x,z,scale=1,pine=False):
    box('Tree_Trunk',x,2.4*scale,z,.38*scale,4.8*scale,.38*scale,'Namak_Bark')
    if pine:
        for off,rad in [(0,2.7),(1.3,2.2),(2.3,1.7)]:ellipsoid('Pine_Canopy',x,4.5*scale+off*scale,z,rad*scale,1.25*scale,rad*scale,'Namak_Pine')
    else:
        for off in [-1,1]:ellipsoid('Tree_Canopy',x+off*.7*scale,5.3*scale,z,2.5*scale,2.2*scale,2.2*scale,'Namak_Leaf' if off<0 else 'Namak_LeafLight')
def nearest(x,z):return min(math.hypot(x-p['x'],z-p['z']) for p in points)

# Rounded urban circuit. Corner rounding is deliberate race design, not GPS.
corners=[(0,0),(800,0),(900,100),(900,500),(720,650),(100,650),(-100,480),(-100,110)]
raw=[]
for i,v in enumerate(corners):
    prev=corners[i-1];nxt=corners[(i+1)%len(corners)]
    def toward(a,b,d):
        length=math.dist(a,b);return (a[0]+(b[0]-a[0])*d/length,a[1]+(b[1]-a[1])*d/length)
    before=toward(v,prev,min(65,math.dist(v,prev)*.35));after=toward(v,nxt,min(65,math.dist(v,nxt)*.35))
    for k in range(32):
        t=k/32;raw.append(((1-t)**2*before[0]+2*(1-t)*t*v[0]+t*t*after[0],(1-t)**2*before[1]+2*(1-t)*t*v[1]+t*t*after[1]))
    nextv=nxt;nextnext=corners[(i+2)%len(corners)];entry=toward(nextv,v,min(65,math.dist(nextv,v)*.35))
    steps=max(1,math.ceil(math.dist(after,entry)/2))
    for k in range(steps):t=k/steps;raw.append((after[0]*(1-t)+entry[0]*t,after[1]*(1-t)+entry[1]*t))
# Uniform 2m samples prevent dense corner samples from shrinking AI lookahead.
dist=[0]
for i in range(1,len(raw)+1):dist.append(dist[-1]+math.dist(raw[i-1],raw[i%len(raw)]))
length=dist[-1];count=math.ceil(length/2);points=[];j=0
for i in range(count):
    d=i*length/count
    while dist[j+1]<d:j+=1
    t=(d-dist[j])/(dist[j+1]-dist[j]);a,b=raw[j],raw[(j+1)%len(raw)]
    x,z=a[0]*(1-t)+b[0]*t,a[1]*(1-t)+b[1]*t
    region='도청대로' if z<110 else '남악상가거리' if x>750 else '영산강 수변' if z>550 else '중앙공원 순환'
    points.append(dict(x=x,y=.025,z=z,distance=d,region=region))
# Put grid and finish on the long straight facing the civic complex.
start=min(range(count),key=lambda i:math.hypot(points[i]['x']-150,points[i]['z']))
points=points[start-25:]+points[:start-25]
for i,p in enumerate(points):
    a,b=points[i-1],points[(i+1)%count];dx,dz=b['x']-a['x'],b['z']-a['z'];norm=math.hypot(dx,dz)
    p.update(dx=dx/norm,dz=dz/norm,distance=i*length/count)
route={'name':'NAMAK CITY CIRCUIT','id':'namak','length':length,'width':22,'startIndex':25,'closed':True,'referenceMode':'photo-inspired race corridor; not surveyed geography','points':points}
(OUT/'namak-route.json').write_text(json.dumps(route,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
def ribbon(name,low,high,y,material,collider=False):
    for begin in range(0,count,64):
        v=[];f=[]
        for k in range(min(64,count-begin)+1):
            p=points[(begin+k)%count]
            for off in [low,high]:v.append((p['x']+p['dz']*off,y,p['z']-p['dx']*off))
            if k:a=(k-1)*2;f.append((a+2,a+3,a+1,a))
        add(name+f'_{begin}',v,f,material,collider,cell=False)
ribbon('Road_Asphalt',-11,11,.025,'Asphalt',True)
for side in [-1,1]:
    ribbon('RoadEdge',side*10.6,side*10.8,.035,'Namak_Line')
    ribbon('Sidewalk',min(side*11.2,side*18),max(side*11.2,side*18),.05,'Paving')
    ribbon('DoubleYellow',side*.15,side*.27,.039,'Namak_Yellow')
    # Race walls outside the usable road, continuous across the seam.
    for begin in range(0,count,128):
        v=[];f=[]
        for k in range(min(128,count-begin)+1):
            p=points[(begin+k)%count];x=p['x']+p['dz']*side*11.85;z=p['z']-p['dx']*side*11.85
            v.extend([(x,0,z),(x,.8,z)])
            if k:a=(k-1)*2;f.append((a,a+1,a+3,a+2))
        add('RaceBarrier_'+str(side)+'_'+str(begin),v,f,'Concrete',True,cell=False)
for i,p in enumerate(points):
    yaw=math.atan2(p['dx'],p['dz'])
    if i%8==0:
        for lane in [-5.5,5.5]:box('LaneDash',p['x']+p['dz']*lane,.042,p['z']-p['dx']*lane,.13,.01,4.0,'Namak_Line',yaw)
    if i%24==0:
        for side in [-1,1]:
            x,z=p['x']+p['dz']*side*17,p['z']-p['dx']*side*17
            box('LampPole',x,4.4,z,.17,8.8,.17,'Namak_Silver')
            box('LampArm',x-p['dz']*side*1.4,8.8,z+p['dx']*side*1.4,2.8,.12,.14,'Namak_Silver',yaw)
            if i%48==0:tree(x+p['dz']*side*5,z-p['dx']*side*5,.85)
    if i%15==0 and p['z']>550:
        for off in [33,39,46]:
            x,z=p['x']+p['dz']*off,p['z']-p['dx']*off
            box('ReedBed',x,.45,z,4,.9,2,'Namak_Reed',yaw)

box('Terrain_Base',400,-.11,280,2400,.12,1850,'Terrain',collider=True)
box('CentralParkLawn',380,-.015,275,700,.02,420,'Grass')
box('RiverWater',400,-.025,960,1900,.025,420,'Water')
box('RiverPromenade',400,.02,711,1110,.04,9,'Paving')
box('RiverTimberWalk',480,.05,745,500,.08,7,'Namak_Wood')
for x in range(-90,950,20):
    box('WaterfrontFence',x,.65,751,.12,1.3,.12,'Namak_Dark')
    box('WaterfrontRail',x+10,1.25,751,20,.07,.07,'Namak_Dark')
    if x%40==30:tree(x,717,.9,pine=True)
for x in [180,520,780]:
    box('LookoutDeck',x,.1,769,30,.2,36,'Namak_Wood')
    for off in [-14,14]:box('DeckRail',x+off,.7,769,.08,1.2,36,'Namak_Silver')

def building(name,x,z,w,d,h,material='Namak_White',angle=0,apartment=False):
    # Test the actual oriented footprint. A bounding circle incorrectly rejects
    # the long civic wing even though its front edge is 64m from the track.
    c,s=math.cos(angle),math.sin(angle)
    clearance=min(math.hypot(max(0,abs((p['x']-x)*c-(p['z']-z)*s)-w/2),max(0,abs((p['x']-x)*s+(p['z']-z)*c)-d/2)) for p in points)
    if clearance<25: return False
    footprints.append(dict(name=name,x=x,z=z,w=w,d=d,h=h,angle=angle,clearance=clearance))
    box(name,x,h/2,z,w,h,d,material,angle)
    box(name+'_Roof',x,h+.25,z,w+.4,.5,d+.4,'Namak_Roof' if apartment else 'Namak_Silver',angle)
    box(name+'_Base',x,1.2,z,w+2,2.4,d+2,'Namak_Beige',angle)
    c,s=math.cos(angle),math.sin(angle)
    def local(xx,yy,zz,ww,hh,dd,m):box(name+'_Detail',x+xx*c+zz*s,yy,z-xx*s+zz*c,ww,hh,dd,m,angle)
    for floor in range(2,int(h/3.1)):
        yy=floor*3.1
        for k in range(max(2,int(w/3.7))):
            xx=-w/2+2+k*3.7
            for side in [-1,1]:
                local(xx,yy,side*(d/2+.02),1.7,1.65,.055,'Namak_WarmWindow' if random.random()<.035 else 'Namak_Window')
                if apartment:local(xx,yy-.91,side*(d/2+.35),2.2,.14,.65,'Namak_White')
        if apartment:local(0,yy,0,w+.08,.11,d+.08,'Namak_Beige')
    if apartment:
        local(-w*.32,h/2,d/2+.11,1.3,h-.8,.10,'Namak_Teal')
        text(name+'_Number',str(101+len(footprints)),x+(d/2+.15)*s,h-4,z+(d/2+.15)*c,1.7,'Namak_Dark',angle)
    else:
        for k in range(max(1,int(w/7))):local(-w/2+3.5+k*7,1.5,d/2+.04,5.3,2.4,.09,'Namak_Glass')
    return True

# Provincial office: slim blue tower + long low civic wing, roof canopy, columns.
building('Jeonnam_OfficeTower',365,-112,35,26,77,'Namak_Glass')
for x in [347,383]:box('OfficeStonePiers',x,38,-112,2.6,76,28,'Namak_White')
box('OfficeCrown',365,79,-112,44,2.3,33,'Namak_White')
for y in range(7,76,4):box('TowerCurtainBand',365,y,-98.7,35,.25,.35,'Namak_Silver')
building('Jeonnam_CivicWing',470,-85,148,42,16,'Namak_Glass')
box('CivicWhiteBand',470,6,-62.8,151,2.4,2,'Namak_White')
box('CivicCanopy',470,17.3,-83,156,1.1,48,'Namak_Roof')
for x in range(405,546,14):box('CivicColonnade',x,3,-53,1.1,6,1.1,'Namak_White')
box('OfficePlaza',455,.015,-45,260,.025,46,'Paving')
text('Office_Name','전라남도청',470,10,-62.0,3,'Namak_White')
ellipsoid('NamakReservoir',630,-.01,-154,92,.03,65,'Water')
box('ReservoirBoardwalk',614,.12,-91,107,.24,6,'Namak_Wood')
building('Council_Wing',615,-84,45,28,23,'Namak_Glass')
for x in range(285,700,25):tree(x,-52,.9,pine=True)
for x,z,h in [(80,-280,72),(340,-340,92),(665,-325,69),(860,-285,64)]:
    ellipsoid('Oryongsan_Hills',x,h*.38,z,220,h*.65,140,'Namak_Pine')
    for k in range(16):tree(x+random.uniform(-150,150),z+random.uniform(-55,55),random.uniform(1.2,2.1),True)

# Tall, pale apartment slabs; road-side frontage gets lower commercial blocks.
for row,z in enumerate([175,330,470]):
    for k,x in enumerate([40,105,170,235]):building('Park_Apartment',x,z,25,17,48+((k+row)%4)*9,angle=.12,apartment=True)
for k,x in enumerate([65,150,235]):building('Boulevard_Apartment',x,57,29,18,60+k*6,apartment=True)
for k,x in enumerate([330,410,520,620]):
    building('Boulevard_Shops',x,46,48,18,12+k%2*4,'Namak_Beige',math.pi)
    box('Boulevard_Sign',x,4,36.8,38,1.6,.2,'Namak_Teal')
    text('Boulevard_Name',['남악 중앙상가','남도 생활문화','남악 모터스','수변 커피'][k],x,4,36.65,2,'Namak_White',math.pi)
for row,x in enumerate([-188,-260]):
    for k,z in enumerate([80,190,310,430]):building('West_Apartment',x,z,29,18,57+k%3*9,angle=math.pi/2,apartment=True)
for k,z in enumerate([160,260,370,470]):
    building('East_Apartment',1060,z,29,18,63+k%3*9,angle=-math.pi/2,apartment=True)
for k,z in enumerate([150,210,275,340,410,470]):
    for x in [827,965]:
        building('Namak_Storefront',x,z,34,26,12+(k%3)*4,'Namak_Beige',math.pi/2)
        # Generic local shop names, not copied brand textures.
        signx=x-13.2 if x>900 else x+13.2
        box('ShopSign',signx,4,z,.16,1.7,27,'Namak_Blue' if k%2 else 'Namak_Teal')
        text('Store_Hangul',['남악 카페','남도 식당','무무 모터스','수변 베이커리','남악 서점','중앙 마켓'][k],signx+(.12 if x<900 else -.12),4,z,1.7,'Namak_White',math.pi/2 if x<900 else -math.pi/2)
for x in [300,395,510,615,700]:building('South_Residential',x,572,35,20,33+int(x)%3*9,'Namak_White',apartment=True)

# Central park: winding pedestrian path, civic plaza and small wooded Daejukdo.
for i in range(45):
    z=130+i*8;x=410+math.sin(i*.16)*32
    box('ParkWalk',x,.03,z,7,.06,9,'Paving',.4*math.cos(i*.16))
    if i%3==0:
        tree(x+17,z,.9);tree(x-17,z,.85)
        box('ParkBench',x+9,.65,z,2.8,.2,.65,'Namak_Wood')
box('KimDaejung_Plaza',410,.035,425,85,.07,65,'Paving')
box('Plaza_Monument',410,5.3,425,2,10.6,2,'Namak_White')
text('Park_Name','남악 중앙공원',410,1.8,148,2.5,'Namak_White')
ellipsoid('Daejukdo_Green',600,8,390,64,10,72,'Namak_Leaf')
for i in range(25):tree(600+random.uniform(-50,50),390+random.uniform(-55,55),1.3,True)
for i in range(80):
    x,z=random.uniform(-180,1020),random.uniform(50,720)
    if nearest(x,z)>28 and all(math.hypot(x-b['x'],z-b['z'])>math.hypot(b['w'],b['d'])/2+5 for b in footprints):tree(x,z,random.uniform(.75,1.1))

# Crosswalk paint and non-blocking traffic hardware suggest city intersections.
for idx in [25,335,680,1000]:
    p=points[idx%count];yaw=math.atan2(p['dx'],p['dz'])
    for off in range(-9,10,2):box('ZebraCrossing',p['x']+p['dz']*off,.046,p['z']-p['dx']*off,1,.013,4,'Namak_Line',yaw)
    x,z=p['x']+p['dz']*16,p['z']-p['dx']*16
    box('SignalPole',x,3.8,z,.22,7.6,.22,'Namak_Dark')
    box('SignalArm',p['x'],7.5,p['z'],33,.16,.16,'Namak_Dark',yaw)
    box('SignalHousing',p['x'],7.3,p['z'],1.6,.55,.30,'Namak_Dark',yaw)
    box('GreenLamp',p['x'],7.3,p['z']-.2,.27,.27,.06,'Namak_GreenSignal',yaw)

p=points[25]
for x in [p['x']-8,p['x']+8]:
    for off in [-1,1]:box('StartStripe',x,.041,p['z']+off*5,1.3,.008,9,'Namak_Line')
for z in [-14,14]:box('StartGantry',150,4.5,z,.45,9,.45,'Namak_Dark')
box('StartBanner',150,8.5,0,.3,1.9,29,'Namak_Blue')
text('Race_Title','NAMAK CITY CIRCUIT',149.80,8.5,0,1.4,'Namak_Line',-math.pi/2)

# Material groups are authored as spatial parts. Roads/colliders remain separate.
for key,(v,f,name,material,collider) in buckets.items():
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],f);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(materials[material])
    if collider:obj['unity_collider']=True;obj['namak_collision']=True
    if not collider:obj['namak_scenery']=True
    if material in ['Namak_Leaf','Namak_LeafLight','Namak_Pine','Water']:
        for poly in mesh.polygons:poly.use_smooth=True
bpy.context.scene['map_id']='namak';bpy.context.scene['reference_mode']=route['referenceMode']
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'namak.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'namak.glb'),export_format='GLB',export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
# Independent collision fixture comes from exactly the exported Blender objects.
chunks=[];entries=[];offset=0
for obj in bpy.context.scene.objects:
    if obj.type!='MESH' or not obj.get('namak_collision'):continue
    obj.data.calc_loop_triangles();v=array.array('f');indices=array.array('I')
    for vert in obj.data.vertices:
        p=obj.matrix_world@vert.co;v.extend((p.x,p.z,-p.y))
    for tri in obj.data.loop_triangles:indices.extend(tri.vertices)
    vb,ib=v.tobytes(),indices.tobytes();entries.append(dict(name=obj.name,offset=offset,vertices=len(v),indices=len(indices)))
    chunks.extend([vb,ib]);offset+=len(vb)+len(ib)
(EVIDENCE/'colliders.bin').write_bytes(b''.join(chunks));(EVIDENCE/'colliders.json').write_text(json.dumps(entries),encoding='utf-8')
report=dict(length=length,points=count,buildingFootprints=footprints,colliders=len(entries),meshes=sum(o.type=='MESH' for o in bpy.context.scene.objects),bytes=(OUT/'namak.glb').stat().st_size)
(EVIDENCE/'map-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('NAMAK_EXPORTED',json.dumps({k:v for k,v in report.items() if k!='buildingFootprints'}))
