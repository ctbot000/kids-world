// Toon Isle drawn as a cartoon (the fifth episode of Adventure Isle's story,
// shared/isle-toon.js): no bricks anywhere, and nothing real either. Its world
// is still blocks underneath — what everyone walks on, what the island's
// rules go by — and this draws over them, in place of the blocks
// (render/terrain.js draws none of its own here): the ground as one smooth
// skin (real-ground.js's, its rock faces smoothed) painted as a storybook's
// (cartoon-ground.js), cartoon water with rings of foam (cartoon-water.js),
// puffball trees, giant toadstools and the rest (cartoon-plants.js), what is
// built wrapped in a skin of clay (cartoon-build.js), and over whatever
// nobody has got to yet, Baron Bluster's Cloud Blanket (cartoon-clouds.js).
// All of it in a storybook's soft light (cartoon-light.js), under the toy
// sky, with a glow round what shines (renderer.js buildFinish).
import * as THREE from '../../vendor/three.module.js';
import * as B from '../shared/blocks.js';
import { CHUNK } from '../shared/world.js';
import { cartoonLight } from './cartoon-light.js';
import { CartoonBuild } from './cartoon-build.js';
import { CloudBlanket, fogUniforms, SkyClouds } from './cartoon-clouds.js';
import { CartoonGrass } from './cartoon-grass.js';
import { cartoonGroundMaterial, columnTexture, setDetail } from './cartoon-ground.js';
import { CartoonPlants } from './cartoon-plants.js';
import { CartoonSparkles } from './cartoon-sparkles.js';
import { CartoonWater } from './cartoon-water.js';
import { RealGround } from './real-ground.js';
import { seabed } from './real.js';

// The islands drawn so (worldgen.js palette has their ground).
const CARTOON_THEMES = new Set(['toonbay', 'toonwood', 'tooncanyon', 'toonpeak', 'toonstorm']);
export const isCartoon = (theme) => CARTOON_THEMES.has(theme);

// The skin's slopes lit as the lie of the land, not as its steps: each point
// that faces up at all takes the slope of the land round it, a few blocks
// either way, so a hill of one-block steps is lit as one round hill (in the
// light a step lit on its own is a stripe, one to every step). Faces of rock
// keep their own.
function smoothSlopes(ground, world) {
  const { W, D } = world;
  const h = ground.cols.height;
  const at = (x, z) => h[Math.max(0, Math.min(W - 1, x)) * D + Math.max(0, Math.min(D - 1, z))];
  // The land's height, blurred over the columns round each.
  const blur = new Float32Array(W * D);
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      let sum = 0;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) sum += at(x + dx, z + dz);
      blur[x * D + z] = sum / 25;
    }
  }
  const b = (x, z) => blur[Math.max(0, Math.min(W - 1, Math.round(x))) * D + Math.max(0, Math.min(D - 1, Math.round(z)))];
  const pos = ground.geometry.getAttribute('position');
  const nor = ground.geometry.getAttribute('normal');
  const n = new THREE.Vector3();
  const o = new THREE.Vector3();
  for (let v = 0; v < pos.count; v++) {
    o.fromBufferAttribute(nor, v);
    if (o.y < 0.3) continue;
    const x = pos.getX(v) - 0.5;
    const z = pos.getZ(v) - 0.5;
    n.set(-(b(x + 2, z) - b(x - 2, z)) / 4, 1, -(b(x, z + 2) - b(x, z - 2)) / 4).normalize();
    o.lerp(n, 0.85).normalize();
    nor.setXYZ(v, o.x, o.y, o.z);
  }
  nor.needsUpdate = true;
}

// How thick the grass grows round the camera, and how far out, by picture
// quality.
function grassFor(quality) {
  if (quality === 'high') return { density: 7, reach: 32 };
  if (quality === 'medium') return { density: 5, reach: 24 };
  return { density: 3, reach: 16 };
}

