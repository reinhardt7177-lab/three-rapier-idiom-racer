// Opt-in development instrumentation. No extra draw, blocking GPU read or
// persistent renderer hook. CPU submission is not GPU execution time.
export function classifyDraw(object,{world,vehicles=[],sky}){
 for(let p=object;p;p=p.parent){
  if(vehicles.includes(p))return 'vehicle';
  if(p.name?.startsWith('Namak_Parked_'))return 'parked';
  if(p===sky)return 'sky';
  if(p===world){
   if(object.name?.includes('Road_Asphalt'))return 'road';
   const names=(Array.isArray(object.material)?object.material:[object.material]).map(m=>m?.name??'').join('|');
   if(/Leaf|Pine|Bark|Reed/.test(names))return 'vegetation';
   if(/Terrain|Grass|Water|Paving|Concrete/.test(names))return 'ground';
   return 'world';
  }
 }
 return 'other';
}

export function createRenderProfile(renderer,{classify=()=> 'other',now=()=>performance.now(),every=60,capacity=16}={}){
 const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 const records=[],pending=[],gpu=[],classes=new WeakMap();let frames=0,invalid=0,skipped=0,disposed=false;
 const remove=q=>gl.deleteQuery(q);
 function poll(){
  if(!ext||!pending.length)return;
  if(gl.getParameter(ext.GPU_DISJOINT_EXT)){invalid+=pending.length;pending.splice(0).forEach(p=>remove(p.query));return;}
  for(let i=pending.length-1;i>=0;i--){
   const p=pending[i];if(!gl.getQueryParameter(p.query,gl.QUERY_RESULT_AVAILABLE))continue;
   const ms=gl.getQueryParameter(p.query,gl.QUERY_RESULT)/1e6;
   if(Number.isFinite(ms)&&ms>=0){gpu.push({frame:p.frame,label:p.label,ms});if(gpu.length>capacity)gpu.shift();}else invalid++;
   remove(p.query);pending.splice(i,1);
  }
 }
 return {render(scene,camera,label='race'){
  if(disposed)return renderer.render(scene,camera);
  poll();const frame=++frames;
  if((frame-1)%every!==0)return renderer.render(scene,camera);
  const buckets={},original=renderer.renderBufferDirect;let query=null,drawCpuMs=0;
  if(ext&&pending.length<4&&!gl.getParameter(ext.GPU_DISJOINT_EXT)&&!gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY)){
   query=gl.createQuery();if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
  }else if(ext)skipped++;
  renderer.renderBufferDirect=function(drawCamera,drawScene,geometry,material,object,group){
   let category=classes.get(object);if(!category){category=classify(object);classes.set(object,category);}
   const pass=drawCamera===camera?'main':'shadow',key=pass+':'+category;
   const bucket=buckets[key]??(buckets[key]={pass,category,calls:0,triangles:0,cpuMs:0});
   const calls=this.info.render.calls,triangles=this.info.render.triangles,start=now();
   try{return original.call(this,drawCamera,drawScene,geometry,material,object,group);}
   finally{const ms=now()-start;bucket.cpuMs+=ms;drawCpuMs+=ms;bucket.calls+=this.info.render.calls-calls;bucket.triangles+=this.info.render.triangles-triangles;}
  };
  const start=now(),before={...renderer.info.render};let completed=false;
  try{const value=renderer.render(scene,camera);completed=true;return value;}
  finally{
   const cpuMs=now()-start;renderer.renderBufferDirect=original;
   if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);if(completed)pending.push({query,frame,label});else{invalid++;remove(query);}}
   const calls=renderer.info.render.calls-before.calls,triangles=renderer.info.render.triangles-before.triangles;
   const counted=Object.values(buckets).reduce((a,b)=>({calls:a.calls+b.calls,triangles:a.triangles+b.triangles}),{calls:0,triangles:0});
   records.push({frame,label,completed,cpuMs,drawCpuMs,otherCpuMs:cpuMs-drawCpuMs,calls,triangles,unattributedCalls:calls-counted.calls,unattributedTriangles:triangles-counted.triangles,buckets:Object.values(buckets)});
   if(records.length>capacity)records.shift();
  }
 },snapshot(){return {every,frames,records:records.map(r=>({...r,buckets:r.buckets.map(b=>({...b}))})),gpu:{supported:!!ext,pending:pending.length,invalid,skipped,samples:gpu.map(s=>({...s}))}};},dispose(){
  disposed=true;pending.splice(0).forEach(p=>remove(p.query));
 }};
}
