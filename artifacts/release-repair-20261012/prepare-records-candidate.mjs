import fs from 'node:fs';
const out=new URL('records-candidate.mjs',import.meta.url);if(fs.existsSync(out))throw Error('Preserve candidate');
let s=fs.readFileSync(new URL('../../src/rebuild/raceRecords.js',import.meta.url),'utf8');
s=s.replace("from './tracks.js'",`from '${new URL('../../src/rebuild/tracks.js',import.meta.url).href}'`);
s=s.replace('gold:79,silver:81,bronze:89','gold:287,silver:289,bronze:294').replace('gold:225,silver:237,bronze:252','gold:833,silver:857,bronze:867');
s=s.replace('export function bestRecord(storage,trackId,laps){',"function currentRecord(entry,trackId,laps){\n if(!entry||!Number.isFinite(entry.time))return null;\n return trackId==='yeosu'?{...entry,medal:medalFor(entry.time,medalTimes(trackId,laps))}:entry;\n}\nexport function bestRecord(storage,trackId,laps){");
s=s.replace('return entry&&Number.isFinite(entry.time)?entry:null;','return currentRecord(entry,trackId,laps);');
s=s.replace('previous=all[key]&&Number.isFinite(all[key].time)?all[key]:null;','previous=currentRecord(all[key],trackId,laps);');
fs.writeFileSync(out,s);
