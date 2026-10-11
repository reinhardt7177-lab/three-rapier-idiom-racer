"""Photo-inspired racing corridors, not surveyed geography or public road routes.
Blender X,-Y,Z maps to gameplay X,Z,Y. Deterministic local mesh authoring.
"""
import bpy, math, random, json, array
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

def build(kind):
    night=kind=='yeosu';random.seed(20261011)
    out=ROOT/'public/assets/rebuild';src=ROOT/'assets-sources'/kind
    proof=ROOT/'artifacts/korea-circuits-20261011'/kind
    for p in [out,src,proof]:p.mkdir(parents=True,exist_ok=True)
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.context.preferences.filepaths.save_version=0
    font=bpy.data.fonts.load('C:/Windows/Fonts/malgun.ttf')
    mats={};buckets={}
    def material(name,color,emit=0,metal=0,rough=.8):
        m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
        b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1)
        b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal
        if emit:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emit
        mats[name]=m
    for name,color,emit in [('Asphalt',(.13,.17,.22),0),('Terrain',(.09,.18,.10),0),('Concrete',(.42,.48,.51),0),('Leaf',(.045,.16,.075),0),('Bark',(.13,.09,.055),0),('Stone',(.29,.35,.31),0),('Facade',(.23,.31,.37),0),('Roof',(.08,.12,.13),0),('Window',(.60,.42,.16),1 if night else 0),('Water',(.018,.06,.14),0),('Wayfinding_Text',(.86,.95,1),.5),('Wayfinding_Accent',(.09,.36,.27),.2),('Yellow',(.95,.67,.13),.4 if night else 0),('White',(.75,.83,.90),.5 if night else 0),('Pink',(.90,.06,.29),3),('Cyan',(.04,.65,.85),3)]:material(name,color,emit)
    def mesh(name,vs,faces,mat,collider=False,batch=True):
        if batch and not collider:
            cx=sum(p[0] for p in vs)/len(vs);cz=sum(p[2] for p in vs)/len(vs)
            key=(mat,int(cx//128),int(cz//128))
            vertices,indices=buckets.setdefault(key,([],[]));base=len(vertices);vertices.extend(vs)
            indices.extend(tuple(base+i for i in f) for f in faces);return None
        data=bpy.data.meshes.new(name);data.from_pydata([(x,-z,y) for x,y,z in vs],[],faces);data.update()
        ob=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(ob);data.materials.append(mats[mat])
        if collider:ob['unity_collider']=True;ob['korea_collision']=True
        return ob
    def box(name,x,y,z,w,h,d,mat,yaw=0,batch=True):
        vs=[]
        for yy in [-h/2,h/2]:
            for xx,zz in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]:
                vs.append((x+xx*math.cos(yaw)+zz*math.sin(yaw),y+yy,z-xx*math.sin(yaw)+zz*math.cos(yaw)))
        return mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat,batch=batch)
    def beam(name,a,b,r,mat):
        bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=r,depth=math.dist(a,b),location=tuple((a[i]+b[i])/2 for i in range(3)))
        ob=bpy.context.object;ob.name=name
        from mathutils import Vector
        # Inputs here are gameplay axes; convert transform and merge into cells.
        ob.location=(ob.location.x,-ob.location.z,ob.location.y)
        vector=Vector((b[0]-a[0],-(b[2]-a[2]),b[1]-a[1]));ob.rotation_euler=vector.to_track_quat('Z','Y').to_euler();bpy.context.view_layer.update()
        vs=[ob.matrix_world@v.co for v in ob.data.vertices];faces=[tuple(p.vertices) for p in ob.data.polygons]
        mesh(name,[(v.x,v.z,-v.y) for v in vs],faces,mat);data=ob.data;bpy.data.objects.remove(ob,do_unlink=True);bpy.data.meshes.remove(data)
    controls=([(0,8,0),(350,8,0),(700,8,0),(950,12,120),(1030,12,480),(850,8,720),(350,8,800),(-100,8,650),(-280,8,300),(-180,8,40)] if night else
              [(0,0,0),(350,0,0),(800,20,60),(940,30,160),(800,40,260),(200,60,260),(60,70,360),(200,80,460),(800,100,460),(940,110,560),(800,120,660),(200,140,660),(20,150,800),(-150,150,900),(-330,145,800),(-430,110,600),(-430,65,200),(-300,25,-130),(-80,0,-180)])
    # Closed Catmull-Rom, densely sampled then resampled at <=2m in 3D.
    raw=[]
    for i in range(len(controls)):
        a,b,c,d=[controls[(i+j)%len(controls)] for j in [-1,0,1,2]]
        for j in range(500):
            t=j/500;raw.append(tuple(.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t**3) for k in range(3)))
    lengths=[0]
    for i in range(len(raw)):lengths.append(lengths[-1]+math.dist(raw[i],raw[(i+1)%len(raw)]))
    length=lengths[-1];n=math.ceil(length/2);points=[];cursor=0
    for i in range(n):
        dist=i*length/n
        while lengths[cursor+1]<dist:cursor+=1
        f=(dist-lengths[cursor])/(lengths[cursor+1]-lengths[cursor]);a=raw[cursor];b=raw[(cursor+1)%len(raw)]
        x,y,z=[a[k]+f*(b[k]-a[k]) for k in range(3)]
        if night:region='이순신광장·해양공원' if z<100 else '거북선대교' if x>900 else '오동도 방향 스위퍼' if z>650 else '돌산대교'
        else:region='화엄사 아래 출발' if z<100 and x>-300 else '성삼재 휴게소·노고단 전망' if y>135 else '지리산 연속 헤어핀' if x>0 else '구례 숲길 하산'
        points.append(dict(x=x,y=y+.025,z=z,distance=dist,region=region))
    # Keep the grid on a level straight, with enough preceding space for 6 cars.
    start=min(range(n),key=lambda i:math.hypot(points[i]['x']-180,points[i]['z']))
    points=points[start-25:]+points[:start-25]
    for i,p in enumerate(points):
        a,b=points[i-1],points[(i+1)%n];dx,dz=b['x']-a['x'],b['z']-a['z'];norm=math.hypot(dx,dz)
        p.update(dx=dx/norm,dz=dz/norm,distance=i*length/n)
    route=dict(id=kind,name='YEOSU NIGHT SEA' if night else 'JIRISAN SEONGSAMJAE',closed=True,width=22,length=length,startIndex=25,referenceMode='photo-inspired racing corridor, not surveyed geography',points=points)
    (out/(kind+'-route.json')).write_text(json.dumps(route,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    def strip(name,lo,hi,dy,mat,collider=False):
        # Asphalt is one welded surface: separate collision chunks can miss
        # rays exactly on their end edges despite matching float positions.
        chunk=n if collider else 64
        for begin in range(0,n,chunk):
            vs=[];faces=[]
            for k in range(min(chunk,n-begin)+1):
                p=points[(begin+k)%n]
                if collider:
                    # Put route samples inside road faces, not on transverse
                    # triangle boundaries where Float32 ray intersections miss.
                    # The road remains one welded mesh with the same corridor.
                    q=points[(begin+k+1)%n];dx,dz=p['dx']+q['dx'],p['dz']+q['dz'];norm=math.hypot(dx,dz)
                    p=dict(x=(p['x']+q['x'])/2,y=(p['y']+q['y'])/2,z=(p['z']+q['z'])/2,dx=dx/norm,dz=dz/norm)
                for off in [lo,hi]:vs.append((p['x']+p['dz']*off,p['y']+dy,p['z']-p['dx']*off))
                if k:a=(k-1)*2;faces.append((a+2,a+3,a+1,a))
            mesh(name+'_'+str(begin),vs,faces,mat,collider,batch=not collider)
    strip('Road_Asphalt',-11,11,0,'Asphalt',True)
    for side in [-1,1]:
        strip('EdgeLine',side*10.4,side*10.55,.013,'White')
        strip('CenterLine',side*.12,side*.24,.013,'Yellow')
        # Fully closed solid barrier follows the grade; not a zero-thickness ribbon.
        for begin in range(0,n,64):
            vs=[];faces=[];count=min(64,n-begin)
            for k in range(count+1):
                p=points[(begin+k)%n]
                for off in [side*11.85-.25,side*11.85+.25]:
                    for h in [-.2,1.1]:vs.append((p['x']+p['dz']*off,p['y']+h,p['z']-p['dx']*off))
                if k:
                    a=(k-1)*4;b=k*4
                    faces.extend([(a,a+2,b+2,b),(a+1,b+1,b+3,a+3),(a,b,b+1,a+1),(a+2,a+3,b+3,b+2)])
            faces.extend([(0,1,3,2),(count*4,count*4+2,count*4+3,count*4+1)])
            mesh('RaceBarrier_'+str(side)+'_'+str(begin),vs,faces,'Concrete',True,False)
    # Far ground stays below the road even in bridge and switchback sectors.
    mesh('Terrain', [(-1600,-5,-900),(1900,-5,-900),(1900,-5,1900),(-1600,-5,1900)],[(0,3,2,1)],'Water' if night else 'Terrain',True,False)
    if not night:
        # A spatial height field connects the climbing corridor to the hills.
        # Exclude cells near the road so coarse terrain never covers asphalt.
        from mathutils.kdtree import KDTree
        kd=KDTree(n)
        for i,p in enumerate(points):kd.insert((p['x'],0,p['z']),i)
        kd.balance()
        step=12;xs=list(range(-900,1401,step));zs=list(range(-400,1201,step));vs=[];faces=[]
        for z in zs:
            for x in xs:
                _,idx,distance=kd.find((x,0,z))
                height=points[idx]['y']-.65-max(0,distance-10)*.16
                vs.append((x,max(-4.9,height),z))
        for j in range(len(zs)-1):
            for i in range(len(xs)-1):
                _,_,distance=kd.find((xs[i]+step/2,0,zs[j]+step/2))
                if distance<30:continue
                a=j*len(xs)+i;faces.append((a,a+len(xs),a+len(xs)+1,a+1))
        mesh('Jirisan_Terrain_Heightfield',vs,faces,'Terrain',batch=False)
        for side in [-1,1]:
            vs=[];faces=[];bands=[(11.1,.45),(18,1.65),(34,4.0)]
            for i in range(n+1):
                p=points[i%n]
                for offset,drop in bands:vs.append((p['x']+p['dz']*side*offset,p['y']-drop,p['z']-p['dx']*side*offset))
                if i:
                    a=(i-1)*3
                    for band in range(2):
                        f=(a+band,a+band+3,a+band+4,a+band+1)
                        faces.append(f if side>0 else tuple(reversed(f)))
            mesh('Road_Embankment',vs,faces,'Terrain')
    for i,p in enumerate(points):
        yaw=math.atan2(p['dx'],p['dz'])
        if i%30==0:
            for side in [-1,1]:
                off=side*13.5;x,z=p['x']+p['dz']*off,p['z']-p['dx']*off
                box('LampPost',x,p['y']+3,z,.13,6,.13,'Concrete')
                box('Reflector',x,p['y']+6,z,2,.14,.5,'Window',yaw)
                # Road illumination comes from runtime lights, not opaque white
                # rectangles laid over the asphalt and lane markings.
        if i%16==0 and not night:
            for side in [-1,1]:
                off=side*random.uniform(23,42);x,z=p['x']+p['dz']*off,p['z']-p['dx']*off;h=random.uniform(6,13)
                base=p['y']-.65-max(0,abs(off)-10)*.16
                box('ForestTrunk',x,base+h/3,z,.5,h*.7,.5,'Bark')
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,-z,base+h*.75));ob=bpy.context.object;ob.scale=(3,3,h*.45);bpy.context.view_layer.update()
                vs=[ob.matrix_world@v.co for v in ob.data.vertices];mesh('Forest',[(v.x,v.z,-v.y) for v in vs],[tuple(f.vertices) for f in ob.data.polygons],'Leaf');bpy.data.objects.remove(ob,do_unlink=True)
    def sign(index,label):
        p=points[index%n];yaw=math.atan2(p['dx'],p['dz']);x,z=p['x']+p['dz']*17,p['z']-p['dx']*17
        root=bpy.data.objects.new('Landmark_'+label,None);bpy.context.collection.objects.link(root);root['namak_sign']=True
        board=box('SignBoard',x,p['y']+3.2,z,8,2,.18,'Wayfinding_Accent',yaw,False);board.parent=root
        for off in [-3,3]:box('SignPost',x+p['dz']*off,p['y']+1.5,z-p['dx']*off,.13,3,.13,'Concrete')
        data=bpy.data.curves.new(label,'FONT');data.body=label;data.font=font;data.align_x='CENTER';data.align_y='CENTER';data.size=.7;data.extrude=.004
        ob=bpy.data.objects.new('SignText_'+label,data);bpy.context.collection.objects.link(ob);ob.location=(x,-z,p['y']+3.2);ob.rotation_euler=(math.pi/2,0,-yaw);ob.data.materials.append(mats['Wayfinding_Text']);ob.parent=root
        # Front face offset towards approaching drivers, clear of all racing lanes.
        ob.location.x-=p['dx']*.12;ob.location.y+=p['dz']*.12
        # Culling uses the landmark root position. Keep authored world poses
        # while moving each root to its actual sign rather than world origin.
        from mathutils import Vector
        anchor=Vector((x,-z,p['y']+3.2))
        for child in root.children:child.location-=anchor
        root.location=anchor
    regions={}
    for i,p in enumerate(points):regions.setdefault(p['region'],i)
    for label,index in regions.items():sign(index+80,label)
    if night:
        # The two bridges cross the channel on separate sides of the race loop.
        for label,target,mat in [('거북선대교',(1010,350),'Cyan'),('돌산대교',(-250,330),'Pink')]:
            idx=min(range(n),key=lambda i:math.hypot(points[i]['x']-target[0],points[i]['z']-target[1]));p=points[idx];sign(idx-90,label)
            for delta in [-90,90]:
                t=points[(idx+int(delta/2))%n]
                for side in [-1,1]:
                    x,z=t['x']+t['dz']*side*15,t['z']-t['dx']*side*15
                    box(label+'_Pylon',x,t['y']+23,z,2.2,46,2.2,'Concrete')
                    box(label+'_TowerLight',x,t['y']+25,z,2.35,40,.1,mat)
                    for d in [-70,-45,-20,20,45,70]:
                        q=points[(idx+int((delta+d)/2))%n]
                        beam('StayCable',(x,t['y']+44,z),(q['x']+q['dz']*side*13,q['y']+1.6,q['z']-q['dx']*side*13),.11,mat)
            # Stylized emissive broken water reflections; no extra render pass.
            for j in range(28):box('BridgeReflection',p['x']+random.uniform(-120,120),-4.97,p['z']+random.uniform(-70,70),random.uniform(2,8),.003,random.uniform(3,12),mat)
        for i in range(80):
            x=30+i*10;z=-35-random.uniform(15,50);h=random.uniform(7,20)
            box('HarborBuildings',x,h/2+8,z,8,h,12,'Facade')
            for floor in range(2,int(h),3):
                for dx in [-2,2]:box('HarborWindow',x+dx,floor+8,z+6.02,1.3,1.5,.03,'Window')
        box('YiSunSinPlaza',180,7.8,-100,100,.5,70,'Concrete');box('MonumentPlinth',180,10,-100,5,4,5,'Stone');box('Monument',180,14,-100,1.2,5,1.2,'Concrete')
    else:
        for i in range(12):
            x=-650+i*220;z=1000+random.uniform(100,800);h=random.uniform(200,370)
            bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=random.uniform(170,300),radius2=30,depth=h,location=(x,-z,h/2-10));ob=bpy.context.object;bpy.context.view_layer.update()
            vs=[ob.matrix_world@v.co for v in ob.data.vertices];mesh('JirisanRidge',[(v.x,v.z,-v.y) for v in vs],[tuple(f.vertices) for f in ob.data.polygons],'Stone');bpy.data.objects.remove(ob,do_unlink=True)
        p=max(points,key=lambda p:p['y'])
        # A fixed world offset can overlap another part of the return loop.
        # Check the whole route against the widest authored roof and deck,
        # retaining 15m from each footprint to the centerline (11m road half).
        def footprint_clear(cx,cz,w,d):
            return min(math.hypot(max(abs(q['x']-cx)-w/2,0),max(abs(q['z']-cz)-d/2,0)) for q in points)>=15
        location=None
        for offset in [55,75,95,115,135,155]:
            for side in [-1,1]:
                cx,cz=p['x']+p['dz']*side*offset,p['z']-p['dx']*side*offset
                if footprint_clear(cx,cz,40,24) and footprint_clear(cx+15,cz-30,25,18):
                    location=(cx,cz);break
            if location:break
        if location is None:raise RuntimeError('No clear rest-area footprint outside the full racing loop')
        x,z=location
        box('SeongsamjaeRestArea',x,p['y']+4,z,36,8,20,'Facade');box('RestAreaRoof',x,p['y']+8.3,z,40,.7,24,'Roof')
        box('ViewDeck',x+15,p['y']-1,z-30,25,.8,18,'Concrete')
        sign(max(range(n),key=lambda i:points[i]['y']),'성삼재 휴게소 / 노고단 방향')
    for (mat,cx,cz),(vs,faces) in buckets.items():mesh('Scenery_'+mat+'_'+str(cx)+'_'+str(cz),vs,faces,mat,batch=False)
    bpy.context.scene['map_id']=kind;bpy.context.scene['reference_mode']=route['referenceMode'];bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(src/(kind+'.blend')),compress=True)
    bpy.ops.export_scene.gltf(filepath=str(out/(kind+'.glb')),export_format='GLB',export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
    entries=[];chunks=[];offset=0
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH' or not ob.get('korea_collision'):continue
        ob.data.calc_loop_triangles();vs=array.array('f');ix=array.array('I')
        for v in ob.data.vertices:
            p=ob.matrix_world@v.co;vs.extend((p.x,p.z,-p.y))
        for f in ob.data.loop_triangles:ix.extend(f.vertices)
        vb,ib=vs.tobytes(),ix.tobytes();entries.append(dict(name=ob.name,offset=offset,vertices=len(vs),indices=len(ix)));chunks.extend([vb,ib]);offset+=len(vb)+len(ib)
    (proof/'colliders.bin').write_bytes(b''.join(chunks));(proof/'colliders.json').write_text(json.dumps(entries),encoding='utf-8')
    grades=[abs(points[(i+1)%n]['y']-p['y'])/math.hypot(points[(i+1)%n]['x']-p['x'],points[(i+1)%n]['z']-p['z']) for i,p in enumerate(points)]
    report=dict(id=kind,length=length,points=n,colliders=len(entries),maxGrade=max(grades),elevation=max(p['y'] for p in points)-min(p['y'] for p in points),bytes=(out/(kind+'.glb')).stat().st_size)
    (proof/'map-report.json').write_text(json.dumps(report,indent=2));print('KOREA_COURSE_EXPORTED',json.dumps(report))