export class CartoonWorld {
  constructor(gl, world, light, quality = 'high') {
    this.world = world;
    this.quality = quality;
    this.group = new THREE.Group();
    this.group.name = 'cartoon';
    this.uniforms = {
      uLampColor: { value: new THREE.Color(1.0, 0.7, 0.35).multiplyScalar(0.9) },
      uNight: { value: 0 },
    };
    // The Cloud Blanket's state, read by the ground, the plants, what is
    // built and the clouds themselves.
    this.fog = fogUniforms();
    const trees = [];
    for (let x = 0; x < world.W; x++) {
      for (let z = 0; z < world.D; z++) {
        for (let y = world.H - 1; y > 0; y--) {
          if (B.isTreeFoot(world.get(x, y, z))) trees.push([x, y, z]);
        }
      }
    }
    this.ground = new RealGround(world, light, trees, { rough: 0.3 });
    smoothSlopes(this.ground, world);
    this.columns = columnTexture(world, this.ground.cols);
    this.groundMaterial = cartoonGroundMaterial(world.theme, this.fog, this.uniforms, this.columns, { size: [world.W, world.D], sea: world.sea, detail: quality !== 'low' });
    this.groundMesh = new THREE.Mesh(this.ground.geometry, this.groundMaterial);
    this.groundMesh.name = 'cartoon ground';
    this.groundMesh.receiveShadow = true;
    this.groundMesh.matrixAutoUpdate = false;
    this.group.add(this.groundMesh);
    this.skirt = new THREE.Mesh(seabed(this.ground, world), this.groundMaterial);
    this.skirt.receiveShadow = true;
    this.skirt.matrixAutoUpdate = false;
    this.group.add(this.skirt);
    this.heightTexture = this.ground.heightTexture();
    this.water = new CartoonWater(world, this.ground.cols, this.heightTexture, cartoonLight.uLightTint);
    this.group.add(this.water.group);
    this.plants = new CartoonPlants(world, this.ground, this.fog);
    this.group.add(this.plants.group);
    this.grass = new CartoonGrass(world, this.ground, this.fog, grassFor(quality));
    this.group.add(this.grass.group);
    this.build = new CartoonBuild(world, this.fog);
    this.group.add(this.build.group);
    for (let cx = 0; cx < world.chunksX; cx++) for (let cz = 0; cz < world.chunksZ; cz++) this.build.build(cx, cz);
    this.clouds = new CloudBlanket(world, this.ground.cols, this.fog);
    this.group.add(this.clouds.group);
    this.sky = new SkyClouds(world, this.fog);
    this.group.add(this.sky.mesh);
    this.sparkles = new CartoonSparkles(world.seed);
    this.group.add(this.sparkles.points);
    this.time = 0;
  }

  // Each frame: the water moving, the clouds clearing and breathing, the
  // lamps by night, what grows drawn in detail near the camera (and not at
  // all past the haze's end, far), and the sparkles in the air round it (as
  // big on a picture of any height).
  frame(dt, env, camera = null, far = 200, height = 800) {
    this.time += dt;
    if (camera) {
      this.plants.update(camera, far);
      this.grass.update(camera);
      this.sparkles.update(this.time, camera, env, height);
    }
    this.water.update(this.time, env);
    this.clouds.update(this.time);
    this.uniforms.uNight.value = Math.max(0, 1 - env.day * 1.3);
    this.build.frame(this.time);
  }

  // The Cloud Blanket as the game has it (isle-battles-view.js readFog), or
  // null: nothing hidden.
  setFog(fog) {
    this.clouds.set(fog);
  }

  // Tiles of it newly rolled back.
  fogChanged(fog, tiles) {
    if (this.clouds.fog !== fog) this.clouds.set(fog);
    else this.clouds.reveal(tiles);
  }

  // The Sky Lantern lit (the stage won).
  setLantern(on) {
    this.build.setLit(on);
  }

  // Blocks changed (an ambush's ring of thorns, a beacon alight, a lamp lit):
  // what of it shows here.
  cellsChanged(cells) {
    this.ground.repaint?.(cells);
    // (What each column is made of, for its cliffs: cartoon-ground.js.)
    const data = this.columns.image.data;
    const { W, D } = this.world;
    for (let i = 0; i < cells.length; i += 4) {
      const x = cells[i];
      const z = cells[i + 2];
      if (x < 0 || z < 0 || x >= W || z >= D) continue;
      data[(z * W + x) * 4 + 1] = this.ground.cols.kind[x * D + z];
    }
    this.columns.needsUpdate = true;
    this.plants.cellsChanged(cells);
    const chunks = new Set();
    for (let i = 0; i < cells.length; i += 4) {
      const cx = Math.floor(cells[i] / CHUNK);
      const cz = Math.floor(cells[i + 2] / CHUNK);
      // (A skin's chunk reaches a cell into its neighbours.)
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) chunks.add(`${cx + dx},${cz + dz}`);
    }
    for (const key of chunks) {
      const [cx, cz] = key.split(',').map(Number);
      if (cx >= 0 && cz >= 0 && cx < this.world.chunksX && cz < this.world.chunksZ) this.build.build(cx, cz);
    }
  }

  // The picture's quality changed: the grass grown again, as thick as it is.
  setQuality(quality) {
    if (quality === this.quality) return;
    this.quality = quality;
    this.group.remove(this.grass.group);
    this.grass.dispose();
    this.grass = new CartoonGrass(this.world, this.ground, this.fog, grassFor(quality));
    this.group.add(this.grass.group);
    setDetail(this.groundMaterial, quality !== 'low');
  }

  // How far up or down to draw what stands at (x, y, z), so it stands on the
  // ground as drawn (real-ground.js).
  lift(x, y, z, radius) {
    return this.ground.lift(x, y, z, radius);
  }

  dispose() {
    this.group.removeFromParent();
    this.clouds.dispose();
    this.sky.dispose();
    this.sparkles.dispose();
    this.build.dispose();
    this.plants.dispose();
    this.grass.dispose();
    this.water.dispose();
    this.ground.dispose();
    this.skirt.geometry.dispose();
    this.groundMaterial.dispose();
    this.heightTexture.dispose();
    this.columns.dispose();
    this.fog.uFog.value.dispose();
  }
}
