// The Wild Isle drawn as the real thing (the third episode of Adventure
// Isle's story, shared/isle-wild.js): no bricks anywhere. Its world is still
// blocks underneath — what everyone walks on, what the island's rules go by
// — and this draws over them, in place of the blocks (render/terrain.js
// draws none of its own here): the ground as one smooth skin
// (real-ground.js), the sea and the ponds (real-water.js), a real sky
// (real-sky.js), real trees, bushes, ferns and grass (real-plants.js), and
// what is built or lies about as stone, wood, rock and thorns
// (real-build.js), all lit as real things are: the sun and the sky, the
// sun's shadows, the haze far off.
import * as THREE from '../../vendor/three.module.js';
import * as B from '../shared/blocks.js';
import { CHUNK } from '../shared/world.js';
import { RealBuild } from './real-build.js';
import { groundMaterial, RealGround } from './real-ground.js';
import { RealGrass, RealSmallPlants, RealTrees, wind } from './real-plants.js';
import { realMaterials } from './real-textures.js';
import { RealSky } from './real-sky.js';
import { RealWater } from './real-water.js';

// The islands drawn so (worldgen.js palette has their ground).
const REAL_THEMES = new Set(['wildcoast', 'wildwood', 'wildfalls', 'wildpeak', 'wildfen']);
export const isReal = (theme) => REAL_THEMES.has(theme);

// Each corner of the Wild Isle's grass, as it grows there: lush by the sea,
// dark in the forest, bright by the falls, short and gold up the ridge, and
// olive in the fen.
const GRASS_TINT = {
  wildcoast: [1.05, 1.02, 0.86],
  wildwood: [0.86, 0.94, 0.8],
  wildfalls: [0.98, 1.06, 0.88],
  wildpeak: [1.1, 1.0, 0.78],
  wildfen: [0.98, 0.94, 0.74],
};

