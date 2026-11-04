"""Additive Yeosu roadscape, authored from OSM shoreline + bridge photographs.

Run with Blender --background --python scripts/blender/build_yeosu_roadscape.py.
Does not open or rewrite the existing track, route, colliders or original blend.
Gameplay X,Y,Z -> Blender X,-Z,Y; exported GLB is identity in gameplay space.
"""
import bpy
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[2]
PROOF = ROOT / 'artifacts/roadscape-20261013/yeosu'
SOURCE = ROOT / 'assets-sources/yeosu'
OUT = ROOT / 'public/assets/rebuild/yeosu-roadscape.glb'
ROUTE = ROOT / 'public/assets/rebuild/yeosu-route.json'
route = json.loads(ROUTE.read_text(encoding='utf-8'))
points = route['points']
shorelines = [s for s in json.loads((SOURCE / 'map/mapped-scenery.json').read_text(encoding='utf-8')) if s['kind'] == 'coastline']
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
PROOF.mkdir(parents=True, exist_ok=True)

kd = KDTree(len(points))
for i, p in enumerate(points):
    kd.insert((p['x'], 0, p['z']), i)
kd.balance()

def nearest(x, z):
    _, i, distance = kd.find((x, 0, z))
    return i, distance

def clearance(x, z):
    """Conservative nearest-segment asphalt clearance (max endpoint widths)."""
    _, i, _ = kd.find((x, 0, z))
    value = math.inf
    for j in range(i - 3, i + 4):
        a, b = points[j % len(points)], points[(j + 1) % len(points)]
        dx, dz = b['x'] - a['x'], b['z'] - a['z']
        den = dx * dx + dz * dz
        t = max(0, min(1, ((x-a['x'])*dx + (z-a['z'])*dz) / den)) if den else 0
        distance = math.hypot(x-a['x']-t*dx, z-a['z']-t*dz)
        value = min(value, distance-max(a['roadWidth'], b['roadWidth'])/2)
    return value

