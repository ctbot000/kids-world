// The players: round-headed little animals in a t-shirt, with a hat if they
// like. Built from simple shapes and animated by hand — walking, jumping,
// swimming, flying, and the emotes (wave, dance, cheer...).
import * as THREE from '../../vendor/three.module.js';
import { BRICK_COLORS, TOY_BRICKS } from '../shared/blocks.js';
import { FUR_COLORS } from '../shared/words.js';
import { capsule, cone, cylinder, mesh, onSurface, sphere, toon, torus } from './toon.js';

const HEAD_R = 0.34;
const HEAD = { sx: 1.08, sy: 0.96, sz: 1 };
const HR = [HEAD_R * HEAD.sx, HEAD_R * HEAD.sy, HEAD_R * HEAD.sz];

const BLACK = '#2b2530';
const WHITE = '#ffffff';
const PINK = '#ff9fb8';

export const ANIM = { idle: 0, walk: 1, run: 2, air: 3, swim: 4, fly: 5 };

export function shirtColor(index) {
  return BRICK_COLORS[index]?.[2] ?? BRICK_COLORS[0][2];
}

function lighten(hex, k) {
  const c = new THREE.Color(hex);
  const w = new THREE.Color('#ffffff');
  return `#${c.lerp(w, k).getHexString()}`;
}

function darken(hex, k) {
  const c = new THREE.Color(hex);
  return `#${c.multiplyScalar(1 - k).getHexString()}`;
}

// A feature sitting on the face, pushed out along the head's surface.
function onFace(fx, fy, out) {
  return onSurface(HR[0], HR[1], HR[2], fx, fy, out);
}

function eyes(head, style = 'dot') {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const p = onFace(side * 0.12, 0.02, 0.005);
    const eye = mesh(sphere(1, 16, 12), toon(BLACK), p.x, p.y, p.z, 0.048, style === 'big' ? 0.075 : 0.062, 0.03);
    eye.lookAt(p.clone().multiplyScalar(2));
    const shine = mesh(sphere(1, 8, 6), toon(WHITE, { emissive: 0.6 }), p.x + side * 0.012 - 0.01, p.y + 0.022, p.z + 0.024, 0.016);
    group.add(eye, shine);
  }
  group.userData.blink = true;
  head.add(group);
  return group;
}

function blush(head) {
  for (const side of [-1, 1]) {
    const p = onFace(side * 0.2, -0.08, 0.004);
    const b = mesh(sphere(1, 12, 8), toon('#ff9ab0', { transparent: true, opacity: 0.75 }), p.x, p.y, p.z, 0.055, 0.032, 0.012);
    b.lookAt(p.clone().multiplyScalar(2));
    head.add(b);
  }
}

function smile(head, width = 0.05, y = -0.1) {
  const p = onFace(0, y, 0.004);
  const m = mesh(torus(width, 0.012, Math.PI), toon('#7a3b3b'), p.x, p.y, p.z);
  m.rotation.z = Math.PI;
  m.rotation.x = -0.35;
  head.add(m);
  return m;
}

function muzzle(head, color, noseColor = BLACK, size = 1) {
  const p = onFace(0, -0.07, -0.03);
  const mz = mesh(sphere(1, 16, 12), toon(color), p.x, p.y, p.z, 0.12 * size, 0.085 * size, 0.08 * size);
  head.add(mz);
  const n = mesh(sphere(1, 12, 8), toon(noseColor), p.x, p.y + 0.035 * size, p.z + 0.07 * size, 0.04, 0.03, 0.03);
  head.add(n);
}

