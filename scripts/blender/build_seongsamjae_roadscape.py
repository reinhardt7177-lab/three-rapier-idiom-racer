"""Editable mountain-road scenery; the protected racing corridor is never rebuilt.

References and geographic limits: docs/SEONGSAMJAE_ROADSCAPE_20261013.md.
Run: blender --background --python scripts/blender/build_seongsamjae_roadscape.py
Coordinates in helpers are Three.js X,Y,Z. Blender uses X,-Z,Y.
"""
import bpy, math, json, hashlib, random
from pathlib import Path
from collections import defaultdict
from mathutils import Vector
from mathutils.kdtree import KDTree
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/assets/rebuild/seongsamjae-roadscape.glb'
BLEND = ROOT / 'assets-sources/seongsamjae/roadscape.blend'
PROOF = ROOT / 'artifacts/roadscape-20261013/seongsamjae'
PROOF.mkdir(parents=True, exist_ok=True)
route_path = ROOT / 'public/assets/rebuild/seongsamjae-route.json'
base_path = ROOT / 'public/assets/rebuild/seongsamjae.glb'
route = json.loads(route_path.read_text(encoding='utf-8'))
points = route['points']; n = len(points)
rng = random.Random(20261013)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(base_path))
bpy.context.view_layer.update()
ground_vertices, ground_faces = [], []
for ob in bpy.context.scene.objects:
    if ob.type != 'MESH' or not any(m and m.name.startswith('Terrain') for m in ob.data.materials): continue
    start = len(ground_vertices)
    ground_vertices.extend(ob.matrix_world @ v.co for v in ob.data.vertices)
    ground_faces.extend(tuple(start + i for i in f.vertices) for f in ob.data.polygons)
ground = BVHTree.FromPolygons(ground_vertices, ground_faces)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
kd = KDTree(n)
for i, p in enumerate(points): kd.insert((p['x'], 0, p['z']), i)
kd.balance()

def road_distance(x, z):
    _, nearest, _ = kd.find((x, 0, z)); result = float('inf')
    for i in range(nearest - 3, nearest + 4):
        a, b = points[i % n], points[(i + 1) % n]
        dx, dz = b['x'] - a['x'], b['z'] - a['z']
        t = max(0, min(1, ((x-a['x'])*dx+(z-a['z'])*dz)/(dx*dx+dz*dz)))
        result = min(result, math.hypot(x-a['x']-dx*t, z-a['z']-dz*t))
    return result

supports = []
def surface(x, z):
    hit, _, _, _ = ground.ray_cast(Vector((x, -z, 1000)), Vector((0, 0, -1)), 2000)
    if hit is None: raise RuntimeError(f'No original terrain under {x}, {z}')
    return hit.z

def anchor(x, z, feature):
    y = surface(x, z)
    supports.append(dict(x=x, z=z, groundY=y, feature=feature))
    return y

def point(i, off=0, height=0):
    p = points[i % n]
    return (p['x']+p['dz']*off, p['y']+height, p['z']-p['dx']*off)

buckets = {}; rejected = defaultdict(int); features = defaultdict(int)
seam_contacts = []; chevrons = []
def mesh(vs, faces, color, feature, tier=1):
    accepted=[]
    for face in faces:
        face_points = [vs[i] for i in face]
        samples = face_points + [tuple(sum(p[k] for p in face_points)/len(face_points) for k in range(3))]
        samples += [tuple((p[k]+face_points[(j+1)%len(face_points)][k])/2 for k in range(3)) for j,p in enumerate(face_points)]
        if any(road_distance(p[0], p[2]) < 12.55 for p in samples):
            rejected[feature] += 1; continue
        accepted.append(face)
    if not accepted: return
    cx, cz = math.floor(sum(v[0] for v in vs)/len(vs)/96), math.floor(sum(v[2] for v in vs)/len(vs)/96)
    data = buckets.setdefault((cx, cz, tier), dict(vertices=[], faces=[], colors=[], features=set()))
    index = len(data['vertices']); data['vertices'].extend(vs)
    data['faces'].extend(tuple(index+i for i in f) for f in accepted)
    data['colors'].extend([(*color, 1)]*len(vs)); data['features'].add(feature)
    features[feature] += 1

def box(center, size, color, feature, yaw=0, tier=1):
    x,y,z=center; w,h,d=size; vs=[]
    for yy in [-h/2,h/2]:
        for xx,zz in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]:
            vs.append((x+xx*math.cos(yaw)+zz*math.sin(yaw),y+yy,z-xx*math.sin(yaw)+zz*math.cos(yaw)))
    mesh(vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],color,feature,tier)

