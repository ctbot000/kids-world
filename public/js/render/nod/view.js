// A dream of the Land of Nod on screen (shared/nod/worlds): its bodies, each
// wrapped in its skin (ground.js), all that stands on them (dress.js), its sky
// (sky.js) and its light (light.js), which comes from over wherever you are. The
// bodies near where you arrive are made first, the rest a little at a time, the
// nearest to you next.
import * as THREE from '../../../vendor/three.module.js';
import { Dress, LampModel, LanternModel, NightLight, SpringModel } from './dress.js';
import { bodyGeometry, bodyMaterial } from './ground.js';
import { Winks } from './fx.js';
import './frights-garden.js';
import './frights-mare.js';
import './frights-music.js';
import './frights-souls.js';
import { MAX_ZONES, nodLight } from './light.js';
import { MOODS } from './moods.js';
import { Motes } from './motes.js';
import { NodSky } from './sky.js';

const tmp = new THREE.Vector3();

export class NodView {
  constructor(scene, world, { quality = 'high' } = {}) {
    this.world = world;
    this.space = world.space;
    this.mood = MOODS[world.key] ?? MOODS.pillow;
    this.group = new THREE.Group();
    this.group.name = 'nod';
    scene.add(this.group);
    this.quality = quality;
    this.sky = new NodSky(this.mood.sky);
    this.group.add(this.sky.mesh);
    this.meshes = new Map();
    this.waiting = [...this.space.bodies];
    this.dress = new Dress(world);
    this.group.add(this.dress.group);
    this.springs = new Map();
    this.lamps = new Map();
    this.lanterns = [];
    for (const d of world.dress) {
      if (d.kind === 'spring') {
        const s = new SpringModel(world.springs.find((o) => o.id === d.spring), d, this.mood.tint);
        this.springs.set(d.spring, s);
        this.group.add(s.group);
      } else if (d.kind === 'lamp') {
        const l = new LampModel(d);
        this.lamps.set(d.lamp, l);
        this.group.add(l.group);
      } else if (d.kind === 'lantern') {
        const l = new LanternModel(d);
        this.lanterns.push(l);
        this.group.add(l.group);
      } else if (d.kind === 'nightlight') {
        this.night = new NightLight(d);
        this.group.add(this.night.group);
      }
    }
    this.motes = new Motes(this.mood.motes);
    this.group.add(this.motes.points);
    this.zones = [];
    this.time = 0;
    // Which way the sun is for what stands up the way up is where you are.
    this.sunDir = new THREE.Vector3(0.3, 1, 0.2).normalize();
    this.up = new THREE.Vector3(0, 1, 0);
    this.dark = 0;
    this.darkWanted = 0;
    const L = this.mood.light;
    nodLight.uKey.value.set(L.key);
    nodLight.uSky.value.set(L.sky);
    nodLight.uEarth.value.set(L.earth);
    nodLight.uRimColor.value.set(L.rim);
    nodLight.uRim.value = L.rimK;
    nodLight.uHaze.value.set(L.haze);
    nodLight.uHazeK.value = L.hazeK;
  }

  // Makes the bodies not made yet, nearest p first, for at most ms (all of
  // them, with no limit). Whether any are still to be made.
  build(p, ms = Infinity) {
    const end = performance.now() + ms;
    while (this.waiting.length) {
      this.waiting.sort((a, b) => Math.hypot(a.c.x - p.x, a.c.y - p.y, a.c.z - p.z) - a.reach - (Math.hypot(b.c.x - p.x, b.c.y - p.y, b.c.z - p.z) - b.reach));
      const body = this.waiting.shift();
      const mesh = new THREE.Mesh(bodyGeometry(body, this.space), bodyMaterial(body));
      mesh.name = `nod ${body.key}`;
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
      this.meshes.set(body.key, mesh);
      if (performance.now() >= end) break;
    }
    return this.waiting.length > 0;
  }

  // What is painted on the ground this frame: { x, y, z, r, color (THREE.Color),
  // a, kind (1 a spot about to be hit, 2 a wave, 3 a ring of fog, 4 a pool of
  // light), k }.
  setZones(list) {
    for (let i = 0; i < MAX_ZONES; i++) {
      const z = list[i];
      const kind = nodLight.uZoneKind.value[i];
      if (!z) {
        kind.x = 0;
        continue;
      }
      nodLight.uZone.value[i].set(z.x, z.y, z.z, z.r);
      nodLight.uZoneColor.value[i].set(z.color.r, z.color.g, z.color.b, z.a ?? 1);
      kind.set(z.kind, z.k ?? 0, 0, 0);
    }
  }

  // Quite dark (the Night Mare's moon, at the last), or light again.
  setDark(on) {
    this.darkWanted = on ? 1 : 0;
  }

  // The winks still to be found (taken: those found already).
  showWinks(list, taken) {
    this.winks?.dispose();
    this.winks = new Winks(list, taken);
    this.group.add(this.winks.mesh);
  }

  winkGone(i) {
    this.winks?.gone.add(i);
  }

  // Each frame: up, which way is up where you are; focus, where that is; lit,
  // how many of the lamps are, of all of them; asleep(spring): whether it is.
  frame(dt, { up, focus, camera, lit = 0, asleep = () => false, height = 800 }) {
    this.time += dt;
    nodLight.uTime.value = this.time;
    if (this.waiting.length) this.build(focus, 6);
    if (this.dark !== this.darkWanted) {
      const d = this.darkWanted - this.dark;
      this.dark += Math.sign(d) * Math.min(Math.abs(d), dt * 1.4);
      const L = this.mood.light;
      const k = 1 - this.dark * 0.86;
      nodLight.uKey.value.set(L.key).multiplyScalar(k);
      nodLight.uSky.value.set(L.sky).multiplyScalar(k);
      nodLight.uEarth.value.set(L.earth).multiplyScalar(k);
      nodLight.uRim.value = L.rimK * (1 - this.dark * 0.5);
      nodLight.uHaze.value.set(L.haze).multiplyScalar(k);
      this.sky.uniforms.uDim.value = 1 - this.dark * 0.8;
    }
    this.sky.update(this.time);
    for (const s of this.springs.values()) s.update(dt, asleep(s.spring));
    for (const l of this.lamps.values()) l.update(dt);
    for (const l of this.lanterns) l.update(dt);
    this.night?.update(dt, lit);
    this.motes.update(this.time, camera, height);
    this.winks?.update(this.time);
    this.up.lerp(tmp.set(up.x, up.y, up.z), 1 - Math.exp(-dt * 4)).normalize();
    // The light comes from over you, a little from one side (the same side,
    // as far as can be, as you go round).
    const side = tmp.set(0.45, 0.2, 0.6).addScaledVector(this.up, -this.up.dot(tmp)).normalize();
    this.sunDir.copy(this.up).multiplyScalar(1).addScaledVector(side, 0.55).normalize();
  }

  dispose() {
    this.setZones([]);
    this.group.removeFromParent();
    this.sky.dispose();
    this.dress.dispose();
    for (const s of this.springs.values()) s.dispose();
    for (const l of this.lamps.values()) l.dispose();
    for (const l of this.lanterns) l.dispose();
    this.night?.dispose();
    this.motes.dispose();
    this.winks?.dispose();
    for (const m of this.meshes.values()) {
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}