function ears(head, animal, fur) {
  const inner = PINK;
  const topY = HR[1];
  const add = (m) => {
    head.add(m);
    return m;
  };
  switch (animal) {
    case 'bunny':
      for (const side of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(side * 0.13, topY * 0.8, -0.02);
        g.rotation.z = -side * 0.18;
        g.add(mesh(sphere(), toon(fur), 0, 0.26, 0, 0.075, 0.28, 0.05));
        g.add(mesh(sphere(), toon(inner), 0, 0.26, 0.025, 0.045, 0.22, 0.03));
        g.userData.ear = side;
        add(g);
      }
      break;
    case 'cat':
    case 'fox':
      for (const side of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(side * 0.18, topY * 0.78, 0);
        g.rotation.z = -side * 0.35;
        g.add(mesh(cone(0.11, animal === 'fox' ? 0.26 : 0.2, 4), toon(fur), 0, 0.08, 0));
        g.add(mesh(cone(0.06, animal === 'fox' ? 0.17 : 0.13, 4), toon(animal === 'fox' ? WHITE : inner), 0, 0.06, 0.035));
        g.userData.ear = side;
        add(g);
      }
      break;
    case 'bear':
    case 'panda':
    case 'koala':
    case 'mouse': {
      const big = animal === 'mouse' ? 0.15 : animal === 'koala' ? 0.14 : 0.1;
      const col = animal === 'panda' ? BLACK : fur;
      for (const side of [-1, 1]) {
        const e = add(mesh(sphere(), toon(col), side * 0.25, topY * 0.72, -0.03, big, big, big * 0.45));
        e.userData.ear = side;
        add(mesh(sphere(), toon(animal === 'koala' ? WHITE : animal === 'panda' ? '#4a4450' : inner), side * 0.25, topY * 0.72, big * 0.2, big * 0.6, big * 0.6, big * 0.2));
      }
      break;
    }
    case 'puppy':
      for (const side of [-1, 1]) {
        const e = add(mesh(sphere(), toon(darken(fur, 0.25)), side * 0.33, 0.02, 0, 0.08, 0.2, 0.06));
        e.rotation.z = side * 0.25;
        e.userData.ear = side;
      }
      break;
    case 'pig':
      for (const side of [-1, 1]) {
        const e = add(mesh(cone(0.08, 0.13, 4), toon(fur), side * 0.2, topY * 0.8, 0.02));
        e.rotation.z = -side * 0.4;
        e.rotation.x = 0.3;
        e.userData.ear = side;
      }
      break;
    default:
      break;
  }
}

function face(head, animal, fur) {
  switch (animal) {
    case 'frog': {
      for (const side of [-1, 1]) {
        head.add(mesh(sphere(), toon(fur), side * 0.15, HR[1] * 0.78, 0.1, 0.12));
        head.add(mesh(sphere(), toon(WHITE), side * 0.15, HR[1] * 0.8, 0.17, 0.085));
        head.add(mesh(sphere(), toon(BLACK), side * 0.15, HR[1] * 0.8, 0.245, 0.045, 0.055, 0.02));
      }
      smile(head, 0.12, -0.05);
      blush(head);
      return null;
    }
    case 'pig': {
      const e = eyes(head);
      const p = onFace(0, -0.06, -0.015);
      head.add(mesh(cylinder(0.08, 0.08, 0.06, 16), toon('#ff8fae'), p.x, p.y, p.z, 1, 1, 1).rotateX(Math.PI / 2));
      for (const side of [-1, 1]) head.add(mesh(sphere(), toon('#c05a7a'), p.x + side * 0.028, p.y, p.z + 0.032, 0.014, 0.022, 0.01));
      blush(head);
      return e;
    }
    case 'panda': {
      for (const side of [-1, 1]) {
        const p = onFace(side * 0.12, 0.01, -0.01);
        const patch = mesh(sphere(), toon(BLACK), p.x, p.y, p.z, 0.08, 0.1, 0.04);
        patch.rotation.z = side * 0.5;
        head.add(patch);
      }
      const e = eyes(head, 'big');
      for (const child of e.children) if (child.material.color.getHexString() === '2b2530') child.material = toon(WHITE);
      for (const side of [-1, 1]) {
        const p = onFace(side * 0.12, 0.02, 0.03);
        head.add(mesh(sphere(), toon(BLACK), p.x, p.y, p.z, 0.028, 0.035, 0.015));
      }
      muzzle(head, WHITE, BLACK, 0.8);
      return e;
    }
    case 'bear':
      muzzle(head, lighten(fur, 0.45));
      break;
    case 'puppy':
      muzzle(head, lighten(fur, 0.5));
      break;
    case 'fox':
      muzzle(head, WHITE);
      break;
    case 'koala': {
      const p = onFace(0, -0.04, -0.01);
      head.add(mesh(sphere(), toon('#4a4450'), p.x, p.y, p.z, 0.07, 0.09, 0.06));
      break;
    }
    case 'mouse':
    case 'bunny':
    case 'cat': {
      const p = onFace(0, -0.045, 0.004);
      head.add(mesh(sphere(), toon('#ff7f9f'), p.x, p.y, p.z, 0.03, 0.022, 0.02));
      smile(head, 0.035, -0.1);
      break;
    }
    default:
      break;
  }
  const e = eyes(head);
  blush(head);
  return e;
}

