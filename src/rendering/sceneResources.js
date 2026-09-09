// Terminal cleanup for a scene owned by one runtime. Dispose render-target
// owners, not their attachment textures, and keep shared scene assets deduped.
export function createSceneDisposer(scene, { renderTargets = [] } = {}) {
  let disposed = false;
  return function disposeScene() {
    if (disposed) return;
    disposed = true;

    const geometries = new Set(), materials = new Set(), textures = new Set();
    const instances = new Set(), lights = new Set(), targets = new Set(renderTargets.filter(Boolean));
    const ownedTextures = new Set(), visited = new Set();
    function collectTextures(value) {
      if (!value || typeof value !== 'object' || visited.has(value)) return;
      visited.add(value);
      if (value.isTexture) { textures.add(value); return; }
      for (const child of Object.values(value)) collectTextures(child);
    }
    function ownTarget(target) {
      if (!target) return;
      for (const texture of target.textures || [target.texture]) if (texture) ownedTextures.add(texture);
      if (target.depthTexture) ownedTextures.add(target.depthTexture);
    }
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      if (object.isInstancedMesh) instances.add(object);
      if (object.isLight) lights.add(object);
    });
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      if (material.uniforms) collectTextures(material.uniforms);
    }
    if (scene.background?.isTexture) textures.add(scene.background);
    if (scene.environment?.isTexture) textures.add(scene.environment);
    for (const target of targets) ownTarget(target);
    for (const light of lights) for (const target of [light.shadow?.map, light.shadow?.mapPass]) {
      ownTarget(target);
      targets.delete(target); // Light.dispose() owns its shadow render targets.
    }
    for (const instance of instances) if (instance.morphTexture) ownedTextures.add(instance.morphTexture);

    // Geometry disposal alone does not release an InstancedMesh's GPU buffers.
    instances.forEach(instance => instance.dispose());
    lights.forEach(light => light.dispose());
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => { if (!ownedTextures.has(texture)) texture.dispose(); });
    targets.forEach(target => target.dispose());
  };
}
