import {Box3} from 'three';

// The showroom has a solid rear wall. Orbiting behind it used to show only
// the back of the wall. Cut away that backdrop when the camera crosses it.
export function createGarageBackdrop(garage) {
  let wall;
  const parts=[];
  garage.traverse(o=>{
    // GLTFLoader sanitizes node names (Rear wall -> Rear_wall).
    const name=o.userData.name||o.name.replaceAll('_',' ');
    if(name==='Rear wall')wall=o;
    if(/^(Rear wall|Wall rib|Side pier|MUMU showroom sign)/.test(name))parts.push(o);
  });
  const front=wall?new Box3().setFromObject(wall).max.z:-Infinity;
  return {
    update(camera) {
      const visible=camera.position.z>=front;
      for(const part of parts)part.visible=visible;
    },
  };
}