function tail(root, animal, fur) {
  const t = new THREE.Group();
  t.position.set(0, 0.36, -0.2);
  switch (animal) {
    case 'bunny':
    case 'bear':
    case 'panda':
      t.add(mesh(sphere(), toon(animal === 'bunny' ? WHITE : animal === 'panda' ? BLACK : fur), 0, 0, -0.02, 0.08));
      break;
    case 'cat':
    case 'fox':
    case 'mouse': {
      const len = animal === 'mouse' ? 0.36 : 0.3;
      const r = animal === 'fox' ? 0.08 : animal === 'mouse' ? 0.025 : 0.045;
      const m = mesh(capsule(r, len), toon(animal === 'mouse' ? PINK : fur), 0, len / 2, -0.06);
      m.rotation.x = -0.7;
      t.add(m);
      if (animal === 'fox') t.add(mesh(sphere(), toon(WHITE), 0, len * 0.95, -0.28, 0.07));
      break;
    }
    case 'puppy':
      t.add(mesh(capsule(0.04, 0.14), toon(fur), 0, 0.08, -0.04).rotateX(-0.9));
      break;
    case 'pig':
      t.add(mesh(torus(0.04, 0.015), toon(fur), 0, 0.02, -0.02));
      break;
    default:
      return null;
  }
  root.add(t);
  return t;
}

function hat(head, kind, shirt) {
  const top = HR[1];
  const g = new THREE.Group();
  g.position.set(0, top * 0.72, 0);
  const add = (...ms) => ms.forEach((m) => g.add(m));
  switch (kind) {
    case 'cap': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(shirt));
      dome.scale.set(1.2, 0.8, 1.15);
      add(dome, mesh(cylinder(0.2, 0.2, 0.02, 20), toon(shirt), 0, 0.01, 0.3, 1, 1, 0.8), mesh(sphere(), toon(WHITE), 0, 0.24, 0, 0.035));
      break;
    }
    case 'flower': {
      const f = new THREE.Group();
      f.position.set(0.22, 0.08, 0.12);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        f.add(mesh(sphere(), toon('#ff8fc4'), Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0, 0.05, 0.05, 0.025));
      }
      f.add(mesh(sphere(), toon('#ffd84d'), 0, 0, 0.015, 0.04, 0.04, 0.02));
      f.rotation.y = 0.5;
      add(f);
      break;
    }
    case 'bow': {
      const b = new THREE.Group();
      b.position.set(0.16, 0.12, 0.05);
      b.rotation.z = -0.3;
      for (const side of [-1, 1]) b.add(mesh(sphere(), toon('#ff5f8f'), side * 0.08, 0, 0, 0.09, 0.06, 0.04));
      b.add(mesh(sphere(), toon('#e0406f'), 0, 0, 0.01, 0.035));
      add(b);
      break;
    }
    case 'party': {
      const c = mesh(cone(0.13, 0.32, 18), toon(shirt), 0, 0.2, 0);
      add(c, mesh(sphere(), toon('#ffd84d'), 0, 0.37, 0, 0.05));
      for (let i = 0; i < 3; i++) add(mesh(torus(0.1 - i * 0.03, 0.012), toon(WHITE), 0, 0.09 + i * 0.08, 0).rotateX(Math.PI / 2));
      break;
    }
    case 'crown': {
      const gold = toon('#ffcf3f', { emissive: 0.15 });
      add(mesh(cylinder(0.17, 0.17, 0.08, 20, true), gold, 0, 0.06, 0));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(mesh(cone(0.04, 0.09, 4), gold, Math.cos(a) * 0.16, 0.14, Math.sin(a) * 0.16));
      }
      add(mesh(sphere(), toon('#ff4f6f'), 0, 0.06, 0.17, 0.03));
      break;
    }
    case 'beanie': {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(shirt));
      dome.scale.set(1.18, 0.9, 1.12);
      add(dome, mesh(torus(0.33, 0.045), toon(lighten(shirt, 0.35)), 0, 0.02, 0, 1.05, 1, 1).rotateX(Math.PI / 2), mesh(sphere(), toon(WHITE), 0, 0.3, 0, 0.07));
      break;
    }
    case 'sprout': {
      add(mesh(cylinder(0.012, 0.012, 0.14, 6), toon('#4fae3e'), 0, 0.22, 0));
      for (const side of [-1, 1]) {
        const l = mesh(sphere(), toon('#6fcf55'), side * 0.07, 0.3, 0, 0.08, 0.035, 0.04);
        l.rotation.z = side * 0.4;
        add(l);
      }
      break;
    }
    case 'straw': {
      const straw = toon('#f2d27a');
      add(mesh(cylinder(0.42, 0.42, 0.025, 28), straw, 0, 0.02, 0));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), straw);
      dome.scale.set(1.1, 0.8, 1.1);
      add(dome, mesh(cylinder(0.25, 0.25, 0.05, 24), toon('#ff6f8f'), 0, 0.04, 0));
      break;
    }
    case 'headphones': {
      const band = mesh(torus(0.34, 0.025, Math.PI), toon(shirt), 0, -0.1, 0);
      add(band);
      for (const side of [-1, 1]) add(mesh(cylinder(0.09, 0.09, 0.06, 16), toon(darken(shirt, 0.2)), side * 0.35, -0.12, 0).rotateZ(Math.PI / 2));
      break;
    }
    default:
      return null;
  }
  head.add(g);
  return g;
}

