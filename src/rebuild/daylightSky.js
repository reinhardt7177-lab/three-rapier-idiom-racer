// Reuse the installed Three.js Sky cloud shader. Its default cloud branch was
// already evaluated; tune the visible pattern and skip that branch at low quality.
export function createDaylightSky(sky,trackId,quality={id:'high'}){
 const uniforms=sky.material.uniforms,keys=['cloudCoverage','cloudScale','cloudDensity','cloudElevation','time'];
 const before=new Map(keys.filter(k=>uniforms[k]).map(k=>[k,uniforms[k].value]));
 const profiles={coastal:{coverage:.57,scale:.00085,density:.55,elevation:.32},namak:{coverage:.50,scale:.0007,density:.40,elevation:.4},seongsamjae:{coverage:.58,scale:.0011,density:.48,elevation:.34}};
 const p=profiles[trackId]||profiles.coastal;let disposed=false;
 const stats={version:'authored-daylight-clouds-1',addedDraws:0,addedTriangles:0,textureBytes:0,clouds:true};
 function setQuality(q){const low=(typeof q==='string'?q:q?.id)==='low';stats.clouds=!low;
  if(uniforms.cloudCoverage)uniforms.cloudCoverage.value=low?0:p.coverage;
  if(uniforms.cloudScale)uniforms.cloudScale.value=p.scale;
  if(uniforms.cloudDensity)uniforms.cloudDensity.value=p.density;
  if(uniforms.cloudElevation)uniforms.cloudElevation.value=p.elevation;
 }
 setQuality(quality);
 return {stats,setQuality,update(dt,elapsed){if(!disposed&&dt>0&&uniforms.time)uniforms.time.value=elapsed;},dispose(){if(disposed)return;disposed=true;for(const [k,v] of before)uniforms[k].value=v;}};
}
