"""OSM-derived planar road geometry, with bounded race corner rounding."""
import json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def mapped_route():
    data=json.loads((ROOT/'assets-sources/yeosu/map/selected-roads.json').read_text(encoding='utf-8'))
    source=data['points']
    def distance(p,a,b):
        dx=b['x']-a['x'];dz=b['z']-a['z'];den=dx*dx+dz*dz
        t=max(0,min(1,((p['x']-a['x'])*dx+(p['z']-a['z'])*dz)/den)) if den else 0
        return math.hypot(p['x']-a['x']-t*dx,p['z']-a['z']-t*dz)
    def simplify(p):
        if len(p)<=2:return p
        index=max(range(1,len(p)-1),key=lambda i:distance(p[i],p[0],p[-1]))
        if distance(p[index],p[0],p[-1])<=.7:return [p[0],p[-1]]
        return simplify(p[:index+1])[:-1]+simplify(p[index:])
    # OSM junctions contain closely spaced survey vertices. Using each vertex
    # as a separate turn creates sub-metre radii and folded inner asphalt/walls.
    # Simplify only collinear detail, retaining the original source separately.
    far=max(range(len(source)),key=lambda i:(source[i]['x']-source[0]['x'])**2+(source[i]['z']-source[0]['z'])**2)
    original=simplify(source[:far+1])[:-1]+simplify(source[far:]+[source[0]])[:-1]
    raw=[(p['x'],8,p['z']) for p in original];owners=original
    # Resample horizontal geometry before creating smooth bridge approaches.
    lengths=[0]
    for i,p in enumerate(raw):lengths.append(lengths[-1]+math.dist(p,raw[(i+1)%len(raw)]))
    count=math.ceil(lengths[-1]/2);dense=[];dense_owners=[];cursor=0
    for i in range(count):
        dist=i*lengths[-1]/count
        while lengths[cursor+1]<dist:cursor+=1
        f=(dist-lengths[cursor])/(lengths[cursor+1]-lengths[cursor]);a=raw[cursor];b=raw[(cursor+1)%len(raw)]
        dense.append(tuple(a[k]+f*(b[k]-a[k]) for k in range(3)))
        dense_owners.append(owners[cursor])
    # Smooth over physical distance, rather than shrinking fillets when OSM
    # vertices are close together. This gives continuous curvature through a
    # junction while preserving the source corridor (verified against 7m).
    radius=14;weights=[radius+1-abs(k) for k in range(-radius,radius+1)];total=sum(weights)
    dense=[tuple(sum(dense[(i+k)%len(dense)][axis]*weights[k+radius] for k in range(-radius,radius+1))/total for axis in range(3)) for i in range(len(dense))]
    # Heights are race-authored, not surveyed. Layered OSM flyovers rise 18m.
    layers=[]
    for near in dense_owners:
        layers.append(18 if near['layer']>0 else 0)
    result=[]
    radius=70
    for i,(x,y,z) in enumerate(dense):
        height=sum(layers[(i+k)%len(dense)]*(radius+1-abs(k)) for k in range(-radius,radius+1))/(radius+1)**2
        result.append((x,8+height,z))
    data['rawOwners']=dense_owners
    return result,data

def source_at(data,x,z):
    return min(data['points'],key=lambda p:(p['x']-x)**2+(p['z']-z)**2)

def source_distance(data,x,z):
    best=math.inf
    points=data['points']
    for i,a in enumerate(points):
        b=points[(i+1)%len(points)];dx=b['x']-a['x'];dz=b['z']-a['z'];den=dx*dx+dz*dz
        t=max(0,min(1,((x-a['x'])*dx+(z-a['z'])*dz)/den))
        best=min(best,math.hypot(x-a['x']-t*dx,z-a['z']-t*dz))
    return best