export class Avatar {
  constructor(look, { name = '' } = {}) {
    this.root = new THREE.Group();
    this.root.name = `avatar ${name}`;
    this.look = null;
    this.phase = 0;
    this.blinkAt = 2 + Math.random() * 3;
    this.emote = null;
    this.emoteAt = 0;
    this.time = 0;
    this.anim = ANIM.idle;
    this.speed = 0;
    this.setLook(look);
    // A soft round shadow under the feet.
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    shadow.renderOrder = 1;
    this.shadow = shadow;
  }

  setLook(look) {
    const same = this.look && JSON.stringify(this.look) === JSON.stringify(look);
    if (same) return;
    this.look = { ...look };
    if (this.body) this.root.remove(this.body);
    const fur = FUR_COLORS[look.fur] ?? FUR_COLORS.white;
    const shirt = shirtColor(look.shirt);
    const body = new THREE.Group();
    this.body = body;
    this.root.add(body);

    this.legs = [-1, 1].map((side) => {
      const leg = new THREE.Group();
      leg.position.set(side * 0.1, 0.28, 0);
      leg.add(mesh(cylinder(0.07, 0.08, 0.24, 12), toon(look.animal === 'frog' ? fur : darken(shirt, 0.35)), 0, -0.12, 0));
      leg.add(mesh(sphere(), toon(look.animal === 'frog' ? darken(fur, 0.1) : '#6b4a3a'), 0, -0.24, 0.03, 0.085, 0.06, 0.11));
      body.add(leg);
      return leg;
    });
    this.torso = new THREE.Group();
    this.torso.position.y = 0.28;
    body.add(this.torso);
    this.torso.add(mesh(capsule(0.2, 0.16), toon(shirt), 0, 0.22, 0, 1, 1, 0.85));
    // A little collar in the fur colour, so the head sits nicely.
    this.torso.add(mesh(sphere(), toon(fur), 0, 0.44, 0, 0.14, 0.06, 0.12));
    this.arms = [-1, 1].map((side) => {
      const arm = new THREE.Group();
      arm.position.set(side * 0.23, 0.4, 0);
      arm.rotation.z = side * 0.18;
      arm.add(mesh(capsule(0.062, 0.14), toon(shirt), 0, -0.1, 0));
      arm.add(mesh(sphere(), toon(fur), 0, -0.22, 0, 0.07));
      this.torso.add(arm);
      return arm;
    });
    this.head = new THREE.Group();
    this.head.position.y = 0.5;
    this.torso.add(this.head);
    const skull = new THREE.Group();
    skull.position.y = 0.3;
    this.head.add(skull);
    this.skull = skull;
    skull.add(mesh(sphere(HEAD_R, 28, 20), toon(fur), 0, 0, 0, HEAD.sx, HEAD.sy, HEAD.sz));
    ears(skull, look.animal, fur);
    this.eyes = face(skull, look.animal, fur);
    this.hat = hat(skull, look.hat, shirt);
    this.tail = tail(this.torso, look.animal, fur);
    this.root.traverse((o) => {
      if (o.isMesh) o.castShadow = false;
    });
  }

  playEmote(key) {
    this.emote = key;
    this.emoteAt = this.time;
  }

