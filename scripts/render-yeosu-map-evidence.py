"""Draw a reproducible source-coordinate comparison, without map tile images."""
import json,math,xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
source=json.loads((ROOT/'assets-sources/yeosu/map/selected-roads.json').read_text(encoding='utf-8'))
route=json.loads((ROOT/'public/assets/rebuild/yeosu-route.json').read_text(encoding='utf-8'))
origin=source['origin'];xscale=111320*math.cos(math.radians(origin['lat']))
raw=ET.parse(ROOT/'assets-sources/yeosu/map/yeosu-osm-20261012.osm').getroot()
nodes={n.attrib['id']:((float(n.attrib['lon'])-origin['lon'])*xscale,-(float(n.attrib['lat'])-origin['lat'])*111320) for n in raw.findall('node')}
pts=route['points'];xmin=min(p['x'] for p in pts)-180;xmax=max(p['x'] for p in pts)+180;zmin=min(p['z'] for p in pts)-180;zmax=max(p['z'] for p in pts)+180
scale=min(830/(xmax-xmin),710/(zmax-zmin))
xy=lambda p:(int(35+(p[0]-xmin)*scale),int(65+(p[1]-zmin)*scale))
image=Image.new('RGB',(1200,830),'#081a2d');draw=ImageDraw.Draw(image)
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',17);small=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',13)
draw.text((30,20),'여수 실제 도로 좌표와 게임 경로 비교',font=font,fill='#f4f8fb')
for way in raw.findall('way'):
 tags={t.attrib['k']:t.attrib['v'] for t in way.findall('tag')}
 if 'highway' not in tags and tags.get('natural')!='coastline':continue
 line=[nodes[n.attrib['ref']] for n in way.findall('nd') if n.attrib['ref'] in nodes]
 for a,b in zip(line,line[1:]):
  if all(xmin<=p[0]<=xmax and zmin<=p[1]<=zmax for p in [a,b]):draw.line([xy(a),xy(b)],fill='#32576b' if tags.get('natural')=='coastline' else '#26394b',width=2)
original=[xy((p['x'],p['z'])) for p in source['points']];original.append(original[0]);draw.line(original,fill='#ffb755',width=6)
race=[xy((p['x'],p['z'])) for p in pts];race.append(race[0]);draw.line(race,fill='#64deff',width=3)
for label,x,z in [('이순신광장',0,0),('돌산대교',-290,890),('거북선대교',980,535),('오동도로',1300,-180)]:
 p=xy((x,z));draw.ellipse((p[0]-4,p[1]-4,p[0]+4,p[1]+4),fill='#ffffff');draw.text((p[0]+8,p[1]-20),label,font=small,fill='#ffffff',stroke_width=2,stroke_fill='#081a2d')
for i,(text,color) in enumerate([('주황: 원본 도로 노드','#ffb755'),('파랑: 게임 경로','#64deff'),('회색: 주변 실제 도로','#99abba'),('', '#ffffff'),('45개 도로 / 363개 원본 노드','#ffffff'),('일방통행·차량 통행 제약 유지','#ffffff'),(f"실제 연결: {source['originalLength']/1000:.3f}km",'#ffffff'),(f"게임 코스: {route['length']/1000:.3f}km",'#ffffff'),(f"평면 최대 이탈: {route['mapSource']['maximumPlanarDeviation']:.2f}m",'#ffffff'),('레이스용 폭: 18~22m','#ffffff'),('교량 고도: 제작값 (실측 아님)','#ffffff')]):draw.text((895,110+i*35),text,font=small,fill=color)
draw.text((30,800),'© OpenStreetMap contributors · ODbL 1.0 | 북쪽 ↑ | 위경도 투영 / 레이스용 커브 완화',font=small,fill='#a6bacd')
image.save(ROOT/'artifacts/yeosu-map-traffic-20261012/source-route-comparison.png')
