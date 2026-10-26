import fs from 'node:fs';
const task='artifacts/ai-impact-20261016';
const files=['perf-A1-logs.json','perf-B-logs.json','perf-final-A1.json','perf-final-B.json','perf-final-A2.json'];
const measurements=files.map(file=>{
 const logs=JSON.parse(fs.readFileSync(`${task}/${file}`));
 const entry=logs.filter(l=>l.message.includes('MUMU_PERFORMANCE')).at(-1);
 const result=JSON.parse(entry.message.slice(entry.message.indexOf('{')));
 const {intervals=[],submissionMs=[],...summary}=result;
 return{file,timestamp:entry.timestamp,url:entry.url,...summary,visibility:{hidden:intervals.filter(i=>!i.visible).length,unfocused:intervals.filter(i=>!i.focused).length}};
});
const report={measurements,notes:[
 'Earlier perf-A2-logs.json contains the previous A1 console event only; no completed second A run. Excluded as duplicate, preserved on disk.',
 'Final A1/B/A2 use the same tab sequentially after the full CPU test ended. Same track/quality/viewport/camera, no GPU queries, frozen comparison or profile hooks.',
 'Final A2 has 0.2671s dropped simulation time and different progress. Retain it as an interrupted/stalled sample, not an exact matched driving window.',
 'Final B mean and >50ms count are worse than A1; the earlier matched A/B both had p95 16.8ms. This is not a clean performance acceptance. No causal explanation or universal frame-rate guarantee is claimed.',
 'Whole data is local Windows/IAB Chromium/Intel i5-1135G7 and Iris Xe/16GB RAM/1280x720/DPR .75/low quality/Namak/clear/6-car grid/normal/1 lap/ghost off. No physical mobile device.'
]};
fs.writeFileSync(`${task}/performance-summary.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(measurements.map(({file,timestamp,frame,cpu,context,visibility})=>({file,timestamp,frame,cpu,context,visibility})),null,2));
