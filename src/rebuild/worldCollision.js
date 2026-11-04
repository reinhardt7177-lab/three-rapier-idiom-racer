import RAPIER from '@dimforge/rapier3d-compat';
// Weld identical vertices and correct triangle-edge contact normals. Preserve
// the original road, barriers and terrain geometry; never add a flat fallback.
export function recoveredCollider(vertices,indices){
 return RAPIER.ColliderDesc.trimesh(vertices,indices,RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(1).setRestitution(.03);
}
