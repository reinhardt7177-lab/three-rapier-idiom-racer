import * as THREE from 'three';

// Visual ownership is separate from the recovered road, terrain and colliders.
// Low quality deliberately retains the original course without this extra pass.
export const SEONGSAMJAE_VISUAL_BUDGETS=Object.freeze({
 high:Object.freeze({distance:230,cells:8,canopies:10,fraction:1}),
 medium:Object.freeze({distance:140,cells:4,canopies:6,fraction:.55}),
 low:Object.freeze({distance:0,cells:0,canopies:0,fraction:0}),
});
const qualityId=q=>typeof q==='string'?q:q?.id;
const number=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hash=n=>{n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967295;};
const cellKey=(x,z)=>`${Math.floor(x/64)},${Math.floor(z/64)}`;
const materialsOf=o=>Array.isArray(o.material)?o.material:[o.material];

function detailTexture(rock){
 const size=256,data=new Uint8Array(size*size*4);
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const i=(z*size+x)*4,grain=hash(z*size+x+773),broad=.5+.2*Math.sin(x*.098)*Math.cos(z*.069)+.12*Math.sin((x+z)*.031);
  const vein=Math.abs(Math.sin(x*.11+Math.sin(z*.057)*2.1));
  data[i]=Math.round(255*clamp(rock?.36+grain*.49-vein*.13:.36+grain*.4,0,1));
  data[i+1]=Math.round(255*clamp(broad+(grain-.5)*.18,0,1));
  data[i+2]=Math.round(255*clamp(rock?vein:.5+(grain-.5)*.25,0,1));data[i+3]=255;
 }
 const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.name=rock?'Jirisan_Granite_Detail':'Jirisan_Litter_Moss_Detail';
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;
 return t;
}

