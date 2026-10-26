"""Download a bounded public OSM source snapshot. No credentials are used."""
import json, hashlib, urllib.request, urllib.parse
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets-sources/yeosu/map'
OUT.mkdir(parents=True, exist_ok=True)
BBOX = '127.720,34.723,127.771,34.754'
QUERY = '[out:xml][timeout:50];(way["highway"]["highway"!~"footway|steps|path|pedestrian|cycleway|track"](34.723,127.720,34.754,127.771);way["natural"="coastline"](34.723,127.720,34.754,127.771);way["building"](34.723,127.720,34.754,127.771););(._;>;);out body;'
URL = 'https://overpass-api.de/api/interpreter?data=' + urllib.parse.quote(QUERY)
request = urllib.request.Request(URL, headers={'User-Agent': 'MUMU-Circuit/1.0 (local course research)'})
with urllib.request.urlopen(request, timeout=60) as response:
    data = response.read()
target = OUT / 'yeosu-osm-20261012.osm'
target.write_bytes(data)
metadata = {'url': URL, 'bbox': BBOX, 'fetchedAt': datetime.now(timezone.utc).isoformat(),
            'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
            'copyright': '© OpenStreetMap contributors', 'license': 'ODbL 1.0',
            'licenseUrl': 'https://www.openstreetmap.org/copyright'}
(OUT / 'source.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(metadata, ensure_ascii=True))
