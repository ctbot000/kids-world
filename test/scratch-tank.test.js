import { tankMaterials, tankModel } from '../public/js/render/fishtank-model.js';
const THREE = await import('../public/vendor/three.module.js');
for (const kind of ['fish-tank', 'fish-bowl']) {
  const model = tankModel(tankMaterials(), kind);
  model.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(model);
  console.log(kind, JSON.stringify(b.min), JSON.stringify(b.max));
  for (const c of model.children) {
    const cb = new THREE.Box3().setFromObject(c);
    if (cb.min.x < -0.5 || cb.max.x > 0.5 || cb.min.z < -0.5 || cb.max.z > 0.5 || cb.min.y < -0.001 || cb.max.y > 1) {
      console.log('  out:', c.name || c.type, c.userData.shared ? 'shared' : '', JSON.stringify(cb.min), JSON.stringify(cb.max), c.visible);
    }
  }
}
