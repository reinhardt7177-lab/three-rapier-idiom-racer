"""Recover terrain from full OSM coastlines, including long ways excluded before.
No map raster, collision geometry or surveyed terrain height is generated here.
"""
import math
import xml.etree.ElementTree as ET
from collections import defaultdict


def append_land(root, route, add_mesh, road_clearance):
    origin = route['mapSource']['origin']
    tree = ET.parse(root/'assets-sources/yeosu/map/yeosu-osm-20261012.osm').getroot()
    def project(lat,lon):
        return ((lon-origin['lon'])*111320*math.cos(math.radians(origin['lat'])),(origin['lat']-lat)*111320)
    nodes={n.attrib['id']:project(float(n.attrib['lat']),float(n.attrib['lon'])) for n in tree.findall('node')}
    ways=[];segments=[];rows=defaultdict(list)
    for w in tree.findall('way'):
        if not any(t.attrib.get('k')=='natural' and t.attrib.get('v')=='coastline' for t in w.findall('tag')):
            continue
        coords=[nodes[n.attrib['ref']] for n in w.findall('nd')]
        ways.append(int(w.attrib['id']))
        for a,b in zip(coords,coords[1:]):
            if math.dist(a,b)<.0001:
                continue
            i=len(segments);segments.append((a,b))
            for row in range(math.floor(min(a[1],b[1])/32),math.floor(max(a[1],b[1])/32)+1):
                rows[row].append(i)

    def land(x,z):
        # The first shoreline crossing to the east determines which side we
        # occupy. OSM coastlines have land on their left; gameplay Z points south.
        # Using individual segments retains long Dolsan and northeast mainland
        # ways whose centroid was >600m away from the former scenery filter.
        nearest=math.inf;answer=False
        for i in rows.get(math.floor(z/32),[]):
            a,b=segments[i]
            if (a[1]>z)==(b[1]>z):
                continue
            ix=a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1])
            if ix>=x and ix<nearest:
                nearest=ix;answer=b[1]<a[1]
        return answer

    points=route['points']
    bounds=[min(p['x'] for p in points)-270,min(p['z'] for p in points)-270,
            max(p['x'] for p in points)+270,max(p['z'] for p in points)+270]
    cache={}
    def sample(x,z):
        key=(x,z)
        if key not in cache:
            cache[key]=(land(x,z),road_clearance(x,z))
        return cache[key]

    stats={'sourceWays':ways,'sourceSegments':len(segments),'omittedPreviously':[22782620,559741849,845239874],
           'height':1.98,'waterHeight':-4.89,'coarseCellMeters':16,'edgeCellMeters':4,
           'roadEdgeBufferMeters':1.2,'landQuads':0,'shoreFaces':0,'vertices':0,'triangles':0,
           'definition':'directed OSM coastline segments; near-road portion only; flat authored ground, not elevation survey'}
    def tile(x,z,size):
        corners=[(x,z),(x,z+size),(x+size,z+size),(x+size,z)]
        values=[sample(*p) for p in corners]
        middle=sample(x+size/2,z+size/2)
        # Keep enough terrain beyond all authored roadside buildings (190m).
        if middle[1]>270+size:
            return
        land_flags=[v[0] for v in values]+[middle[0]]
        if not any(land_flags):
            return
        clearances=[v[1] for v in values]+[middle[1]]
        if max(clearances)<1.2:
            return
        boundary=not all(land_flags) or min(clearances)<size*1.5+1.2
        if boundary and size>4:
            half=size/2
            for dx,dz in [(0,0),(half,0),(0,half),(half,half)]:
                tile(x+dx,z+dz,half)
            return
        if not all(land_flags) or min(clearances)<1.2:
            return
        vs=[(xx,1.98,zz) for xx,zz in corners]
        if add_mesh('MappedLandSurface',vs,[(0,1,2,3)],'Land',1):
            stats['landQuads']+=1;stats['vertices']+=4;stats['triangles']+=2
            # Seal coast-facing exposed boundaries down past sea level. Borders
            # beside road cutouts stay open and never add collision/road surface.
            for i,(a,b) in enumerate(zip(corners,corners[1:]+corners[:1])):
                mx,mz=(a[0]+b[0])/2,(a[1]+b[1])/2
                dx,dz=b[0]-a[0],b[1]-a[1]
                nx,nz=-dz/size,dx/size
                if not land(mx+nx*.15,mz+nz*.15):
                    side=[(a[0],1.98,a[1]),(b[0],1.98,b[1]),(b[0],-6,b[1]),(a[0],-6,a[1])]
                    if add_mesh('MappedLandShore',side,[(0,1,2,3)],'Land',1):
                        stats['shoreFaces']+=1;stats['vertices']+=4;stats['triangles']+=2
    for x in range(math.floor(bounds[0]/16)*16,math.ceil(bounds[2]/16)*16,16):
        for z in range(math.floor(bounds[1]/16)*16,math.ceil(bounds[3]/16)*16,16):
            tile(x,z,16)
    return stats