materials = {}
def material(name, color, roughness=.75, metalness=0, emission=0):
    mat = bpy.data.materials.new('YeosuRoadscape_' + name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metalness
    if emission:
        shader.inputs['Emission Color'].default_value = (*color, 1)
        shader.inputs['Emission Strength'].default_value = emission
    materials[name] = mat

material('Limestone', (.34, .39, .40))
material('Paving', (.47, .45, .40))
material('Steel', (.17, .25, .29), .44, .62)
material('DarkRubber', (.035, .045, .055))
material('WarmMarker', (.90, .55, .18), .5, 0, 1.4)
material('BridgeCyan', (.05, .43, .60), .4, .2, 1.3)
material('BridgeRose', (.63, .13, .30), .4, .2, 1.3)
material('HamelRed', (.58, .018, .024), .48, .15, .15)
buckets = {}
counts = Counter()
accepted = []
rejected = Counter()

def mesh(role, vertices, faces, mat, tier=1, source=None):
    # All geometry is outside every route's full asphalt width plus a 1m buffer.
    # Sample edges every <=1m too; vertices alone could straddle a tight corner.
    for face in faces:
        for k, ia in enumerate(face):
            a, b = vertices[ia], vertices[face[(k + 1) % len(face)]]
            steps = max(1, math.ceil(math.hypot(b[0]-a[0], b[2]-a[2])))
            for q in range(steps + 1):
                f = q / steps
                if clearance(a[0]+(b[0]-a[0])*f, a[2]+(b[2]-a[2])*f) < 1.2:
                    rejected[role] += 1
                    return False
    cx = sum(v[0] for v in vertices) / len(vertices)
    cz = sum(v[2] for v in vertices) / len(vertices)
    key = (math.floor(cx / 128), math.floor(cz / 128), mat, tier)
    bucket = buckets.setdefault(key, {'v': [], 'f': [], 'roles': Counter()})
    base = len(bucket['v'])
    bucket['v'].extend(vertices)
    bucket['f'].extend(tuple(base+i for i in f) for f in faces)
    bucket['roles'][role] += 1
    counts[role] += 1
    if source is not None:
        accepted.append({'role': role, 'source': source, 'x': cx, 'z': cz})
    return True

BOX_FACES = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
def box(role, center, width, height, depth, mat, dx=1, dz=0, tier=1, source=None):
    x, y, z = center
    # local x follows segment, local z is the segment's right-handed lateral.
    vs = [(x+xx*dx-zz*dz, y+yy, z+xx*dz+zz*dx)
          for yy in [-height/2, height/2]
          for xx, zz in [(-width/2,-depth/2),(width/2,-depth/2),(width/2,depth/2),(-width/2,depth/2)]]
    return mesh(role, vs, BOX_FACES, mat, tier, source)

def beam(role, a, b, radius, mat, tier=1, sides=4):
    a, b = Vector(a), Vector(b)
    d = (b-a).normalized()
    u = d.cross(Vector((0,1,0)))
    if u.length < .001:
        u = Vector((1,0,0))
    u.normalize()
    v = d.cross(u).normalized()
    vs = [tuple(p+radius*(u*math.cos(k*2*math.pi/sides)+v*math.sin(k*2*math.pi/sides))) for p in [a,b] for k in range(sides)]
    faces = [tuple(range(sides-1,-1,-1)),tuple(range(sides,2*sides))]
    faces += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    return mesh(role, vs, faces, mat, tier)

def rail(a, b, y, prefix, glow=None):
    # Continuous horizontal rail + individual stanchions make road speed legible.
    length = math.dist(a, b)
    if length < .01:
        return
    for h in [.42, 1.12]:
        beam(prefix+'Rail', (a[0],y+h,a[1]), (b[0],y+h,b[1]), .045, 'Steel', 2)
    # Adjacent intervals share the next start post; do not export coincident poles.
    for k in range(math.ceil(length/4.5)):
        f = k / max(1, math.ceil(length/4.5))
        x,z = a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f
        beam(prefix+'Post', (x,y,z), (x,y+1.15,z), .065, 'Steel', 2)
    if glow:
        beam(prefix+'Marker', (a[0],y+.16,a[1]), (b[0],y+.16,b[1]), .035, glow, 1, 4)

# Official MOF Hamel lighthouse position, projected with the same OSM origin.
origin = route['mapSource']['origin']
hamel = ((127.74710-origin['lon'])*111320*math.cos(math.radians(origin['lat'])),
         (origin['lat']-34.73644)*111320)

# OSM coastline orientation has land to its left. In gameplay X/Z, that normal
# is (dz, -dx). Keep short quays where the current road is nearby and coastal.
# Vertical shore levels are authored (water=-4.89, road≈8), not surveyed tides.
for shore in shorelines:
    if shore['wayId'] != 568320091:
        continue  # main port + Dolsan shore, not offshore Janggun Island.
    coords = shore['points']
    for si, (a, b) in enumerate(zip(coords, coords[1:])):
        length = math.dist(a,b)
        if length < 1 or length > 160:
            continue
        dx,dz = (b[0]-a[0])/length, (b[1]-a[1])/length
        nx,nz = dz,-dx
        splits = math.ceil(length / 12)
        for part in range(splits):
            f0,f1 = part/splits,(part+1)/splits
            start = (a[0]+(b[0]-a[0])*f0,a[1]+(b[1]-a[1])*f0)
            end = (a[0]+(b[0]-a[0])*f1,a[1]+(b[1]-a[1])*f1)
            cx,cz = (start[0]+end[0])/2,(start[1]+end[1])/2
            idx,dist = nearest(cx,cz)
            lighthouse_quay = math.hypot(cx-hamel[0],cz-hamel[1]) < 35
            if (dist > (145 if lighthouse_quay else 85)) or points[idx]['y'] > 14:
                continue
            slab_length = length/splits
            if not box('QuaySeaWall', (cx,1.3,cz), slab_length, 13.0, 1.3, 'Limestone', dx,dz,source={'wayId':shore['wayId'],'segment':si}):
                continue
            # Broad coping + inset walkway, fully supported by solid shore plinth.
            box('QuayCoping', (cx,7.86,cz), slab_length+.12,.26,1.85,'Paving',dx,dz)
            box('PromenadeFoundation', (cx+nx*3.2,1.12,cz+nz*3.2), slab_length,13,5.3,'Limestone',dx,dz)
            box('PromenadeSurface', (cx+nx*3.2,7.7,cz+nz*3.2), slab_length,.18,5.3,'Paving',dx,dz)
            rail((start[0]-nx*.8,start[1]-nz*.8),(end[0]-nx*.8,end[1]-nz*.8),8.0,'Harbor','WarmMarker')
            # Visible wall panel seams and rubber fenders reveal scale at speed.
            for off in [-slab_length*.33,0,slab_length*.33]:
                x,z = cx+dx*off-nx*.71,cz+dz*off-nz*.71
                mesh('SeaWallJoint',[(x-dx*.045,-3.8,z-dz*.045),(x+dx*.045,-3.8,z+dz*.045),(x+dx*.045,7.5,z+dz*.045),(x-dx*.045,7.5,z-dz*.045)],[(0,1,2,3)],'DarkRubber',2)
            if (si+part)%2 == 0:
                x,z = cx-nx*.96,cz-nz*.96
                box('QuayRubberFender',(x,1.4,z),.85,3.4,.5,'DarkRubber',dx,dz,2)
                beam('MooringBollard',(cx+nx*.35,7.95,cz+nz*.35),(cx+nx*.35,8.5,cz+nz*.35),.16,'Steel',2,6)
                beam('BollardCrossbar',(cx+nx*.35-dx*.32,8.42,cz+nz*.35-dz*.32),(cx+nx*.35+dx*.32,8.42,cz+nz*.35+dz*.32),.10,'Steel',2,4)

# The game keeps adapted bridge elevations; build structural detail against
# those exact heights rather than adding a separate colliding bridge deck.
for label, target, half_span, glow in [('Dolsan',(-290,890),165,'BridgeRose'),('Geobukseon',(980,535),270,'BridgeCyan')]:
    center = min(range(len(points)),key=lambda i:math.hypot(points[i]['x']-target[0],points[i]['z']-target[1]))
    for delta in range(-half_span,half_span,8):
        a,b = points[(center+delta//2)%len(points)],points[(center+(delta+8)//2)%len(points)]
        for side in [-1,1]:
            off = side*14.8
            av = (a['x']+a['dz']*off,a['z']-a['dx']*off)
            bv = (b['x']+b['dz']*off,b['z']-b['dx']*off)
            length=math.dist(av,bv)
            dx,dz=(bv[0]-av[0])/length,(bv[1]-av[1])/length
            cx,cz=(av[0]+bv[0])/2,(av[1]+bv[1])/2
            y=(a['y']+b['y'])/2
            box(label+'DeckEdge',(cx,y-.9,cz),length+.04,1.6,1.15,'Limestone',dx,dz,source={'routeIndex':center,'side':side})
            # Pair of edge flanges, short diaphragm and low rail outside barriers.
            for h in [-1.55,-.3]:
                box(label+'GirderFlange',(cx,y+h,cz),length+.05,.16,1.38,'Steel',dx,dz)
            box(label+'Diaphragm',(cx,y-.95,cz),.15,1.0,1.45,'Steel',dx,dz,2)
            rail(av,bv,y+.08,label,glow)
    # Supports extend below sea surface; no floating column bottoms.
    for delta in [-90,90]:
        p = points[(center+delta//2)%len(points)]
        for side in [-1,1]:
            x,z=p['x']+p['dz']*side*15,p['z']-p['dx']*side*15
            top=p['y']-.2
            box(label+'Pier',(x,(top-6)/2,z),2.7,top+6,3.8,'Limestone',p['dx'],p['dz'])
            box(label+'PierCap',(x,top-1.4,z),4.4,2.1,4.7,'Paving',p['dx'],p['dz'])
            box(label+'PylonCollar',(x,p['y']+1.7,z),2.65,1.0,2.65,'Steel',p['dx'],p['dz'],2)

# Recognisable red tapered beacon, gallery and capped lantern. The official
# height is 10m; local foundation level follows this game's adapted port level.
hx,hz=hamel
box('HamelFoundation',(hx,.9,hz),7.8,13.8,7.8,'Limestone')
box('HamelPlatform',(hx,7.94,hz),8,.24,8,'Paving')
def revolve(role,rings,mat,sides=12):
    vs=[(hx+r*math.cos(i*math.tau/sides),y,hz+r*math.sin(i*math.tau/sides)) for y,r in rings for i in range(sides)]
    faces=[tuple(range(sides))]
    for j in range(len(rings)-1):
        a=j*sides;b=a+sides
        faces.extend((a+i,b+i,b+(i+1)%sides,a+(i+1)%sides) for i in range(sides))
    faces.append(tuple(range(len(vs)-1,len(vs)-sides-1,-1)))
    return mesh(role,vs,faces,mat,source={'authority':'MOF Yeosu','latitude':34.73644,'longitude':127.74710,'heightMeters':10})
revolve('HamelTaperedTower',[(8.06,2.05),(8.45,2.05),(14.2,1.38)],'HamelRed',8)
revolve('HamelGallery',[(14.2,2.03),(14.48,2.03)],'HamelRed')
revolve('HamelLantern',[(14.48,1.2),(16.6,1.2)],'Steel')
revolve('HamelLanternRoof',[(16.6,1.56),(16.88,1.38),(17.68,.2)],'HamelRed')
beam('HamelFinial',(hx,17.68,hz),(hx,18.06,hz),.08,'Steel',1,4)
for i in range(12):
    a=i*math.tau/12;b=(i+1)*math.tau/12
    x,z=hx+1.92*math.cos(a),hz+1.92*math.sin(a)
    beam('HamelGalleryPost',(x,14.48,z),(x,15.45,z),.04,'Steel',2,4)
    beam('HamelGalleryRail',(x,15.45,z),(hx+1.92*math.cos(b),15.45,hz+1.92*math.sin(b)),.045,'Steel',2,4)
    if i%3==0:
        x,z=hx+1.21*math.cos(a),hz+1.21*math.sin(a)
        beam('HamelLanternMullion',(x,14.5,z),(x,16.58,z),.055,'HamelRed',2,4)
box('HamelDoor',(hx,9.4,hz-1.84),.7,2.05,.08,'DarkRubber')

records=[]
for (cx,cz,mat,tier), bucket in sorted(buckets.items()):
    name=f'YeosuRoadscape_{cx}_{cz}_{mat}_T{tier}'
    data=bpy.data.meshes.new(name)
    data.from_pydata([(x,-z,y) for x,y,z in bucket['v']],[],bucket['f'])
    data.update()
    ob=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    data.materials.append(materials[mat])
    ob['roadscapeTier']=tier
    ob['roadscapeCell']=[cx,cz]
    ob['roadscapeRoleCounts']=json.dumps(dict(bucket['roles']),sort_keys=True)
    ob['roadscapeVisualOnly']=True
    data.calc_loop_triangles()
    records.append({'name':name,'tier':tier,'cell':[cx,cz],'vertices':len(data.vertices),'triangles':len(data.loop_triangles),'roles':dict(bucket['roles'])})

bpy.context.scene['roadscapeMap']='yeosu'
bpy.context.scene['referenceMode']='OSM shoreline / photo-derived structural detail; heights and dimensions race-authored'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'roadscape.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True)
report={'map':'yeosu','routeSha256':hashlib.sha256(ROUTE.read_bytes()).hexdigest(),'sourceWorldSha256':hashlib.sha256((OUT.parent/'yeosu.glb').read_bytes()).hexdigest(),'glbSha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'bytes':OUT.stat().st_size,'objects':len(records),'vertices':sum(r['vertices'] for r in records),'triangles':sum(r['triangles'] for r in records),'counts':dict(counts),'rejectedPrimitives':dict(rejected),'meshes':records,'anchors':accepted,'quality':{'high':{'tier':2,'distance':300},'medium':{'tier':1,'distance':180},'low':{'tier':0,'distance':0}},'extraLights':0,'extraTextures':0,'extraShadows':0,'asphaltEdgeBufferMeters':1.2}
(PROOF/'asset-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('YEOSU_ROADSCAPE',json.dumps({k:v for k,v in report.items() if k not in ['meshes','anchors']},ensure_ascii=False))
