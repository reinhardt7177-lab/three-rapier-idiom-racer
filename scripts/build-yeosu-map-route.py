"""Select a connected, motor-road loop from the preserved OSM snapshot.
The database derivative and original coordinates are distributed under ODbL.
"""
import json, math, heapq, hashlib, xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets-sources/yeosu/map'
root=ET.parse(OUT/'yeosu-osm-20261012.osm').getroot()
nodes={int(n.attrib['id']):(float(n.attrib['lat']),float(n.attrib['lon'])) for n in root.findall('node')}
ways={int(w.attrib['id']):{'nodes':[int(n.attrib['ref']) for n in w.findall('nd')],'tags':{t.attrib['k']:t.attrib['v'] for t in w.findall('tag')}} for w in root.findall('way')}
origin=(34.7387571,127.7379570)
def project(n):
    lat,lon=nodes[n]
    return ((lon-origin[1])*111320*math.cos(math.radians(origin[0])),(origin[0]-lat)*111320)
graph={}
for wid,w in ways.items():
    t=w['tags'];highway=t.get('highway')
    if highway not in ['primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','residential','unclassified']:continue
    if t.get('motor_vehicle')=='no' or t.get('motorcar')=='no' or t.get('access')=='private':continue
    for a,b in zip(w['nodes'],w['nodes'][1:]):
        length=math.dist(project(a),project(b));weight=length*(1.3 if highway=='residential' else 1)
        # Retain real one-way ramps: reversing a motorway slip lane introduces
        # near-180-degree junctions that cannot accommodate a racing corridor.
        pairs=[(a,b)] if t.get('oneway')=='yes' else [(b,a)] if t.get('oneway')=='-1' else [(a,b),(b,a)]
        for x,y in pairs:graph.setdefault(x,[]).append((y,weight,wid,length))
def closest(lat,lon):
    return min(graph,key=lambda n:math.hypot((nodes[n][0]-lat),(nodes[n][1]-lon)*math.cos(math.radians(lat))))
def path(start,end,blocked=frozenset(),incoming=0):
    initial=(incoming,start);queue=[(0,incoming,start)];cost={initial:0};previous={};terminal=None
    while queue:
        c,prior,n=heapq.heappop(queue);state=(prior,n)
        if c!=cost[state]:continue
        if n==end:terminal=state;break
        for q,w,wid,length in graph.get(n,[]):
            if q in blocked and q!=end:continue
            if prior:
                a,b,d=project(prior),project(n),project(q)
                u=(b[0]-a[0],b[1]-a[1]);v=(d[0]-b[0],d[1]-b[1]);den=math.hypot(*u)*math.hypot(*v)
                if den and (u[0]*v[0]+u[1]*v[1])/den<math.cos(math.radians(105)):continue
            nxt=(n,q)
            if c+w<cost.get(nxt,math.inf):cost[nxt]=c+w;previous[nxt]=(state,wid,length);heapq.heappush(queue,(c+w,n,q))
    if terminal is None:raise RuntimeError(f'No public motor-road connection {start}->{end}')
    result=[];state=terminal
    while state!=initial:prev,wid,length=previous[state];result.append((state[0],state[1],wid,length));state=prev
    return result[::-1]
checkpoints=[('이순신광장·수변 출발',797795206),('돌산대교 서단',436431876),('돌산대교 동단',436431875),
             ('거북선대교 남단',1766230235),('거북선대교 북단',1766230244),
             ('오동도로 진입',closest(34.7410,127.7526)),('하멜로·종포 수변',797795457)]
edges=[]
for i,(_,a) in enumerate(checkpoints):
    used={e[0] for e in edges};used.discard(a)
    edges.extend(path(a,checkpoints[(i+1)%len(checkpoints)][1],used,edges[-1][0] if edges else 0))
assert edges[0][0]==edges[-1][1]
points=[]
for a,b,wid,length in edges:
    x,z=project(a);lat,lon=nodes[a];t=ways[wid]['tags']
    points.append({'x':x,'z':z,'lat':lat,'lon':lon,'nodeId':a,'wayId':wid,'name':t.get('name','연결 도로'),'bridge':t.get('bridge')=='yes','layer':int(t.get('layer','0'))})
allways=list(dict.fromkeys(e[2] for e in edges))
derivative={'license':'ODbL-1.0','copyright':'© OpenStreetMap contributors','origin':{'lat':origin[0],'lon':origin[1]},
 'sourceSha256':hashlib.sha256((OUT/'yeosu-osm-20261012.osm').read_bytes()).hexdigest(),
 'closed':True,'eventDirectionOverride':False,'originalLength':sum(e[3] for e in edges),'points':points,
 'checkpoints':[{'label':label,'nodeId':n,'lat':nodes[n][0],'lon':nodes[n][1]} for label,n in checkpoints],
 'ways':[{'id':wid,'tags':ways[wid]['tags']} for wid in allways]}
(OUT/'selected-roads.json').write_text(json.dumps(derivative,ensure_ascii=False,indent=1),encoding='utf-8')
# Footprints and coastline retain the same projection as the road source.
scenery=[]
for wid,w in ways.items():
    t=w['tags']
    if 'building' not in t and t.get('natural')!='coastline':continue
    coords=[project(n) for n in w['nodes']]
    if not coords:continue
    cx=sum(p[0] for p in coords)/len(coords);cz=sum(p[1] for p in coords)/len(coords)
    if min(math.hypot(p['x']-cx,p['z']-cz) for p in points)>600:continue
    scenery.append({'wayId':wid,'kind':'building' if 'building' in t else 'coastline','points':coords,'levels':t.get('building:levels','3')})
(OUT/'mapped-scenery.json').write_text(json.dumps(scenery,separators=(',',':')),encoding='utf-8')
print(json.dumps({'length':derivative['originalLength'],'nodes':len(points),'ways':len(allways),'repeatEdges':len(edges)-len(set((a,b) for a,b,_,_ in edges)),'roads':[ways[w]['tags'].get('name','연결 도로') for w in allways],'scenery':len(scenery)},ensure_ascii=True))
