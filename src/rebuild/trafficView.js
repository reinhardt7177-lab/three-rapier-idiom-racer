import * as THREE from 'three';

// Shared, small generic civilian body geometry. Four instanced tyres per car;
// no high-poly race-car clones, textures, shadows or extra point-light budget.
export function createTrafficViews(cars){
 const root=new THREE.Group();root.name='Civilian_Road_Traffic';
 const materials=[new THREE.MeshStandardMaterial({color:'#e5c887',metalness:.35,roughness:.4}),new THREE.MeshStandardMaterial({color:'#142338',metalness:.4,roughness:.18}),new THREE.MeshStandardMaterial({color:'#15181b',roughness:.88}),new THREE.MeshBasicMaterial({color:'#ff3e38'}),new THREE.MeshBasicMaterial({color:'#e6f6ff'})];
 const shape=new THREE.Shape();shape.moveTo(-2.15,0);shape.lineTo(-2.1,.48);shape.lineTo(-1.6,.65);shape.lineTo(-1.05,1.24);shape.lineTo(.62,1.24);shape.lineTo(1.25,.65);shape.lineTo(2.12,.48);shape.lineTo(2.15,0);shape.closePath();
 const bodyGeometry=new THREE.ExtrudeGeometry(shape,{depth:1.8,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.09,bevelThickness:.06});bodyGeometry.rotateY(-Math.PI/2);bodyGeometry.translate(.9,-.24,0);bodyGeometry.computeVertexNormals();
 const glassGeometry=new THREE.BoxGeometry(1.64,.48,1.44),tyreGeometry=new THREE.CylinderGeometry(.34,.34,.25,14);tyreGeometry.rotateZ(Math.PI/2);
 const lampGeometry=new THREE.BoxGeometry(.58,.12,.09),matrix=new THREE.Matrix4(),wheelQ=new THREE.Quaternion(),steerQ=new THREE.Quaternion(),spinQ=new THREE.Quaternion(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),xAxis=new THREE.Vector3(1,0,0),yAxis=new THREE.Vector3(0,1,0),scale=new THREE.Vector3(1,1,1);
 const views=cars.map((c,i)=>{
  const group=new THREE.Group();root.add(group);
  const body=new THREE.Mesh(bodyGeometry,materials[0]);group.add(body);
  const glass=new THREE.Mesh(glassGeometry,materials[1]);glass.position.set(0,.72,.14);group.add(glass);
  const wheels=new THREE.InstancedMesh(tyreGeometry,materials[2],4);wheels.frustumCulled=false;group.add(wheels);
  const lamps=new THREE.InstancedMesh(lampGeometry,materials[3],2);lamps.frustumCulled=false;group.add(lamps);
  const heads=new THREE.InstancedMesh(lampGeometry,materials[4],2);heads.frustumCulled=false;group.add(heads);
  for(let side=0;side<2;side++){matrix.makeTranslation(side?-.61:.61,.38,-2.16);lamps.setMatrixAt(side,matrix);}
  for(let side=0;side<2;side++){matrix.makeTranslation(side?-.61:.61,.38,2.16);heads.setMatrixAt(side,matrix);}
  return {car:c,group,wheels,lamps,heads};
 });
 return {root,stats:{cars:cars.length,drawCalls:cars.length*5,shadows:0},update(alpha=1){
  for(const {car:c,group,wheels} of views){
   position.copy(c.previous.position).lerp(c.state.position,alpha);rotation.copy(c.previous.rotation).slerp(c.state.rotation,alpha);group.position.copy(position);group.quaternion.copy(rotation);
   for(let i=0;i<4;i++){
    const wheel=c.state.wheels[i];position.set(i%2?-.92:.92,-.25,i<2?1.4:-1.4);
    steerQ.setFromAxisAngle(yAxis,wheel.steering);spinQ.setFromAxisAngle(xAxis,wheel.rotation);wheelQ.copy(steerQ).multiply(spinQ);matrix.compose(position,wheelQ,scale);wheels.setMatrixAt(i,matrix);
   }
   wheels.instanceMatrix.needsUpdate=true;
  }
 },dispose(){root.removeFromParent();for(const geometry of [bodyGeometry,glassGeometry,tyreGeometry,lampGeometry])geometry.dispose();for(const material of materials)material.dispose();for(const {wheels,lamps,heads,group} of views){wheels.dispose();lamps.dispose();heads.dispose();group.clear();}root.clear();}};
}
