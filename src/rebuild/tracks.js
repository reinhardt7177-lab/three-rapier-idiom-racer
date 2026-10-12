export const TRACKS=Object.freeze([
 Object.freeze({id:'coastal',name:'해안 월드',label:'COASTAL WORLD',world:'world',route:'world-route.json',kilometres:'6.84',description:'해안에서 산길까지, 한 바퀴의 승부.'}),
 Object.freeze({id:'namak',name:'남악 시티',label:'NAMAK CITY CIRCUIT',world:'namak',route:'namak-route.json',kilometres:'2.93',gridRowStep:6,description:'도청 앞에서 영산강 수변까지, 남악 시티 레이스.'}),
 Object.freeze({id:'yeosu',name:'여수 밤바다',label:'YEOSU NIGHT SEA',world:'yeosu',route:'yeosu-route.json',kilometres:'8.90',revision:'osm-20261012',gridRowStep:6,bounded:true,night:true,traffic:true,landmarksInWorld:true,collisionFixture:'yeosu-map-traffic-20261012/yeosu',description:'실제 도로 좌표의 두 대교·오동도로·종포 수변. 일반 차량을 추월하세요.'}),
 Object.freeze({id:'seongsamjae',name:'지리산 성삼재',label:'JIRISAN SEONGSAMJAE',world:'seongsamjae',route:'seongsamjae-route.json',kilometres:'5.83',gridRowStep:6,bounded:true,landmarksInWorld:true,collisionFixture:'korea-circuits-20261011/seongsamjae',description:'화엄사 아래 출발, 성삼재 전망과 연속 헤어핀을 돌아 내려옵니다.'}),
]);
export function trackFromSearch(search=''){
 const id=new URLSearchParams(search).get('track');return TRACKS.find(t=>t.id===id)||TRACKS[0];
}
export function trackLink(track,search=''){
 const params=new URLSearchParams(search);params.set('track',track.id);return `?${params}`;
}
