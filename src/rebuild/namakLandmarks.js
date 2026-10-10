import * as THREE from 'three';

// Signs are a separately editable Blender overlay. Keep each sign together for
// distance culling, instead of merging letters from opposite sides of the city.
export function createNamakLandmarks(overlay){
  const signs=[];
  overlay.traverse(o=>{
    if(o.userData.namak_sign){
      o.userData.dynamic=true;
      signs.push({root:o,position:o.getWorldPosition(new THREE.Vector3())});
    }
    if(o.isMesh){
      o.castShadow=false;o.receiveShadow=false;
      // Flat reflective lettering stays readable in direct sun without a
      // transparent sprite or a HUD marker obscuring the racing line.
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        if(m.name==='Wayfinding_Text'||m.name==='Wayfinding_Accent')m.toneMapped=false;
      }
    }
  });
  return {stats:{signs:signs.length,visibleSigns:0},update(camera,worldVisible){
    let visible=0;
    for(const s of signs){s.root.visible=worldVisible&&s.position.distanceToSquared(camera.position)<220**2;if(s.root.visible)visible++;}
    this.stats.visibleSigns=visible;
  }};
}