def beam(a,b,r,color,feature,tier=2,sides=4):
    a,b=Vector(a),Vector(b); tangent=(b-a).normalized(); u=tangent.cross(Vector((0,1,0)))
    if u.length<.001: u=tangent.cross(Vector((1,0,0)))
    u.normalize();v=tangent.cross(u);vertices=[]
    for p in [a,b]:
        for j in range(sides): vertices.append(tuple(p+r*(u*math.cos(j*math.tau/sides)+v*math.sin(j*math.tau/sides))))
    faces=[tuple(reversed(range(sides))),tuple(range(sides,sides*2))]
    faces += [(j,(j+1)%sides,(j+1)%sides+sides,j+sides) for j in range(sides)]
    mesh(vertices,faces,color,feature,tier)

# Six distinct rock-cut sections climb with the existing surface. Their lower
# skirt touches the actual exported terrain; their irregular crest makes the
# road feel cut into a hillside, instead of standing on a flat empty slab.
sections = [(230,385,-1),(510,735,1),(1030,1265,-1),(1470,1720,1),(2250,2380,-1),(2470,2560,-1)]
for section,(begin,end,side) in enumerate(sections):
    rows=[]
    for i in range(begin,end+1,4):
        p=points[i]; taper=min(1,(i-begin)/22,(end-i)/22)
        crest=max(1.8,(13+3.5*math.sin(i*.043)+2.3*math.sin(i*.117))*taper)
        row=[]
        for band in range(7):
            t=band/6; off=side*(16.5+t*13+1.1*math.sin(i*.21+band*1.73)*math.sin(math.pi*t))
            x,_,z=point(i,off); gy=anchor(x,z,'rock-cut-foot') if band==0 else surface(x,z)
            y=gy-.12 if band==0 else p['y']-1+crest*math.sin(t*math.pi*.63)
            if band==6: y=max(gy,y)
            row.append((x,y,z))
        # Back skirt closes the high rock onto actual existing terrain.
        x,_,z=point(i,side*37); row.append((x,surface(x,z)-.10,z)); rows.append(row)
    for j in range(len(rows)-1):
        for k in range(7):
            # Layered earth / weathered granite rather than a uniform silver
            # faceted bank. Values are linear, so daylight does not bleach them.
            shade=.86+rng.random()*.18
            palette=[(.11,.115,.085),(.15,.12,.08),(.095,.11,.10),(.18,.15,.11),(.10,.12,.065),(.085,.12,.045),(.07,.095,.035)]
            layer=palette[k];color=tuple(c*shade for c in layer)
            vs=[rows[j][k],rows[j+1][k],rows[j+1][k+1],rows[j][k+1]]
            mesh(vs,[(0,1,2),(0,2,3)],color,'layered-rock-cut')
    # Each seam follows an ACTUAL shared mesh edge. Fixed elevations relative
    # to the road used to float above the tapered ends of each rock cutting.
    for j in range(2,len(rows)-3,3):
        for band in [2,4,5]:
            a,b=rows[j][band],rows[j+1][band]
            beam(a,b,.09,(.07,.072,.048),'bedding-seam',2)
            seam_contacts.append(dict(a=a,b=b,rockFace=[rows[j][band-1],rows[j+1][band-1],rows[j+1][band],rows[j][band]]))
    # Roadside catch fence, rather than painting a net on asphalt.
    for i in range(begin+8,end-8,12):
        x,_,z=point(i,side*15.4);base=anchor(x,z,'catch-fence')
        beam((x,base-.1,z),(x,points[i]['y']+4.5,z),.065,(.29,.34,.35),'catch-fence-post')
        for height in [1.7,3.0,4.3]:
            beam(point(i,side*15.4,height),point(i+12,side*15.4,height),.027,(.31,.35,.34),'catch-fence-wire')
        for d in [0,4,8]:
            beam(point(i+d,side*15.4,1.7),point(i+d+4,side*15.4,4.3),.024,(.29,.34,.33),'catch-fence-mesh')
            beam(point(i+d,side*15.4,4.3),point(i+d+4,side*15.4,1.7),.024,(.29,.34,.33),'catch-fence-mesh')

