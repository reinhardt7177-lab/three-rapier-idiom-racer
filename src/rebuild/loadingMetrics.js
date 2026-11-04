// Browser Resource Timing totals, with cache hits kept explicit. Zero transfer
// does not mean a zero-size file or a cold first load.
export function loadingMetrics(entries){
 const files=entries.filter(r=>Number.isFinite(r.encodedBodySize)&&Number.isFinite(r.transferSize)).map(r=>({
  name:r.name.split('/').pop(),encodedBytes:r.encodedBodySize,transferBytes:r.transferSize,durationMs:r.duration,
 }));
 return {files,encodedBytes:files.reduce((n,r)=>n+r.encodedBytes,0),transferBytes:files.reduce((n,r)=>n+r.transferBytes,0),
  cacheHits:files.filter(r=>r.encodedBytes>0&&r.transferBytes<r.encodedBytes).length,
  revalidated:files.filter(r=>r.encodedBytes>0&&r.transferBytes>0&&r.transferBytes<r.encodedBytes).length,
  unknownSizes:files.filter(r=>r.encodedBytes===0).length};
}
export function browserLoadingMetrics(){
 try{return {measured:true,...loadingMetrics(performance.getEntriesByType('resource'))};}
 catch{return {measured:false,files:[]};}
}
