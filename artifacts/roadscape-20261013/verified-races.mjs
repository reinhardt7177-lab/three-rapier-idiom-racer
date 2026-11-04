import fs from 'node:fs';
const base='artifacts/roadscape-20261013/final-check-evidence/artifacts/',out=[];
for(const path of ['content-resume-20261011/rival-personality-races.json','content-resume-20261011/rain-races.json','release-repair-20261012/traffic-races.json']){
 const report=JSON.parse(fs.readFileSync(base+path,'utf8').replace(/^\uFEFF/,''));const rows=report.results??report.races;
 out.push({path,races:rows.length,cars:rows.reduce((n,r)=>n+r.cars.length,0),allFinished:rows.every(r=>r.cars.every(c=>Number.isFinite(c.finish)&&c.finish>0)),rows:rows.map(r=>({track:r.track??r.trackId,difficulty:r.difficultyId??r.difficulty,laps:r.laps,median:r.median,finish:r.cars.map(c=>({id:c.id,name:c.name,finish:c.finish,lowest:c.lowest,recovery:c.recovery}))}))});
}
fs.writeFileSync('artifacts/roadscape-20261013/verified-races.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out.map(({rows,...v})=>v)));
