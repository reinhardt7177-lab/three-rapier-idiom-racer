# 여수 도로 데이터

© OpenStreetMap contributors. 원본과 파생 도로/건물/해안선 데이터는 [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)로 제공한다. [출처·표시 안내](https://www.openstreetmap.org/copyright).

- `source.json`: 다운로드 주소·시각·범위·원본 SHA256.
- `yeosu-osm-20261012.osm`: 원본 지도 스냅샷.
- `selected-roads.json`: 실제 도로 노드와 통행 방향을 지킨 연결 경로.
- `mapped-scenery.json`: 건물 윤곽과 해안선. 게임 건물 높이·외장은 간략화한다.
- `../../../public/assets/rebuild/yeosu-route.json`: 게임용 파생 경로. 고도와 폭은 레이스에 맞게 제작했으며 실측값이 아니다.

재생성: 저장된 원본에 `python scripts/build-yeosu-map-route.py`를 실행한 뒤 `scripts/blender/build_yeosu.py`를 Blender에서 실행한다. 자세한 검증과 한계는 `docs/YEOSU_MAP_TRAFFIC_20261012.md`에 기록한다.
