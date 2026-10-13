// The world is immobile after its colliders, scenery batches and overlays exist.
// Stop composing the same static transforms on every render; retain moving
// descendants and restore flags before a runtime-owned scene is disposed.
export function freezeStaticWorld(root){
 root.updateWorldMatrix(true,true);const entries=[];
 function visit(o,dynamic=false){
  dynamic=dynamic||o.userData.dynamic||o.isSkinnedMesh||o.isCamera||o.isLight;
  if(!dynamic){entries.push({o,local:o.matrixAutoUpdate,world:o.matrixWorldAutoUpdate});o.matrixAutoUpdate=false;o.matrixWorldAutoUpdate=false;}
  for(const child of o.children)visit(child,dynamic);
 }
 visit(root);let disposed=false;
 return {stats:{frozenObjects:entries.length},dispose(){if(disposed)return;disposed=true;for(const e of entries){e.o.matrixAutoUpdate=e.local;e.o.matrixWorldAutoUpdate=e.world;}}};
}