function surfaceMaterial(original,kind,texture){
 const material=original.clone();material.name=`${original.name}_JirisanDetail`;
 const previousCompile=original.onBeforeCompile,previousKey=original.customProgramCacheKey();
 if(original.surfaceGrain)material.surfaceGrain=original.surfaceGrain;
 material.jirisanDetailTexture=texture;
 material.roughness=kind==='stone'?.89:.95;
 material.onBeforeCompile=function(shader,renderer){
  previousCompile.call(this,shader,renderer);
  shader.uniforms.jirisanDetail={value:texture};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 jirisanPosition;varying vec3 jirisanNormal;');
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec4 jirisanWorld=vec4(transformed,1.0);vec3 jirisanObjectNormal=objectNormal;
   #ifdef USE_INSTANCING
    jirisanWorld=instanceMatrix*jirisanWorld;mat3 jirisanInstanceNormal=mat3(instanceMatrix);
    jirisanObjectNormal/=vec3(dot(jirisanInstanceNormal[0],jirisanInstanceNormal[0]),dot(jirisanInstanceNormal[1],jirisanInstanceNormal[1]),dot(jirisanInstanceNormal[2],jirisanInstanceNormal[2]));
    jirisanObjectNormal=jirisanInstanceNormal*jirisanObjectNormal;
   #endif
   jirisanPosition=(modelMatrix*jirisanWorld).xyz;jirisanNormal=normalize(mat3(modelMatrix)*jirisanObjectNormal);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 jirisanPosition;varying vec3 jirisanNormal;uniform sampler2D jirisanDetail;');
  let tint;
  if(kind==='stone')tint=`vec3 weights=abs(normalize(jirisanNormal));weights/=max(.001,weights.x+weights.y+weights.z);
   vec3 grain=texture2D(jirisanDetail,jirisanPosition.zy*.16).rgb*weights.x+texture2D(jirisanDetail,jirisanPosition.xz*.16).rgb*weights.y+texture2D(jirisanDetail,jirisanPosition.xy*.16).rgb*weights.z;
   float moss=texture2D(jirisanDetail,jirisanPosition.xz*.018).g*smoothstep(.25,.9,abs(jirisanNormal.y));
   diffuseColor.rgb*=mix(vec3(.76,.80,.77),vec3(.59,.83,.52),moss*.42)*mix(.76,1.28,grain.r);`;
  else if(kind==='terrain')tint=`vec3 grain=texture2D(jirisanDetail,jirisanPosition.xz*.24).rgb;
   float floorCover=texture2D(jirisanDetail,jirisanPosition.xz*.018).g;
   diffuseColor.rgb*=mix(vec3(.91,.78,.51),vec3(.76,1.08,.74),smoothstep(.3,.7,floorCover))*mix(.79,1.22,grain.r);`;
  else if(kind==='bark')tint=`float grain=texture2D(jirisanDetail,vec2(jirisanPosition.x+jirisanPosition.z,jirisanPosition.y*.12)*.7).r;
   diffuseColor.rgb*=mix(vec3(.66,.61,.52),vec3(1.12,1.05,.88),grain);`;
  else tint=`float variation=texture2D(jirisanDetail,jirisanPosition.xz*.025).g;
   diffuseColor.rgb*=mix(vec3(.77,.91,.80),vec3(1.10,1.14,.86),variation);`;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\n${tint}`);
 };
 material.customProgramCacheKey=()=>`${previousKey}-jirisan-forest-surface-20261013-${kind}`;
 return material;
}

// Index real rendered terrain triangles once; querying this grid avoids hundreds
// of full GLB ray casts during preparation. It cannot fill an authored hole.
function groundSampler(world){
 const buckets=new Map(),v=new THREE.Vector3(),triangles=[],size=32;
 world.traverse(o=>{if(!o.isMesh||!materialsOf(o).some(m=>m.name==='Terrain'))return;
  const g=o.geometry,p=g.attributes.position,index=g.index,count=index?.count??p.count;
  for(let i=0;i<count;i+=3){
   const t=[];for(let j=0;j<3;j++){v.fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(o.matrixWorld);t.push(v.x,v.y,v.z);}
   const [ax,ay,az,bx,by,bz,cx,cy,cz]=t,den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(den)<1e-8)continue;
   t.push(den);const id=triangles.length;triangles.push(t);
   const x0=Math.floor(Math.min(ax,bx,cx)/size),x1=Math.floor(Math.max(ax,bx,cx)/size),z0=Math.floor(Math.min(az,bz,cz)/size),z1=Math.floor(Math.max(az,bz,cz)/size);
   for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const key=`${x},${z}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(id);}
  }
 });
 return (x,z,ceiling)=>{
  let highest=-Infinity;
  for(const id of buckets.get(`${Math.floor(x/size)},${Math.floor(z/size)}`)??[]){
   const [ax,ay,az,bx,by,bz,cx,cy,cz,den]=triangles[id];
   const a=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,b=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den,c=1-a-b;
   if(a<-.00001||b<-.00001||c<-.00001)continue;const y=a*ay+b*by+c*cy;
   if(y<=ceiling&&y>highest)highest=y;
  }
  return Number.isFinite(highest)?highest:null;
 };
}

function routeDistance(points){
 const cells=new Map(),size=64;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  for(let z=Math.floor(Math.min(a.z,b.z)/size);z<=Math.floor(Math.max(a.z,b.z)/size);z++)for(let x=Math.floor(Math.min(a.x,b.x)/size);x<=Math.floor(Math.max(a.x,b.x)/size);x++){
   const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
  }
 }
 return (x,z)=>{
  let closest=Infinity;const radius=72;
  for(let cellZ=Math.floor((z-radius)/size);cellZ<=Math.floor((z+radius)/size);cellZ++)for(let cellX=Math.floor((x-radius)/size);cellX<=Math.floor((x+radius)/size);cellX++)for(const i of cells.get(`${cellX},${cellZ}`)??[]){
   const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/Math.max(.00001,dx*dx+dz*dz),0,1);
   closest=Math.min(closest,Math.hypot(x-a.x-dx*t,z-a.z-dz*t));
  }
  // Queries only gate clearance <=65m, or objects authored within42m of the
  // road. No nearby segment means the exclusion corridor is definitely clear.
  return closest;
 };
}