  // anim: one of ANIM; speed: ground speed (for the walk cycle).
  update(dt, anim, speed) {
    this.time += dt;
    const t = this.time;
    this.anim = anim;
    const moving = anim === ANIM.walk || anim === ANIM.run;
    this.phase += dt * (moving ? 3.2 + speed * 1.6 : 0);
    const s = Math.sin(this.phase);
    const [legL, legR] = this.legs;
    const [armL, armR] = this.arms;
    // Rest pose.
    let bob = 0;
    let lean = 0;
    let legSwing = 0;
    let armSwing = 0;
    let armRaiseL = 0.18;
    let armRaiseR = 0.18;
    let armFwdL = 0;
    let armFwdR = 0;
    let spin = 0;
    let headTilt = 0;
    let headNod = 0;

    if (moving) {
      const k = anim === ANIM.run ? 1 : 0.75;
      legSwing = s * 0.7 * k;
      armSwing = -s * 0.6 * k;
      bob = Math.abs(s) * 0.05 * k;
      lean = 0.08 * k;
    } else if (anim === ANIM.air) {
      legSwing = 0.3;
      armRaiseL = armRaiseR = 1.4;
    } else if (anim === ANIM.swim) {
      lean = 0.5;
      armFwdL = Math.sin(t * 6) * 0.9 - 1.2;
      armFwdR = Math.sin(t * 6 + Math.PI) * 0.9 - 1.2;
      legSwing = Math.sin(t * 8) * 0.4;
      bob = Math.sin(t * 3) * 0.04 - 0.35;
    } else if (anim === ANIM.fly) {
      armRaiseL = armRaiseR = 1.25;
      lean = 0.25;
      bob = Math.sin(t * 2.5) * 0.06;
      legSwing = 0.15;
    } else {
      bob = Math.sin(t * 2) * 0.008;
      armRaiseL = armRaiseR = 0.18 + Math.sin(t * 2) * 0.03;
    }

    // Emotes play over the pose for a few seconds.
    let hop = 0;
    if (this.emote) {
      const e = t - this.emoteAt;
      const done = e > (this.emote === 'dance' ? 3.2 : 2.2);
      if (done) this.emote = null;
      else {
        switch (this.emote) {
          case 'wave':
            armRaiseR = 2.6;
            armFwdR = Math.sin(e * 12) * 0.35;
            headTilt = 0.15;
            break;
          case 'dance':
            spin = e * Math.PI * 1.3;
            hop = Math.abs(Math.sin(e * 7)) * 0.12;
            armRaiseL = 2.2 + Math.sin(e * 7) * 0.5;
            armRaiseR = 2.2 - Math.sin(e * 7) * 0.5;
            legSwing = Math.sin(e * 7) * 0.4;
            break;
          case 'cheer':
            armRaiseL = armRaiseR = 2.7;
            hop = Math.max(0, Math.sin(e * 6)) * 0.3;
            break;
          case 'hearts':
            headTilt = Math.sin(e * 3) * 0.2;
            armFwdL = armFwdR = -0.9;
            armRaiseL = armRaiseR = -0.35;
            break;
          case 'clap': {
            const c = Math.abs(Math.sin(e * 10));
            armFwdL = armFwdR = -1.3;
            armRaiseL = -0.5 * c - 0.05;
            armRaiseR = -0.5 * c - 0.05;
            break;
          }
          case 'sleepy':
            headTilt = 0.35;
            headNod = 0.25 + Math.sin(e * 2) * 0.05;
            break;
          case 'laugh':
            headNod = -0.3;
            bob = Math.abs(Math.sin(e * 16)) * 0.03;
            armFwdL = armFwdR = -0.6;
            armRaiseL = armRaiseR = -0.2;
            break;
          case 'surprise':
            hop = Math.max(0, Math.sin(Math.min(e, 0.6) * 5.2)) * 0.18;
            armRaiseL = armRaiseR = 1.1;
            headNod = -0.2;
            break;
          default:
            break;
        }
      }
    }

    legL.rotation.x = legSwing;
    legR.rotation.x = -legSwing;
    // The arms hang from mirrored shoulders, so each side opens outward with its own sign.
    armL.rotation.set(armSwing + armFwdL, 0, -(armRaiseL ?? 0.18));
    armR.rotation.set(-armSwing + armFwdR, 0, armRaiseR ?? 0.18);
    this.body.position.y = bob + hop;
    this.body.rotation.y = spin;
    this.torso.rotation.x = lean;
    this.head.rotation.set(headNod, 0, headTilt);
    if (this.tail) this.tail.rotation.y = Math.sin(t * (moving ? 10 : 3)) * 0.3;
    // Blink now and then.
    if (this.eyes) {
      this.blinkAt -= dt;
      const closed = this.blinkAt < 0.12 || this.emote === 'sleepy' || this.emote === 'laugh';
      this.eyes.scale.y = closed ? 0.12 : 1;
      if (this.blinkAt < 0) this.blinkAt = 2.5 + Math.random() * 3;
    }
  }

  dispose() {
    this.root.removeFromParent();
    this.shadow.removeFromParent();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}

export const shirtHex = (index) => shirtColor(index);
export const brickIdForShirt = (index) => TOY_BRICKS[index];