// The sea bed round the island's map: from the heights along its edge out
// in rings, deeper and deeper, all sand.
function seabed(ground, world) {
  const PW = 2 * world.W + 1;
  const PD = 2 * world.D + 1;
  const edge = [];
  const at = (i, j) => {
    const cx = Math.min(world.W - 1, Math.floor(i / 2));
    const cz = Math.min(world.D - 1, Math.floor(j / 2));
    const v = ground.cellVert[(cx * world.D + cz) * 9 + (i - 2 * cx) * 3 + (j - 2 * cz)];
    return [i / 2, ground.positions[v * 3 + 1], j / 2];
  };
  for (let i = 0; i < PW - 1; i++) edge.push(at(i, 0));
  for (let j = 0; j < PD - 1; j++) edge.push(at(PW - 1, j));
  for (let i = PW - 1; i > 0; i--) edge.push(at(i, PD - 1));
  for (let j = PD - 1; j > 0; j--) edge.push(at(0, j));
  const cx = world.W / 2;
  const cz = world.D / 2;
  const rings = [[0, null], [6, world.sea - 16], [24, world.sea - 20], [90, world.sea - 28], [400, world.sea - 40], [1500, world.sea - 60]];
  const pos = [];
  for (const [d, y] of rings) {
    for (const [x, h, z] of edge) {
      const ox = Math.sign(Math.round((x - cx) * 2) / 2);
      const oz = Math.sign(Math.round((z - cz) * 2) / 2);
      const fx = Math.abs(x - cx) >= world.W / 2 - 0.01 ? ox : 0;
      const fz = Math.abs(z - cz) >= world.D / 2 - 0.01 ? oz : 0;
      pos.push(x + fx * d, y === null ? h : Math.min(h, y), z + fz * d);
    }
  }
  const n = edge.length;
  const idx = [];
  for (let r = 0; r < rings.length - 1; r++) {
    for (let k = 0; k < n; k++) {
      const a = r * n + k;
      const b = r * n + ((k + 1) % n);
      const c = (r + 1) * n + k;
      const d = (r + 1) * n + ((k + 1) % n);
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const count = pos.length / 3;
  const splat = new Float32Array(count * 8);
  for (let v = 0; v < count; v++) splat[v * 8 + 3] = 1;
  const ib = new THREE.InterleavedBuffer(splat, 8);
  g.setAttribute('splatA', new THREE.InterleavedBufferAttribute(ib, 4, 0));
  g.setAttribute('splatB', new THREE.InterleavedBufferAttribute(ib, 4, 4));
  g.setAttribute('extra', new THREE.Float32BufferAttribute(new Float32Array(count * 2).map((_, i) => (i % 2 ? 0 : 1)), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// How thick the grass grows near you, and how far out, by picture quality.
function grassFor(quality) {
  if (quality === 'high') return { density: 8, reach: 30 };
  if (quality === 'medium') return { density: 5, reach: 24 };
  return { density: 3, reach: 17 };
}

export class RealWorld {
  // quality: the renderer's (render/renderer.js QUALITY), for how thick the
  // grass grows and how far.
  constructor(gl, world, light, quality = 'high') {
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'real';
    this.textures = realMaterials(gl);
    this.uniforms = {
      uLampColor: { value: new THREE.Color(1.0, 0.62, 0.3).multiplyScalar(2.2) },
      uNight: { value: 0 },
      uGrassTint: { value: new THREE.Vector3(...(GRASS_TINT[world.theme] ?? [1, 1, 1])) },
    };
    const trees = [];
    for (let x = 0; x < world.W; x++) {
      for (let z = 0; z < world.D; z++) {
        for (let y = world.H - 1; y > 0; y--) {
          const id = world.get(x, y, z);
          if (B.isTreeFoot(id)) trees.push([x, y, z]);
        }
      }
    }
    this.trees = trees;
    this.ground = new RealGround(world, light, trees);
    this.groundMaterial = groundMaterial(this.textures, this.uniforms);
    this.groundMesh = new THREE.Mesh(this.ground.geometry, this.groundMaterial);
    this.groundMesh.name = 'real ground';
    this.groundMesh.receiveShadow = true;
    this.groundMesh.castShadow = true;
    this.groundMesh.matrixAutoUpdate = false;
    this.group.add(this.groundMesh);
    // The sea bed on out past the island's map, falling away.
    this.skirt = new THREE.Mesh(seabed(this.ground, world), this.groundMaterial);
    this.skirt.receiveShadow = true;
    this.skirt.matrixAutoUpdate = false;
    this.group.add(this.skirt);
    this.sky = new RealSky(this.textures);
    this.group.add(this.sky.dome);
    this.heightTexture = this.ground.heightTexture();
    this.water = new RealWater(world, this.ground.cols, this.heightTexture, this.textures, this.sky);
    this.group.add(this.water.group);
    this.trees = new RealTrees(gl, world, this.ground, trees);
    this.group.add(this.trees.group);
    this.plants = new RealSmallPlants(world, this.ground);
    this.group.add(this.plants.group);
    this.quality = quality;
    this.grass = new RealGrass(world, this.ground, { ...grassFor(quality), tint: GRASS_TINT[world.theme] ?? [1, 1, 1] });
    this.group.add(this.grass.group);
    this.build = new RealBuild(gl, world);
    this.group.add(this.build.group);
    for (let cx = 0; cx < world.chunksX; cx++) for (let cz = 0; cz < world.chunksZ; cz++) this.build.build(cx, cz);
    this.time = 0;
  }

  // Each frame: the sky and the light by the time of day (env, from
  // sky.js environment) and the weather, the water moving.
  // nearFade: whether what is right in front of the camera dissolves (not
  // looking through your own eyes).
  frame(dt, env, weather, camera, nearFade = true) {
    this.time += dt;
    wind.uNearFade.value = nearFade ? 1 : 0;
    this.sky.update(dt, this.time, env, weather, camera);
    this.water.update(this.time);
    const night = Math.max(0, 1 - env.day * 1.3);
    this.uniforms.uNight.value = night;
    this.build.setNight(night);
    wind.uWind.value = this.time;
    wind.uGust.value = weather === 'clear' ? 0.55 : 1;
    wind.uSunView.value.copy(env.sunDir).transformDirection(camera.matrixWorldInverse);
    wind.uSunTint.value.copy(env.sun).multiplyScalar(Math.max(0, env.sunDir.y) > 0 ? env.day : 0);
    this.grass.update(camera);
  }

  // Blocks changed (a gate opened, a camp freed): what of it shows here.
  cellsChanged(cells) {
    this.ground.repaint(cells);
    const chunks = new Set();
    let plants = false;
    for (let i = 0; i < cells.length; i += 4) {
      chunks.add(`${Math.floor(cells[i] / CHUNK)},${Math.floor(cells[i + 2] / CHUNK)}`);
      if (B.KIND[cells[i + 3]] === B.K_PLANT || B.KIND[this.world.get(cells[i], cells[i + 1], cells[i + 2])] === B.K_PLANT) plants = true;
    }
    for (const key of chunks) {
      const [cx, cz] = key.split(',').map(Number);
      if (cx >= 0 && cz >= 0 && cx < this.world.chunksX && cz < this.world.chunksZ) this.build.build(cx, cz);
    }
    // (Flowers come up where a camp is freed.)
    if (plants || cells.length > 40) this.plants.rebuild();
  }

  // The picture's quality changed: the grass grown again, as thick as it is.
  setQuality(quality) {
    if (quality === this.quality) return;
    this.quality = quality;
    this.group.remove(this.grass.group);
    this.grass.dispose();
    this.grass = new RealGrass(this.world, this.ground, { ...grassFor(quality), tint: GRASS_TINT[this.world.theme] ?? [1, 1, 1] });
    this.group.add(this.grass.group);
  }

  // How far up or down to draw what stands at (x, y, z), so it stands on
  // the ground as drawn (real-ground.js).
  lift(x, y, z, radius) {
    return this.ground.lift(x, y, z, radius);
  }

  dispose() {
    this.group.removeFromParent();
    this.build.dispose();
    this.trees.dispose();
    this.plants.dispose();
    this.grass.dispose();
    this.ground.dispose();
    this.skirt.geometry.dispose();
    this.groundMaterial.dispose();
    this.water.dispose();
    this.sky.dispose();
    this.heightTexture.dispose();
  }
}