function fernGeometry(){
 const positions=[],colors=[];
 const push=(p,c)=>{positions.push(...p);colors.push(...c);};
 for(let f=0;f<5;f++){
  const angle=f*Math.PI*.4,dx=Math.cos(angle),dz=Math.sin(angle),sx=-dz,sz=dx;
  const a=[sx*.013,0,sz*.013],b=[dx*.58+sx*.012,.46,dz*.58+sz*.012],c=[dx*.58-sx*.012,.46,dz*.58-sz*.012],d=[-sx*.013,0,-sz*.013];
  for(const vertex of [a,b,c,a,c,d])push(vertex,[.43,.59,.22]);
  for(let leaf=0;leaf<4;leaf++){
   const t=(leaf+1)/5,reach=.16+.33*t,height=.5*Math.sin(t*Math.PI*.7),length=.18*(1-t*.45);
   const a=[dx*reach-sx*length,height,dz*reach-sz*length],b=[dx*(reach+.16),height+.025,dz*(reach+.16)],c=[dx*reach+sx*length,height,dz*reach+sz*length],d=[dx*(reach-.08),height-.02,dz*(reach-.08)];
   push(a,[.50,.73,.27]);push(b,[.79,.93,.39]);push(c,[.50,.73,.27]);push(a,[.50,.73,.27]);push(c,[.50,.73,.27]);push(d,[.31,.53,.20]);
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}

function rockGeometry(){
 const g=new THREE.IcosahedronGeometry(1,1),p=g.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=Math.sin(x*11.2+z*8.3)*Math.cos(y*9.4)*.075;p.setXYZ(i,x*(1+n),y*(1+n),z*(1+n));}
 p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();return g;
}

function crownComponents(mesh){
 const p=mesh.geometry.attributes.position,idx=mesh.geometry.index,count=idx?.count??p.count,ids=new Map(),vertices=[],parents=[],v=new THREE.Vector3();
 const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 const join=(a,b)=>{const x=find(a),y=find(b);if(x!==y)parents[y]=x;};
 const id=vertex=>{v.fromBufferAttribute(p,vertex).applyMatrix4(mesh.matrixWorld);const key=`${Math.round(v.x*1000)},${Math.round(v.y*1000)},${Math.round(v.z*1000)}`;if(ids.has(key))return ids.get(key);const n=vertices.length;ids.set(key,n);vertices.push(v.clone());parents.push(n);return n;};
 for(let i=0;i<count;i+=3){const a=id(idx?idx.getX(i):i),b=id(idx?idx.getX(i+1):i+1),c=id(idx?idx.getX(i+2):i+2);join(a,b);join(b,c);}
 const bounds=new Map();for(let i=0;i<vertices.length;i++){const root=find(i);if(!bounds.has(root))bounds.set(root,new THREE.Box3());bounds.get(root).expandByPoint(vertices[i]);}
 return [...bounds.values()].filter(b=>b.max.y-b.min.y>1);
}

function ridgeGeometry(bounds,distanceToRoute){
 if(!bounds.length)return null;
 const extent=bounds.reduce((a,b)=>a.union(b),new THREE.Box3()),positions=[],colors=[],indices=[],x0=extent.min.x,z0=extent.min.z,step=45;
 const nx=Math.ceil((extent.max.x-x0)/step)+1,nz=Math.ceil((extent.max.z-z0)/step)+1,valid=[];
 const green=new THREE.Color('#345d3e'),ridge=new THREE.Color('#52725d'),stone=new THREE.Color('#89918a');
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const x=x0+i*step,z=z0+j*step;let h=-10;
  for(const b of bounds){const cx=(b.min.x+b.max.x)/2,cz=(b.min.z+b.max.z)/2,rx=(b.max.x-b.min.x)*.65,rz=(b.max.z-b.min.z)*.68,fall=Math.exp(-2*((x-cx)/rx)**2-2*((z-cz)/rz)**2);h=Math.max(h,-10+(b.max.y+10)*fall);}
  h+=Math.sin(x*.027+Math.cos(z*.018))*Math.sin(z*.042+x*.009)*13*Math.max(0,(h+10)/350);
  const color=green.clone().lerp(ridge,clamp((h-80)/210,0,1)).lerp(stone,clamp((h-245)/240,0,.20));
  positions.push(x,h,z);colors.push(color.r,color.g,color.b);valid.push(distanceToRoute(x,z)>65);
 }
 for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){const a=j*nx+i,b=a+nx,c=b+1,d=a+1;if([a,b,c,d].every(k=>valid[k]))indices.push(a,b,d,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
}

export function createSeongsamjaeVisuals(scene,world,route,{quality='high'}={}){
 if(!scene?.isObject3D||!world?.isObject3D||!Array.isArray(route?.points)||route.points.length<3)throw new TypeError('A scene, world and closed route are required');
 const points=route.points,root=new THREE.Group();root.name='Seongsamjae_Forest_Detail';root.userData.graphicDecoration=true;
 const minimumClearance=Math.max(14,number(route.width,22)/2+3),bindings=[],clones=new Map(),geometries=new Set(),materials=new Set(),textures=new Set(),instances=[],canopies=[],originalRidges=[],placements=[],cells=[];
 const stats={version:'seongsamjae-forest-20261013',quality:'high',generatedTextureBytes:0,addedNetworkBytes:0,instances:0,visibleInstances:0,visibleDraws:0,visibleTriangles:0,maxVisibleDraws:27,maxNewDraws:17,canopyReplacements:0,minimumClearance,groundMethod:'rendered terrain triangles',disposed:false};
 world.updateMatrixWorld(true);const soil=detailTexture(false),granite=detailTexture(true);textures.add(soil);textures.add(granite);stats.generatedTextureBytes=soil.image.data.byteLength+granite.image.data.byteLength;
 let ground=groundSampler(world);const distanceToRoute=routeDistance(points),sources=[];
 world.traverse(o=>{if(!o.isMesh)return;sources.push(o);});
 for(const o of sources){
  const original=o.material,list=materialsOf(o),detailed=list.map(m=>{
   const kind={Terrain:'terrain',Stone:'stone',Leaf:'leaf',Bark:'bark'}[m.name];if(!kind)return m;
   if(!clones.has(m)){const clone=surfaceMaterial(m,kind,kind==='stone'?granite:soil);clones.set(m,clone);materials.add(clone);}return clones.get(m);
  });
  if(detailed.some((m,i)=>m!==list[i]))bindings.push({object:o,original,detailed:Array.isArray(original)?detailed:detailed[0]});
  if(!o.userData.unity_collider&&list.some(m=>m.name==='Stone')){
   const b=new THREE.Box3().setFromObject(o);if(b.max.y-b.min.y>150&&b.max.x-b.min.x>100)originalRidges.push({object:o,bounds:b,visible:o.visible});
  }
 }
 const fern=fernGeometry(),rock=rockGeometry(),crown=new THREE.IcosahedronGeometry(1,1);for(const g of [fern,rock,crown])geometries.add(g);
 const herbMaterial=new THREE.MeshStandardMaterial({color:'#789044',vertexColors:true,roughness:.96,side:THREE.DoubleSide});herbMaterial.name='Jirisan_Understory';
 const stoneBase=new THREE.MeshStandardMaterial({name:'Jirisan_Mossy_Rock',color:'#9b9d86',roughness:.90}),stoneMaterial=surfaceMaterial(stoneBase,'stone',granite);stoneBase.dispose();
 const crownMaterial=new THREE.MeshStandardMaterial({name:'Jirisan_Clustered_Canopy',color:'#ffffff',roughness:.94});for(const m of [herbMaterial,stoneMaterial,crownMaterial])materials.add(m);
 const cellData=new Map();
 // Full-route clearance is measured including the return road at hairpins.
 for(let i=0;i<points.length;i+=15)for(const side of [-1,1]){
  const p=points[i],seed=i*17+(side+1)*113,offset=side*(18+hash(seed)*11),x=p.x+p.dz*offset,z=p.z-p.dx*offset,type=hash(seed+211)<.34?'rock':'fern';
  const sx=type==='rock'?.5+hash(seed+1)*.9:.8+hash(seed+1)*.9,sy=type==='rock'?.38+hash(seed+2)*.6:.6+hash(seed+2)*.7,sz=type==='rock'?.65+hash(seed+3)*.8:sx;
  const radius=type==='rock'?Math.hypot(sx,sz)*1.08:Math.max(sx,sz)*.7,clearance=distanceToRoute(x,z)-radius;
  if(clearance<minimumClearance)continue;const y=ground(x,z,p.y+3);if(y===null||Math.abs(y-p.y)>8)continue;
  const entry={x,y:y+(type==='rock'?sy*.35:0),z,sx,sy,sz,yaw:hash(seed+4)*Math.PI*2,type,clearance,groundY:y,seed};placements.push(entry);
  const key=cellKey(x,z);if(!cellData.has(key))cellData.set(key,{ferns:[],rocks:[]});cellData.get(key)[type==='rock'?'rocks':'ferns'].push(entry);
 }
 ground=null;
 const dummy=new THREE.Object3D(),color=new THREE.Color();
 function instanceBatch(entries,g,m,name){
  if(!entries.length)return null;const mesh=new THREE.InstancedMesh(g,m,entries.length);mesh.name=name;mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.graphicDecoration=true;
  entries.forEach((e,i)=>{dummy.position.set(e.x,e.y,e.z);dummy.rotation.set(0,e.yaw,0);dummy.scale.set(e.sx,e.sy,e.sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);color.set(e.color??(e.type==='rock'?'#9ca58e':'#b6c594'));mesh.setColorAt(i,color);});
  mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.visible=false;root.add(mesh);instances.push(mesh);return mesh;
 }
 for(const [key,data] of cellData){const meshes=[instanceBatch(data.ferns,fern,herbMaterial,'Jirisan_Fern_Instances'),instanceBatch(data.rocks,rock,stoneMaterial,'Jirisan_Rock_Instances')].filter(Boolean);const b=new THREE.Box3();for(const m of meshes){m.computeBoundingBox();b.union(m.boundingBox);}cells.push({key,meshes,center:b.getCenter(new THREE.Vector3()),radius:b.getBoundingSphere(new THREE.Sphere()).radius,distance:0});}
 const canopyPalette=['#3f6d35','#507b3b','#326843','#647f39'];
 for(const o of sources.filter(o=>materialsOf(o).some(m=>m.name==='Leaf'))){
  const components=crownComponents(o),entries=[];if(!components.length)continue;let valid=true;
  for(let i=0;i<components.length;i++){
   const box=components[i],center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).multiplyScalar(.5),radius=Math.hypot(size.x,size.z);
   if(distanceToRoute(center.x,center.z)-radius<minimumClearance){valid=false;break;}
   for(let l=0;l<3;l++)entries.push({x:center.x+(l-1)*size.x*.32,y:center.y+(l===1?.18:-.12)*size.y,z:center.z+(l===0?-.10:l===2?.10:0)*size.z,sx:size.x*(l===1?.73:.68),sy:size.y*(l===1?.75:.76),sz:size.z*(l===1?.73:.68),yaw:0,color:canopyPalette[Math.floor(hash(i*371+l+entries.length*17)*canopyPalette.length)%canopyPalette.length]});
  }
  if(!valid)continue;const mesh=instanceBatch(entries,crown,crownMaterial,'Jirisan_Canopy_Instances');o.geometry.computeBoundingSphere();const originalSphere=o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld);canopies.push({original:o,visible:o.visible,mesh,originalSphere,distance:0});
 }
 const ridge=ridgeGeometry(originalRidges.map(r=>r.bounds),distanceToRoute);let ridgeMesh=null;
 if(ridge){geometries.add(ridge);const base=new THREE.MeshStandardMaterial({name:'Jirisan_Layered_Ridge',color:'#ffffff',vertexColors:true,roughness:.96}),mat=surfaceMaterial(base,'stone',granite);base.dispose();materials.add(mat);ridgeMesh=new THREE.Mesh(ridge,mat);ridgeMesh.name='Jirisan_Continuous_Ridge';ridgeMesh.castShadow=false;ridgeMesh.receiveShadow=true;ridgeMesh.visible=false;root.add(ridgeMesh);}
 stats.instances=instances.reduce((n,m)=>n+m.count,0);stats.canopyReplacements=canopies.length;stats.placements=placements.length;stats.cells=cells.length;stats.ridgeTriangles=ridge?(ridge.index?.count??ridge.attributes.position.count)/3:0;
 stats.instanceBufferBytes=instances.reduce((n,m)=>n+m.instanceMatrix.array.byteLength+(m.instanceColor?.array.byteLength??0),0);
 const counts=new Map(instances.map(m=>[m,m.count])),cameraPosition=new THREE.Vector3();let currentQuality='high',alive=true;
 function setQuality(q){if(!alive)return;currentQuality=SEONGSAMJAE_VISUAL_BUDGETS[qualityId(q)]?qualityId(q):'high';stats.quality=currentQuality;
  for(const binding of bindings)binding.object.material=currentQuality==='low'?binding.original:binding.detailed;
  for(const m of instances)m.count=Math.ceil(counts.get(m)*(m.name==='Jirisan_Canopy_Instances'?1:SEONGSAMJAE_VISUAL_BUDGETS[currentQuality].fraction));
  if(currentQuality==='low'){root.visible=false;for(const m of instances)m.visible=false;for(const c of canopies)c.original.visible=c.visible;for(const r of originalRidges)r.object.visible=r.visible;if(ridgeMesh)ridgeMesh.visible=false;stats.visibleInstances=stats.visibleDraws=stats.visibleTriangles=stats.newDecorationDraws=0;}
 }
 function update(camera,dt,elapsed,visible=true){
  if(!alive)return;const budget=SEONGSAMJAE_VISUAL_BUDGETS[currentQuality];root.visible=!!visible&&currentQuality!=='low';stats.visibleInstances=stats.visibleDraws=stats.visibleTriangles=stats.newDecorationDraws=0;
  // Low quality adds no update loop over decorations, and does not undo the
  // runtime's own distance culling by showing previously invisible originals.
  if(currentQuality==='low')return;
  const position=camera?.isObject3D?camera.getWorldPosition(cameraPosition):camera?.position;
  const originalDistance=currentQuality==='medium'?500:Infinity;
  for(const m of instances)m.visible=false;for(const c of canopies)c.original.visible=c.visible&&(!position||c.originalSphere.center.distanceTo(position)-c.originalSphere.radius<=originalDistance);
  for(const r of originalRidges){const sphere=r.bounds.getBoundingSphere(new THREE.Sphere());r.object.visible=r.visible&&(!position||sphere.center.distanceTo(position)-sphere.radius<=originalDistance);}if(ridgeMesh)ridgeMesh.visible=false;
  if(!root.visible||!position)return;
  const add=m=>{m.visible=true;stats.visibleDraws++;stats.visibleInstances+=m.count;stats.visibleTriangles+=m.count*(m.geometry.index?.count??m.geometry.attributes.position.count)/3;};
  for(const c of cells)c.distance=Math.max(0,c.center.distanceTo(position)-c.radius);
  cells.sort((a,b)=>a.distance-b.distance);
  for(const c of cells.filter(c=>c.distance<=budget.distance).slice(0,budget.cells))for(const m of c.meshes)add(m);
  for(const c of canopies)c.distance=Math.max(0,c.mesh.boundingSphere.center.distanceTo(position)-c.mesh.boundingSphere.radius);
  canopies.sort((a,b)=>a.distance-b.distance);
  for(const c of canopies.filter(c=>c.visible&&c.distance<=budget.distance).slice(0,budget.canopies)){c.original.visible=false;add(c.mesh);}
  if(ridgeMesh){ridgeMesh.visible=true;stats.visibleDraws++;stats.visibleTriangles+=stats.ridgeTriangles;for(const r of originalRidges)r.object.visible=false;}
  // Count new calls separately from canopy/ridge replacements, which retire
  // corresponding original draws; this is a bounded submission budget, not FPS.
  stats.newDecorationDraws=stats.visibleDraws-canopies.filter(c=>c.mesh.visible).length;
 }
 function dispose(){if(!alive)return;alive=false;stats.disposed=true;root.removeFromParent();for(const binding of bindings)binding.object.material=binding.original;
  for(const c of canopies)c.original.visible=c.visible;for(const r of originalRidges)r.object.visible=r.visible;
  instances.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());root.clear();stats.visibleInstances=stats.visibleDraws=stats.visibleTriangles=stats.newDecorationDraws=0;
 }
 scene.add(root);setQuality(quality);
 return {root,update,setQuality,stats,dispose,placements};
}