# Valley retaining faces, open drainage channels and a real W-profile metal
# rail at the selected bends. Existing race barriers remain the collision wall.
rail_sections=[(340,515,1),(825,1030,-1),(1290,1480,1),(1850,2120,1),(2240,2520,1)]
for begin,end,side in rail_sections:
    for i in range(begin,end,5):
        a,b=points[i],points[i+5]
        ax,_,az=point(i,side*13.4);bx,_,bz=point(i+5,side*13.4)
        ga,gb=anchor(ax,az,'retaining-foot'),anchor(bx,bz,'retaining-foot')
        vs=[(ax,ga-.08,az),(bx,gb-.08,bz),(bx,b['y']+.06,bz),(ax,a['y']+.06,az)]
        mesh(vs,[(0,1,2),(0,2,3)],(.28,.31,.28),'valley-retaining-wall')
        # Drainage trough's lower floor and edge lips follow road elevation.
        for off,h in [(13.8,-.48),(14.4,-.48),(13.8,-.15),(14.4,-.15)]:
            if h>-.2: beam(point(i,side*off,h),point(i+5,side*off,h),.07,(.40,.43,.39),'drain-lip',2)
        mesh([point(i,side*13.8,-.47),point(i+5,side*13.8,-.47),point(i+5,side*14.4,-.47),point(i,side*14.4,-.47)],[(0,1,2,3)],(.16,.19,.17),'drain-channel',2)
        # Folded double-lobed guard rail cross section in world space.
        profile=[(-.08,1.0),(.07,1.1),(-.06,1.25),(.07,1.4),(-.08,1.5)]
        vs=[point(j,side*(13.3+off),h) for j in [i,i+5] for off,h in profile]
        mesh(vs,[(k,k+5,k+6,k+1) for k in range(4)],(.54,.61,.63),'W-guardrail')
        x,_,z=point(i,side*13.48); base=anchor(x,z,'guardrail-post')
        box((x,(base+a['y']+1.47)/2,z),(.16,a['y']+1.47-base,.16),(.30,.36,.36),'guardrail-post',tier=2)
        if i%10==begin%10: box(point(i,side*13.14,1.27),(.14,.22,.12),(.94,.69,.13),'amber-reflector',tier=2)

# Direction chevrons and convex roadside mirrors make hairpins legible at speed.
for center,side in [(438,1),(914,-1),(1413,1),(1880,-1),(2120,1),(2630,1)]:
    for d in [-36,-12,12,36]:
        i=center+d;p=points[i]; yaw=math.atan2(p['dx'],p['dz']);x,_,z=point(i,side*14.5);base=anchor(x,z,'chevron')
        box((x,(base+p['y']+3.3)/2,z),(.12,p['y']+3.3-base,.12),(.31,.36,.35),'chevron-post',yaw)
        box((x,p['y']+3.05,z),(1.6,1.18,.09),(.94,.67,.08),'chevron-board',yaw)
        # Arrow geometry is slightly offset from the approach-facing board.
        outline=[(-.56,-.46),(-.13,-.46),(.5,0),(-.13,.46),(-.56,.46),(.07,0)]
        vertices=[]
        before,after=points[(i-15)%n],points[(i+15)%n]
        curvature=before['dx']*after['dz']-before['dz']*after['dx']
        if abs(curvature)<.001: raise RuntimeError(f'Chevron needs a real turn at route {i}')
        turn_sign=1 if curvature>0 else -1
        # Positive outline u is world (dz, 0, -dx), which is screen LEFT
        # for the approaching driver. Turn direction must not use road side.
        for u,v in outline:
            u*=-turn_sign;vertices.append((x+u*math.cos(yaw)-p['dx']*.053,p['y']+3.05+v,z-u*math.sin(yaw)-p['dz']*.053))
        mesh(vertices,[(0,1,5),(1,2,5),(2,3,5),(3,4,5)],(.025,.035,.028),'chevron-arrow')
        chevrons.append(dict(routeIndex=i,turn='right' if turn_sign>0 else 'left',tip=vertices[2],tailVertices=[vertices[0],vertices[4]],curvature=curvature))
    i=center-48;p=points[i];x,_,z=point(i,side*15.6);base=anchor(x,z,'mirror')
    beam((x,base-.1,z),(x,p['y']+4.2,z),.09,(.58,.29,.10),'mirror-post',1,6)
    # A shallow convex dish is geometry, not a fake realtime reflection pass.
    normal=Vector((-p['dx'],0,-p['dz']));right=Vector((p['dz'],0,-p['dx']));origin=Vector((x,p['y']+4.2,z))
    vs=[tuple(origin+normal*.16)]+[tuple(origin+right*math.cos(j*math.tau/16)*.66+Vector((0,math.sin(j*math.tau/16)*.66,0))) for j in range(16)]
    mesh(vs,[(0,j+1,(j+1)%16+1) for j in range(16)],(.59,.73,.78),'convex-mirror')
    for j in range(16):beam(vs[j+1],vs[(j+1)%16+1],.045,(.9,.36,.06),'mirror-rim',2)

# Summit deck is perched beside the existing rest area, with terrain-anchored
# piers, planked floor, cross-braced balustrades, benches and a timber shelter.
# It never suggests that ordinary vehicles can drive to Nogodan summit.
deck_x,deck_z=-70.9358,782.077
deck_y=154.34
for row in range(27):
    z=deck_z-7.9+row*.6
    box((deck_x,deck_y,z),(23.6,.22,.55),(.24+row%3*.025,.14+row%3*.012,.075),'overlook-planks')
for dx in [-11.2,0,11.2]:
    for dz in [-7.7,7.7]:
        x,z=deck_x+dx,deck_z+dz;gy=anchor(x,z,'deck-pier')
        box((x,(gy+deck_y)/2,z),(.55,deck_y-gy,.55),(.24,.28,.25),'deck-pier')
for dx in [-11.65,11.65]:
    for j in range(9):
        z=deck_z-7.8+j*1.95;x=deck_x+dx
        box((x,deck_y+.6,z),(.18,1.2,.18),(.25,.135,.067),'deck-railing')
        if j<8:
            for h in [.6,1.15]:beam((x,deck_y+h,z),(x,deck_y+h,z+1.95),.065,(.32,.18,.09),'deck-rail',1)
            beam((x,deck_y+.18,z),(x,deck_y+1.1,z+1.95),.055,(.25,.135,.067),'deck-brace',2)
for dz in [-7.8,7.8]:
    beam((deck_x-11.7,deck_y+1.15,deck_z+dz),(deck_x+11.7,deck_y+1.15,deck_z+dz),.07,(.32,.18,.09),'deck-rail',1)
for dx in [-7,7]:
    box((deck_x+dx,deck_y+.48,deck_z),(3.4,.18,.74),(.36,.21,.1),'overlook-bench')
    for off in [-1.2,1.2]:box((deck_x+dx+off,deck_y+.24,deck_z),(.14,.48,.6),(.18,.22,.20),'bench-leg',tier=2)
# Hip-roof pavilion, with open sightlines beneath the timber roof.
px,pz=deck_x,deck_z-4.6
for dx in [-2.5,2.5]:
    for dz in [-2,2]:box((px+dx,deck_y+1.65,pz+dz),(.22,3.3,.22),(.25,.14,.07),'pavilion-post')
mesh([(px-3.4,deck_y+3.1,pz-2.8),(px+3.4,deck_y+3.1,pz-2.8),(px+3.4,deck_y+3.1,pz+2.8),(px-3.4,deck_y+3.1,pz+2.8),(px-1.1,deck_y+4.4,pz),(px+1.1,deck_y+4.4,pz)],[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4)],(.16,.21,.19),'overlook-pavilion')

# Vertex colors provide unique rock strata / timber variation with a single
# shared material; spatial cells bound culling and prevent per-prop draw calls.
mat=bpy.data.materials.new('Roadscape_Mountain_VertexColor');mat.use_nodes=True
bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.87
colors=mat.node_tree.nodes.new('ShaderNodeVertexColor');colors.layer_name='Color'
mat.node_tree.links.new(colors.outputs['Color'],bsdf.inputs['Base Color'])
total_triangles=0
for (cx,cz,tier),data in sorted(buckets.items()):
    name=f'Roadscape_seongsamjae_{cx}_{cz}_tier{tier}'
    mesh_data=bpy.data.meshes.new(name)
    mesh_data.from_pydata([(x,-z,y) for x,y,z in data['vertices']],[],data['faces']);mesh_data.update();mesh_data.materials.append(mat)
    attr=mesh_data.color_attributes.new(name='Color',type='BYTE_COLOR',domain='POINT')
    for i,color in enumerate(data['colors']):attr.data[i].color=color
    ob=bpy.data.objects.new(name,mesh_data);bpy.context.collection.objects.link(ob)
    ob['roadscape']=True;ob['qualityTier']=tier;ob['cellX']=cx;ob['cellZ']=cz;ob['cellSize']=96
    ob['features']=','.join(sorted(data['features']));ob['visualOnly']=True
    mesh_data.calc_loop_triangles();total_triangles+=len(mesh_data.loop_triangles)
bpy.context.scene['referenceMode']='photo-informed Nogodan-ro roadside; fictional protected 5.83km race loop'
bpy.context.scene['roadscapeTrack']='seongsamjae';bpy.context.scene['cellSize']=96
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND),compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
report=dict(track='seongsamjae',bytes=OUT.stat().st_size,triangles=total_triangles,meshes=len(buckets),materials=1,cellSize=96,minimumClearance=12.55,features=dict(features),rejectedFaces=dict(rejected),supports=supports,seamContacts=seam_contacts,chevrons=chevrons,viewpoints=[250,420,650,880,1070,1350,1520,1910,1980,2270],routeSha256=hashlib.sha256(route_path.read_bytes()).hexdigest(),baseSha256=hashlib.sha256(base_path.read_bytes()).hexdigest(),referenceMode=bpy.context.scene['referenceMode'])
(PROOF/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('SEONGSAMJAE_ROADSCAPE',json.dumps({k:v for k,v in report.items() if k not in ['supports','seamContacts','chevrons']},ensure_ascii=False))
if report['bytes']>3_000_000: raise RuntimeError('Roadscape exceeds the 3MB asset budget')
