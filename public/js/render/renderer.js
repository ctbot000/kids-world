// Puts the island on screen: the terrain, the sky, players and their pets, animals and monsters,
// the pictures on drawing boards,
// Adventure Isle's flags (and the stomps of its bosses), the preview
// of what a tool is about to do, and a camera that follows you around (and
// never ends up inside a hill). Everything that moves is a glossy toy under a
// studio's light (render/toon.js); at the better picture qualities it casts
// shadows on the ground, everything is shaded where it meets something, and
// what the camera is not looking at goes soft, as in a photo of a toy (see
// QUALITY).
import * as THREE from '../../vendor/three.module.js';
import { RoomEnvironment } from '../../vendor/three-addons/environments/RoomEnvironment.js';
import { FXAAPass } from '../../vendor/three-addons/postprocessing/FXAAPass.js';
import { GTAOPass } from '../../vendor/three-addons/postprocessing/GTAOPass.js';
import { OutputPass } from '../../vendor/three-addons/postprocessing/OutputPass.js';
import { ShaderPass } from '../../vendor/three-addons/postprocessing/ShaderPass.js';
import { DIRT, GRASS, OPAQUE, SOLID, TREE_PART } from '../shared/blocks.js';
import { headTop } from '../shared/critters.js';
import { LightMap } from '../shared/light.js';
import { STOMP } from '../shared/monsters.js';
import { raycast } from '../shared/raycast.js';
import { stampByKey } from '../shared/stamps.js';
import { MAX_EDIT_CELLS } from '../shared/tools.js';
import { lookHair, lookTall } from '../shared/words.js';
import { World } from '../shared/world.js';
import { FlagModel, KingModel, Shockwave } from './adventure-models.js';
import { makeBoss } from './boss-models.js';
import { Thrown, WarnRing, WarnStrip } from './boss-fx.js';
import { Meteor, RainbowBeam, ZapBolt } from './weapon-fx.js';
import { isBoss } from '../shared/bosses.js';
import { ANIM, Avatar, shirtHex, weapon } from './avatar.js';
import { CritterModel } from './critter-models.js';
import { Drawings } from './drawings.js';
import { RoboKits } from './robokits.js';
import { GoBoards } from './go-boards.js';
import { Screens } from './screens.js';
import { Tornado } from './tornado-model.js';
import { Effects } from './effects.js';
import { Jolt } from './jolt.js';
import { FireView } from './fire.js';
import { shownBox } from './monster-figures.js';
import { setFurLayers } from './dog-fur.js';
import { MonsterModel } from './monster-model.js';
import { MosquitoModel, QueenMosquitoModel } from './mosquito-model.js';
import { PetModel, petSeat } from './pet-models.js';
import { SpiderModel } from './spider-model.js';
import { MoleModel } from './mole-model.js';
import { ShroomModel, SnapperModel } from './isle-monsters.js';
import { makeBeast } from './beasts.js';
import { isBeast } from '../shared/beasts.js';
import { environment, Sky } from './sky.js';
import { NEAR_FADE, Terrain } from './terrain.js';
import { setStudio, toyLight } from './toon.js';

// All of the biggest edit there can be, a huge tent on a hillside say.
const MAX_PREVIEW = MAX_EDIT_CELLS;
// Nearer than this along the view, more than half of a block is dissolved.
const SEE_THROUGH = (NEAR_FADE[0] + NEAR_FADE[1]) / 2;
// The ways of looking the camera button steps through, in order.
export const VIEWS = {
  behind: { dist: 8, pitch: 0.45 },
  eyes: { dist: 0.35, pitch: 0.12 },
  sky: { dist: 18, pitch: 1.25 },
};
const tmpV = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
const tmpC = new THREE.Color();
const tmpX = new THREE.Vector3();
const tmpY = new THREE.Vector3();
const tmpZ = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const WHITE = new THREE.Color(1, 1, 1);
const FLASH = new THREE.Color('#e8ecff');

// How finished each picture is, best first: drawn into a picture of its own
// (post) of at most this many pixels (fewer pixels per CSS pixel on a big,
// sharp screen), multisampled this many times for smooth edges (or smoothed
// afterwards, FXAA); shaded where things meet (ambient occlusion, worked out
// on at most this many pixels and spread over the picture, with this many
// samples); soft out of focus (dof); with the shadows of what moves on a map
// this many texels across; and with a dog's fur in at most this many layers
// (dog-fur.js). The lowest draws straight to the screen with none of the
// rest: still glossy toys.
export const QUALITY = {
  high: { post: true, pixels: 4.2e6, samples: 4, ao: 1.2e6, aoSamples: 12, dof: true, shadows: 2048, fur: 18 },
  medium: { post: true, pixels: 2.6e6, samples: 0, ao: 0.4e6, aoSamples: 8, dof: false, shadows: 1024, fur: 10 },
  low: { post: false, pixels: Infinity, samples: 0, ao: 0, aoSamples: 0, dof: false, shadows: 0, fur: 5 },
};
// Watching an island unseen (free), the camera backs off this far at most,
// and sees at least this far, so a whole island is in sight.
const FREE_DIST = 140;
const FREE_FOG = 320;
// Shadows are drawn this far round you, either way, fading out before the edge.
const SHADOW_EXTENT = 13;
// Snow lying about: all the way from none to thick in 150 seconds of snow
// (block tops all white by 100), and melted in 120 once it stops.
const SNOW_RATE = 1 / 150;
const MELT_RATE = 1 / 120;

// A camera's shallow focus, as in a photo of a toy up close: what is well
// nearer or further than `focus` (along the view) goes soft, the more so the
// further off it is. From the depth of the scene as drawn, so the studs
// (placed in their own shader) blur where they are. A sample counts where its
// own blur reaches this pixel, so nothing sharp bleeds into the soft behind it.
function focusPass(depth) {
  return new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: depth },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 1000 },
        focus: { value: 8 },
        maxBlur: { value: 6 },
        strength: { value: 1.1 },
        resolution: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
        #include <packing>
        uniform sampler2D tDiffuse;
        uniform sampler2D tDepth;
        uniform float cameraNear;
        uniform float cameraFar;
        uniform float focus;
        uniform float maxBlur;
        uniform float strength;
        uniform vec2 resolution;
        varying vec2 vUv;
        float zAt(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
        float blurAt(float z) { return maxBlur * clamp((abs(z - focus) / z - 0.12) * strength, 0.0, 1.0); }
        void main() {
          float zc = zAt(vUv);
          float cc = blurAt(zc);
          vec3 sum = texture2D(tDiffuse, vUv).rgb;
          // In focus: as it is (what is just in front of it hardly ever blurs over it).
          if (cc < 0.5) {
            gl_FragColor = vec4(sum, 1.0);
            return;
          }
          float weights = 1.0;
          for (int i = 0; i < 24; i++) {
            float r = sqrt((float(i) + 0.5) / 24.0) * maxBlur;
            float a = float(i) * 2.39996323;
            vec2 uv = vUv + vec2(cos(a), sin(a)) * r / resolution;
            float zs = zAt(uv);
            float reach = zs < zc ? blurAt(zs) : min(blurAt(zs), cc);
            float w = smoothstep(r - 1.0, r + 0.5, reach);
            sum += texture2D(tDiffuse, uv).rgb * w;
            weights += w;
          }
          gl_FragColor = vec4(sum / weights, 1.0);
        }`,
    }),
  );
}

export class Renderer {
  constructor(canvas, atlas) {
    this.canvas = canvas;
    this.atlas = atlas;
    const gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
    this.gl = gl;
    // Whether this browser draws without a GPU (a software renderer): it
    // starts on the plainest picture (see quality.js). Chrome names the GPU
    // only through the debug extension, which Firefox no longer needs.
    const ctx = gl.getContext();
    const name = String(ctx.getParameter(ctx.RENDERER));
    const debug = /^(webkit webgl|mozilla)$/i.test(name) ? ctx.getExtension('WEBGL_debug_renderer_info') : null;
    this.software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(`${name} ${debug ? ctx.getParameter(debug.UNMASKED_RENDERER_WEBGL) : ''}`);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.08, 1500);
    this.camera.position.set(0, 40, 40);
    this.terrain = new Terrain(this.scene, atlas);
    this.sky = new Sky(this.scene);
    this.effects = new Effects(this.scene, this.camera);
    this.jolted = new Jolt();
    // Anyone who asks their device for less motion gets a nudge, not a jolt.
    this.joltScale = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0.3 : 1;
    // Blocks lightning has set alight (shared/fire.js).
    this.fires = new FireView(this.scene, this.effects);
    this.tornado = new Tornado(this.scene);
    this.drawings = new Drawings(this.scene, this.terrain);
    this.goBoards = new GoBoards(this.scene, this.terrain);
    // The robots built at robot kits (shared/robokit.js).
    this.robotKits = new RoboKits(this.scene);
    this.screens = new Screens(this.scene, this.terrain);
    this.env = {};

    this.hemi = new THREE.HemisphereLight(0xdff2ff, 0x9fcf7f, 1.6);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    // The soft studio light the toys reflect (render/toon.js).
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    this.studio = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    setStudio(this.studio);
    gl.shadowMap.type = THREE.PCFShadowMap;
    this.finish = QUALITY.low;
    // The pixel ratio asked for (setQuality), before a quality's own limit.
    this.ratio = gl.getPixelRatio();
    // How dark the round blob under each foot is (fainter under a real shadow),
    // and when to look again for parts that cast shadows.
    this.blob = 1;
    this.sweepIn = 0;

    this.entities = new THREE.Group();
    this.entities.name = 'entities';
    this.scene.add(this.entities);
    this.avatars = new Map();
    this.critters = new Map();
    // Everyone's pets, by their owner.
    this.pets = new Map();
    this.monsters = new Map();
    // Adventure Isle's flags, by camp, and stomps rushing out over the ground.
    this.flags = new Map();
    this.shockwaves = [];
    // What shows of the bosses' moves before they come (boss-fx.js).
    this.bossFx = [];

    // What a tool is about to do: see-through blocks, or outlines for removal.
    const box = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    box.translate(0.5, 0.5, 0.5);
    this.previewMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false });
    this.preview = new THREE.InstancedMesh(box, this.previewMat, MAX_PREVIEW);
    this.preview.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.preview.count = 0;
    this.preview.frustumCulled = false;
    this.preview.renderOrder = 4;
    this.scene.add(this.preview);
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.03, 1.03, 1.03));
    edges.translate(0.5, 0.5, 0.5);
    this.outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: true }));
    this.outline.visible = false;
    this.outline.renderOrder = 6;
    this.scene.add(this.outline);

    this.view = { yaw: Math.PI * 0.85, pitch: 0.45, dist: 8, target: new THREE.Vector3(), smooth: new THREE.Vector3(), ready: false };
    // Watching an island unseen (game.js): no walls for the camera, and it
    // backs off and sees further.
    this.free = false;
    this.focus = { x: 0, y: 0, z: 0, cloudY: 90 };
    this.time = 0;
    // How much snow lies on the island, from none to a thick white blanket
    // (render/terrain.js SNOW_GLSL): it piles up while it snows and melts
    // away slower once it stops.
    this.snow = 0;
    this.world = null;
    this.selfHidden = false;
    // False while time is stepped without frames (see main.js): it moves on, nothing is drawn.
    this.drawing = true;
    this.resize();
  }

  setWorld(world) {
    this.world = world;
    this.terrain.setWorld(world);
    this.focus.cloudY = world.H + 22;
    this.view.ready = false;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (w < 2 || h < 2) return;
    this.gl.setPixelRatio(Math.max(1, Math.min(this.ratio, Math.sqrt(this.finish.pixels / (w * h)))));
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep a sensible sideways view on tall, narrow screens.
    const wide = 2 * Math.atan(Math.tan((62 * Math.PI) / 360) / this.camera.aspect) * (180 / Math.PI);
    this.camera.fov = Math.min(80, Math.max(58, wide));
    this.camera.updateProjectionMatrix();
    const post = this.post;
    if (post) {
      const { width, height } = this.canvas;
      for (const target of [post.scene, post.ping, post.pong]) target.setSize(width, height);
      for (const pass of post.passes) pass.setSize(width, height);
    }
  }

  // level: how finished the picture is (a key of QUALITY); then the cheaper
  // things to give up after that: the studs, sharpness, how far you see.
  setQuality({ level = 'low', studs = true, pixelRatio = null, far = null } = {}) {
    this.terrain.studsOn = studs;
    if (pixelRatio) this.ratio = pixelRatio;
    if (far) this.fogFar = far;
    if (level !== this.level && QUALITY[level]) {
      this.level = level;
      this.finish = QUALITY[level];
      this.buildFinish();
    }
    this.resize();
  }

  // The passes each picture goes through at this quality.
  buildFinish() {
    const q = this.finish;
    const gl = this.gl;
    this.disposePost();
    setFurLayers(q.fur);
    // The sun's shadows, cast by what moves (castShadows) onto the ground
    // (render/terrain.js) and onto each other.
    gl.shadowMap.enabled = q.shadows > 0;
    this.sun.castShadow = q.shadows > 0;
    this.blob = q.shadows ? 0.6 : 1;
    this.sweepIn = 0;
    if (q.shadows) {
      const shadow = this.sun.shadow;
      if (shadow.mapSize.x !== q.shadows) {
        shadow.mapSize.set(q.shadows, q.shadows);
        shadow.map?.dispose();
        shadow.map = null;
      }
      Object.assign(shadow.camera, { left: -SHADOW_EXTENT, right: SHADOW_EXTENT, top: SHADOW_EXTENT, bottom: -SHADOW_EXTENT, near: 1, far: 120 });
      shadow.camera.updateProjectionMatrix();
      const texel = (2 * SHADOW_EXTENT) / q.shadows;
      shadow.bias = -0.0005;
      shadow.normalBias = 1.5 * texel;
      shadow.radius = 2;
    }
    if (!q.post) return;
    // The scene is drawn into a picture of its own, with its depth for the
    // passes after it, and room for the bright glints of glossy toys where
    // the GPU can; then each pass draws into one of two plain pictures by
    // turns, and the last onto the screen. Only the scene's picture is
    // multisampled: they take a lot of the GPU's memory.
    const ext = gl.extensions;
    const type = ext.has('EXT_color_buffer_half_float') || ext.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const scene = new THREE.WebGLRenderTarget(1, 1, { type, samples: q.samples, depthTexture: new THREE.DepthTexture(1, 1) });
    const ping = new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: false });
    const post = { scene, ping, pong: ping.clone(), passes: [] };
    if (q.ao) {
      // Made without a depth texture, then given the scene's: its own
      // normal pass would redraw the terrain without its shaders (black), and
      // three r186's constructor throws when handed one (fixed in r187).
      const ao = new GTAOPass(this.scene, this.camera, 1, 1);
      ao.setGBuffer(scene.depthTexture);
      const sizeAo = ao.setSize.bind(ao);
      ao.setSize = (w, h) => {
        const k = Math.min(1, Math.sqrt(q.ao / (w * h)));
        sizeAo(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
      };
      ao.updateGtaoMaterial({ radius: 0.8, distanceExponent: 1.6, thickness: 1.5, scale: 1.6, samples: q.aoSamples, distanceFallOff: 1 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
      post.passes.push(ao);
    }
    if (q.dof) {
      this.focusPass = focusPass(scene.depthTexture);
      post.passes.push(this.focusPass);
    }
    // Into the screen's colours; edges not multisampled are smoothed after
    // that, where FXAA expects them.
    post.passes.push(new OutputPass());
    if (!q.samples) post.passes.push(new FXAAPass());
    this.post = post;
  }

  disposePost() {
    const post = this.post;
    if (!post) return;
    for (const pass of post.passes) pass.dispose();
    for (const target of [post.scene, post.ping, post.pong]) target.dispose();
    post.scene.depthTexture.dispose();
    this.post = null;
    this.focusPass = null;
  }

  // Draws the picture as it is now, at the quality there is.
  draw() {
    const gl = this.gl;
    const post = this.post;
    if (!post) {
      gl.render(this.scene, this.camera);
      return;
    }
    gl.setRenderTarget(post.scene);
    gl.render(this.scene, this.camera);
    const passes = post.passes.filter((pass) => pass.enabled);
    let read = post.scene;
    passes.forEach((pass, i) => {
      pass.renderToScreen = i === passes.length - 1;
      const write = read === post.ping ? post.pong : post.ping;
      pass.render(gl, write, read, 0, false);
      if (pass.needsSwap) read = write;
    });
    gl.setRenderTarget(null);
  }

  // Every part of what moves casts a shadow at the qualities that draw them,
  // but the see-through ones and the round blobs under feet. Parts come and
  // go (a hat, a sword, a model swapped), so frame() looks again now and then.
  castShadows() {
    const on = this.finish.shadows > 0;
    this.entities.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.userData.unflash ?? o.material;
      const solid = !m.isMeshBasicMaterial && !(m.transparent && m.opacity < 0.6) && !o.userData.noShadow;
      o.castShadow = on && solid;
      o.receiveShadow = on && !m.isMeshBasicMaterial;
    });
  }

  // ------------------------------------------------ players and animals

  addAvatar(pid, look, name) {
    this.removeAvatar(pid);
    const a = new Avatar(look, { name });
    a.pos = new THREE.Vector3();
    a.yaw = 0;
    this.entities.add(a.root, a.shadow);
    this.avatars.set(pid, a);
    return a;
  }

  // A little picture of someone's head as their avatar has it (fur, skin,
  // hair, hat and all), for the lists of players: a PNG data URL, lit as by
  // day whatever the time on the island, made once for each look.
  face(look) {
    return this.portrait(look);
  }

  // The same, or (body) the whole of them from their feet to over the hat,
  // in a frame as tall as wide (aspect), turned (radians) a little away from
  // straight on, for 🎨 Change me to show each choice on you; near: how close
  // to a head, and aim: how far under the top of it to look (in metres); top:
  // as high as a frame to fit, for heights side by side; size: how many
  // pixels wide. held: just the toy weapon in their hand, on its own,
  // tipped up to be seen whole; pet: just their pet (look.pet), sitting, in
  // a collar the colour of their T-shirt. critter: no one at all, but an
  // animal or vehicle of that type, for the toy box; stamp: the blocks of
  // that stamp, built on a patch of grass and seen from above.
  portrait(look, { body = false, turn = body ? 0.45 : 0, top = 0, near = 1.05, aim = 0.16 * near, size = 96, held = false, pet = false, critter = null, stamp = null } = {}) {
    const aspect = body ? 0.6 : 1;
    const what = held ? look?.weapon : pet ? [look?.pet?.kind, look?.pet?.coat, look?.shirt] : critter || stamp ? [critter, stamp, this.world?.theme] : (look ?? {});
    const key = `${JSON.stringify([body, turn, top, near, aim, size, held, pet])}|${JSON.stringify(what)}`;
    let url = this.faces?.get(key);
    if (url) return url;
    this.faces ??= new Map();
    // Every pick in Change me makes a new set; keep only so many.
    if (this.faces.size > 600) this.faces.clear();
    const W = size;
    const H = Math.round(size / aspect);
    if (!this.faceKit) {
      const scene = new THREE.Scene();
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.position.set(1.5, 3, 4);
      scene.add(new THREE.HemisphereLight(0xdff2ff, 0x9fcf7f, 1.6), sun);
      this.faceKit = { scene, sun, camera: new THREE.PerspectiveCamera(30, 1, 0.05, 20), sizes: new Map() };
    }
    const { scene, sun, camera } = this.faceKit;
    let frame = this.faceKit.sizes.get(`${W}x${H}`);
    if (!frame) {
      const target = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
      target.texture.colorSpace = THREE.SRGBColorSpace;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      frame = { target, canvas, pixels: new Uint8Array(W * H * 4) };
      this.faceKit.sizes.set(`${W}x${H}`, frame);
    }
    const { target, canvas, pixels } = frame;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // The light turns with them, to light whichever side is seen.
    sun.position.set(1.5, 3, 4).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn > Math.PI / 2 ? Math.PI : 0);
    const a = held || pet || critter || stamp ? null : new Avatar(look);
    const animal = pet ? new PetModel(look.pet, shirtHex(look.shirt)) : null;
    const beast = critter ? new CritterModel(critter, 1, this.world?.theme) : null;
    const thing = held ? weapon(look.weapon) : (animal?.group ?? beast?.group ?? (stamp ? this.stampModel(stamp) : null));
    a?.update(0, ANIM.idle, 0);
    animal?.update(0, 'sit');
    beast?.update(0, 'idle', false);
    if (a) a.root.rotation.y = turn;
    scene.add(a?.root ?? thing);
    const head = headTop(look?.hat, lookHair(look), lookTall(look));
    if (thing) {
      // A weapon pointing up and to the right, turned a little to show its
      // sides; a pet turned as asked: framed to fit whatever its shape.
      if (held) thing.rotation.set(0.35, 0.5, -0.8);
      else thing.rotation.y = turn;
      // A critter's hidden parts (what it carries, a splash) left out.
      const box = critter || stamp ? shownBox(thing) : new THREE.Box3().setFromObject(thing);
      const mid = box.getCenter(new THREE.Vector3());
      const far = (box.getSize(new THREE.Vector3()).length() / 2 / Math.sin(THREE.MathUtils.degToRad(15))) * (stamp ? 0.78 : animal?.dog ? 0.68 : 0.82);
      camera.position.set(mid.x, mid.y + far * (stamp ? 0.55 : 0.15), mid.z + far);
      camera.lookAt(mid);
      camera.far = Math.max(20, far * 3);
      camera.updateProjectionMatrix();
    } else if (body) {
      // Framed from the feet to over the hat, seen a little from above.
      const high = Math.max(top, head) + 0.06;
      const far = (high / 2 / Math.tan(THREE.MathUtils.degToRad(15))) * 1.02;
      camera.position.set(0, high / 2 + far * 0.1, far);
      camera.lookAt(0, high / 2 - 0.01, 0);
    } else {
      // Framed from the chin to just over the hat, seen a little from above.
      const mid = head - aim;
      camera.position.set(0, mid + 0.06 * near, near);
      camera.lookAt(0, mid, 0);
    }
    const day = [toyLight.studio.value, toyLight.rim.value, toyLight.rimColor.value.clone()];
    toyLight.studio.value = 1;
    toyLight.rim.value = 0.25;
    toyLight.rimColor.value.set(1, 0.97, 0.9);
    const gl = this.gl;
    const was = { target: gl.getRenderTarget(), color: gl.getClearColor(new THREE.Color()), alpha: gl.getClearAlpha() };
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(scene, camera);
    gl.readRenderTargetPixels(target, 0, 0, W, H, pixels);
    gl.setRenderTarget(was.target);
    gl.setClearColor(was.color, was.alpha);
    [toyLight.studio.value, toyLight.rim.value] = day;
    toyLight.rimColor.value.copy(day[2]);
    a?.dispose();
    thing?.removeFromParent();
    animal?.dispose();
    beast?.dispose();
    if (stamp) this.faceKit.stamps?.clear();
    camera.far = 20;
    // Read back bottom row first: turned the right way up.
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) image.data.set(pixels.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    ctx.putImageData(image, 0, 0);
    url = canvas.toDataURL('image/png');
    this.faces.set(key, url);
    return url;
  }

  // A stamp's blocks as the island would draw them, standing on a patch of
  // grass with a little dirt under it, turned round the middle of the
  // patch: for portrait to take a picture of.
  stampModel(key) {
    const cells = stampByKey(key)?.cells;
    if (!cells?.length) return null;
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (const c of cells) for (let i = 0; i < 3; i++) [lo[i], hi[i]] = [Math.min(lo[i], c[i]), Math.max(hi[i], c[i])];
    const ground = 1 - Math.min(0, lo[1]);
    const W = hi[0] - lo[0] + 3;
    const D = hi[2] - lo[2] + 3;
    // Past its sides is air all the way down: no sea.
    const world = new World({ W, D, H: ground + hi[1] + 2, sea: -1, theme: this.world?.theme ?? 'sunny' });
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
      for (let y = 0; y < ground - 1; y++) world.set(x, y, z, DIRT);
      world.set(x, ground - 1, z, GRASS);
    }
    for (const [x, y, z, id] of cells) world.set(x - lo[0] + 1, y + ground, z - lo[2] + 1, id);
    this.faceKit.stamps ??= new Terrain(new THREE.Scene(), this.terrain.atlas);
    const t = this.faceKit.stamps;
    t.clear();
    t.world = world;
    t.light = new LightMap(world);
    t.light.computeAll();
    for (let cx = 0; cx < world.chunksX; cx++) for (let cz = 0; cz < world.chunksZ; cz++) t.dirty.add(`${cx},${cz}`);
    t.buildAll();
    t.setLighting({ daylight: 1, sun: new THREE.Color(1, 0.98, 0.94), ambient: new THREE.Color(0.32, 0.34, 0.4), fog: new THREE.Color(1, 1, 1), fogNear: 1e4, fogFar: 2e4, time: 0, nearFade: false });
    const pivot = new THREE.Group();
    t.group.position.set(-W / 2, 0, -D / 2);
    pivot.add(t.group);
    return pivot;
  }

  removeAvatar(pid) {
    const a = this.avatars.get(pid);
    if (!a) return;
    a.dispose();
    this.avatars.delete(pid);
  }

  addCritter(id, type) {
    this.removeCritter(id);
    const m = new CritterModel(type, id, this.world?.theme);
    this.entities.add(m.group, m.shadow);
    this.critters.set(id, m);
    return m;
  }

  removeCritter(id) {
    const m = this.critters.get(id);
    if (!m) return;
    m.dispose();
    this.critters.delete(id);
  }

  // A player's pet ({ kind, coat }), in a collar of this colour.
  addPet(pid, pet, collar) {
    this.removePet(pid);
    const m = new PetModel(pet, collar);
    this.entities.add(m.group, m.shadow);
    this.pets.set(pid, m);
    return m;
  }

  removePet(pid) {
    const m = this.pets.get(pid);
    if (!m) return;
    m.dispose();
    this.pets.delete(pid);
  }

  // Where a pet riding along sits on the animal or in the vehicle (a critter
  // model) its owner rides: { x, y, z, yaw }.
  petSeat(mount) {
    return petSeat(mount);
  }

  // kind: 'blob', 'big' or 'spiky', 'king' for King Grumble, 'mosquito' for
  // the giant mosquito, 'queen' for the Queen Mosquito, 'spider' for the
  // giant spider, 'mole' for Mr. Mole, 'snapper' for a Snappy Crab and
  // 'shroom' for a Puffshroom (isle-monsters.js), the other bosses'
  // (boss-models.js) and the beasts' (beasts.js).
  addMonster(id, kind = 'blob') {
    this.removeMonster(id);
    const m = kind === 'king' ? new KingModel(this.world?.theme, STOMP.reach) : isBoss(kind) ? makeBoss(kind, this.world?.theme) : isBeast(kind) ? makeBeast(kind, this.world?.theme) : kind === 'mosquito' ? new MosquitoModel(this.world?.theme, id) : kind === 'queen' ? new QueenMosquitoModel(this.world?.theme, id) : kind === 'spider' ? new SpiderModel(this.world?.theme, id) : kind === 'mole' ? new MoleModel(this.world?.theme, id) : kind === 'snapper' ? new SnapperModel(this.world?.theme, id) : kind === 'shroom' ? new ShroomModel(this.world?.theme, id) : new MonsterModel(this.world?.theme, kind, id);
    this.entities.add(m.group, m.shadow);
    this.monsters.set(id, m);
    return m;
  }

  removeMonster(id) {
    const m = this.monsters.get(id);
    if (!m) return;
    m.dispose();
    this.monsters.delete(id);
  }

  // A camp's flag pole (see adventure-models.js), by the camp's id.
  addFlag(id, kind) {
    this.removeFlag(id);
    const f = new FlagModel(kind);
    this.entities.add(f.group);
    this.flags.set(id, f);
    return f;
  }

  removeFlag(id) {
    this.flags.get(id)?.dispose();
    this.flags.delete(id);
  }

  clearFlags() {
    for (const id of [...this.flags.keys()]) this.removeFlag(id);
  }

  // Shakes the picture for a moment, by about this much (render/jolt.js).
  shake(amount) {
    this.jolted.shake(amount * this.joltScale);
  }

  // A blow landing, going the way (dx, dz) along the ground: the picture
  // kicked that way across the screen by kick (a share of its height) and down
  // by down, tipped by roll either way and pushed in by zoom.
  jolt(dx, dz, { kick = 0, down = 0, roll = 0, zoom = 0 } = {}) {
    const e = this.camera.matrixWorld.elements;
    const across = dx * e[0] + dz * e[2];
    const up = dx * e[4] + dz * e[6];
    const d = Math.hypot(across, up) || 1;
    const k = this.joltScale;
    this.jolted.hit({
      x: (across / d) * kick * k,
      y: (-(up / d) * kick + down) * k,
      roll: (Math.random() < 0.5 ? -roll : roll) * k,
      zoom: zoom * k,
    });
  }

  // King Grumble landing: a ring rushing out over the ground, as far as his stomp reaches.
  shockwave(x, y, z, reach = STOMP.reach) {
    this.shockwaves.push(new Shockwave(this.scene, x, y, z, reach));
  }

  // A boss's moves coming (boss-fx.js): a red ring as wide as r on the
  // ground at (x, y, z) for ms, where it will come down from a leap; a strip
  // from there the way yaw faces, d long and w wide, where it will charge;
  // and what it threw (what) flying from `from` to each of `to` in ms, with a
  // ring where each comes down, land(at) told as each lands.
  warnRing(x, y, z, r, ms) {
    this.bossFx.push(new WarnRing(this.scene, x, y, z, r, ms));
  }

  warnStrip(x, y, z, yaw, d, w, ms) {
    this.bossFx.push(new WarnStrip(this.scene, x, y, z, yaw, d, w, ms));
  }

  hurl(from, to, ms, r, what, land, sky = false) {
    // A bolt comes down out of the sky as it lands, on the ring it was aimed at.
    const strike = what === 'bolt' ? (at) => this.zapBolt([{ x: at[0], y: at[1] + 26, z: at[2] }, { x: at[0], y: at[1], z: at[2] }]) : null;
    this.bossFx.push(new Thrown(this.scene, this.effects, from, to, ms, r, what, (at) => {
      strike?.(at);
      land?.(at);
    }, sky));
  }

  // The shows of the mightiest toy weapons (weapon-fx.js): a bolt of lightning
  // through points, a rainbow beam, and a meteor falling from `from` to `to` in
  // ms, with a ring as wide as r where it will land.
  zapBolt(points, delay = 0) {
    this.bossFx.push(new ZapBolt(this.scene, points, delay));
  }

  rainbowBeam(from, to) {
    this.bossFx.push(new RainbowBeam(this.scene, from, to));
  }

  meteor(from, to, ms, r) {
    this.bossFx.push(new Meteor(this.scene, this.effects, from, to, ms, r));
  }

  // Where the ground is under something, for its round shadow.
  groundUnder(x, y, z) {
    const w = this.world;
    if (!w) return y;
    const gx = Math.floor(x);
    const gz = Math.floor(z);
    for (let yy = Math.floor(y + 0.1); yy >= Math.max(0, Math.floor(y) - 6); yy--) if (SOLID[w.get(gx, yy - 1, gz)]) return yy;
    return null;
  }

  placeShadow(shadow, x, y, z, scale = 1) {
    const g = this.groundUnder(x, y, z);
    if (g === null) {
      shadow.visible = false;
      return;
    }
    shadow.visible = true;
    const h = Math.max(0, y - g);
    shadow.position.set(x, g + 0.03, z);
    // The blob leans away from the sun, a little longer when the sun is low.
    const sun = this.env.sunDir;
    if (sun) shadow.rotation.z = Math.atan2(-sun.z, sun.x);
    const low = sun ? (1 - Math.min(1, Math.abs(sun.y))) * Math.min(1, Math.hypot(sun.x, sun.z) * 2) : 0;
    const fade = scale * Math.max(0.4, 1 - h * 0.18);
    shadow.scale.set(fade * (1 + 0.3 * low), fade, 1);
    shadow.material.opacity = 0.22 * this.blob * Math.max(0.2, 1 - h * 0.25) * (0.35 + 0.65 * (this.env.daylight ?? 1));
  }

  // ------------------------------------------------ camera

  orbit(dyaw, dpitch) {
    const v = this.view;
    v.goal = null;
    v.yaw += dyaw;
    // Free (watching unseen), it looks up from under things too.
    v.pitch = Math.min(this.free ? 1.55 : 1.35, Math.max(this.free ? -1.2 : -0.35, v.pitch + dpitch));
  }

  // Zooming all the way in looks out through your own eyes.
  zoom(factor) {
    const v = this.view;
    v.goal = null;
    // Free (watching unseen), it backs off far enough to see a whole island.
    v.dist = Math.min(this.free ? FREE_DIST : 18, Math.max(0.35, v.dist * factor));
  }

  // Which of VIEWS the camera is nearest to now, after any zooming and turning.
  get viewName() {
    const v = this.view.goal ?? this.view;
    if (v.dist <= 1.3) return 'eyes';
    if (v.dist >= 14 && v.pitch >= 1) return 'sky';
    return 'behind';
  }

  // Glides the camera to the next way of looking: from behind you, through
  // your own eyes, from high in the sky. Returns the one it goes to.
  nextView() {
    const names = Object.keys(VIEWS);
    return this.setView(names[(names.indexOf(this.viewName) + 1) % names.length]);
  }

  setView(name) {
    this.view.goal = { ...VIEWS[name] };
    return name;
  }

  // A picture of the island as it is now, without the buttons on top.
  photo() {
    const shown = [this.preview.visible, this.outline.visible];
    this.preview.visible = false;
    this.outline.visible = false;
    this.draw();
    // Read it back in the same task, before the frame is handed to the screen and cleared.
    const url = this.canvas.toDataURL('image/png');
    [this.preview.visible, this.outline.visible] = shown;
    return url;
  }

  // Follows the target, pulling in if a hill or a wall is in the way. Leaves
  // do not count: the camera slips inside a tree crown and sees through it.
  updateCamera(dt, target, collide = true) {
    const v = this.view;
    v.target.set(target.x, target.y + 1.25, target.z);
    if (!v.ready) {
      v.smooth.copy(v.target);
      v.ready = true;
      this.camDist = v.dist;
    }
    v.smooth.lerp(v.target, 1 - Math.exp(-dt * 12));
    if (v.goal) {
      const k = 1 - Math.exp(-dt * 6);
      v.dist += (v.goal.dist - v.dist) * k;
      v.pitch += (v.goal.pitch - v.pitch) * k;
      if (Math.abs(v.goal.dist - v.dist) < 0.02 && Math.abs(v.goal.pitch - v.pitch) < 0.005) {
        ({ dist: v.dist, pitch: v.pitch } = v.goal);
        v.goal = null;
      }
    }
    const dir = tmpV.set(Math.sin(v.yaw) * Math.cos(v.pitch), Math.sin(v.pitch), Math.cos(v.yaw) * Math.cos(v.pitch));
    // Shifts the subject sideways on screen (positive: to the right), to make room for a dialog.
    v.shiftNow = (v.shiftNow ?? 0) + ((v.shift ?? 0) - (v.shiftNow ?? 0)) * Math.min(1, dt * 5);
    if (Math.abs(v.shiftNow) > 1e-3) {
      v.smooth.x -= Math.cos(v.yaw) * v.shiftNow;
      v.smooth.z += Math.sin(v.yaw) * v.shiftNow;
    }
    let dist = v.dist;
    // Free (watching unseen), nothing comes between the camera and you.
    if (this.world && collide && !this.free) {
      const hit = raycast(this.world, v.smooth.x, v.smooth.y, v.smooth.z, dir.x, dir.y, dir.z, dist + 0.3, (id) => OPAQUE[id] === 1 && !TREE_PART[id]);
      if (hit) dist = Math.max(0.6, hit.dist - 0.3);
    }
    // Snap in at once (never show the inside of a wall), ease back out.
    this.camDist = dist < (this.camDist ?? dist) ? dist : this.camDist + (dist - this.camDist) * Math.min(1, dt * 3);
    this.camera.position.copy(v.smooth).addScaledVector(dir, this.camDist);
    this.camera.lookAt(v.smooth);
    // A blow landing, or the ground shaking under you (render/jolt.js).
    const jolt = this.jolted.update(dt);
    if (jolt.roll) this.camera.rotateZ(jolt.roll);
    if (Math.abs(v.shiftNow) > 1e-3) {
      v.smooth.x += Math.cos(v.yaw) * v.shiftNow;
      v.smooth.z -= Math.sin(v.yaw) * v.shiftNow;
    }
    // Lifts the picture by a share of the screen's height (positive: up), as a
    // shift lens does: the camera stays put, so the subject keeps its shape
    // and the ground never comes between them.
    v.liftNow = (v.liftNow ?? 0) + ((v.lift ?? 0) - (v.liftNow ?? 0)) * Math.min(1, dt * 5);
    const cam = this.camera;
    if (Math.abs(v.liftNow) > 1e-3 || jolt.moved) {
      const wide = cam.aspect;
      const seen = 1 / (1 + jolt.zoom);
      cam.setViewOffset(wide, 1, (wide * (1 - seen)) / 2 - jolt.shiftX, (1 - seen) / 2 - jolt.shiftY + v.liftNow, wide * seen, seen);
    } else if (cam.view?.enabled) cam.clearViewOffset();
    return this.camDist;
  }

  // Whether blocks right in front of the camera dissolve (render/terrain.js):
  // always, but looking through your own eyes.
  get nearFade() {
    return (this.camDist ?? 8) > 1.3;
  }

  // Whether what a ray from the camera meets dist along it is drawn mostly
  // see-through, being right in front of the camera: a tree crown the camera
  // slipped into, say. A tap goes through it, as the eye does.
  seeThrough(dist, dir) {
    if (!this.nearFade) return false;
    const ahead = this.camera.getWorldDirection(tmpV);
    return dist * (dir.x * ahead.x + dir.y * ahead.y + dir.z * ahead.z) < SEE_THROUGH;
  }

  // A pinch of fish food on the tank or bowl in cell (x, y, z): its flakes
  // come down and its fish dart over to them (render/terrain.js). Whether the
  // tank was found and fed.
  // Sparks fly up off the campfires near you, and a wisp of pale smoke.
  campfireSparks(dt, focus) {
    const fx = this.effects;
    for (const f of this.terrain.campfires.values()) {
      if (Math.hypot(f.x - focus.x, f.z - focus.z) > 40) continue;
      const x = f.x + 0.5;
      const z = f.z + 0.5;
      if (Math.random() < dt * 3) {
        fx.add('square', x + (Math.random() - 0.5) * 0.25, f.y + 0.5 + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.25, {
          vx: (Math.random() - 0.5) * 0.6,
          vy: 1.2 + Math.random() * 1.2,
          vz: (Math.random() - 0.5) * 0.6,
          size: 0.025 + Math.random() * 0.025,
          drag: 0.8,
          life: 0.7 + Math.random() * 0.7,
          color: ['#ffd27a', '#ff9a2e', '#ffef9a'][Math.floor(Math.random() * 3)],
        });
      }
      if (Math.random() < dt * 0.6) {
        fx.add('puff', x + (Math.random() - 0.5) * 0.2, f.y + 1.1, z + (Math.random() - 0.5) * 0.2, {
          vx: (Math.random() - 0.5) * 0.2,
          vy: 0.6 + Math.random() * 0.3,
          vz: (Math.random() - 0.5) * 0.2,
          size: 0.14 + Math.random() * 0.08,
          grow: 0.25,
          drag: 0.2,
          life: 1.6 + Math.random() * 0.8,
          color: ['#b8b3ae', '#c6c1bc', '#a8a39e'][Math.floor(Math.random() * 3)],
        });
      }
    }
  }

  // How far the nearest campfire is from (x, y, z), or Infinity.
  nearestCampfire(x, y, z) {
    let best = Infinity;
    for (const f of this.terrain.campfires.values()) best = Math.min(best, Math.hypot(f.x + 0.5 - x, f.y + 0.5 - y, f.z + 0.5 - z));
    return best;
  }

  feedFish(x, y, z) {
    return this.terrain.feedFish(x, y, z);
  }

  // The ray from the camera through a point on the screen (-1..1 each way).
  ray(ndcX, ndcY) {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(this.camera).sub(origin).normalize();
    return { origin, dir };
  }

  // The nearest animal the ray passes through, if any, and how far along
  // (but never the one numbered skip).
  pickCritter(ray, maxDist, skip = 0) {
    return this.pickFrom(this.critters, ray, maxDist, skip);
  }

  // ...and the nearest pet, by its owner (but never skip's).
  pickPet(ray, maxDist, skip = null) {
    return this.pickFrom(this.pets, ray, maxDist, skip);
  }

  // ...and the nearest monster.
  pickMonster(ray, maxDist) {
    return this.pickFrom(this.monsters, ray, maxDist);
  }

  // ...and the nearest of the players numbered in pids (a dizzy friend to help up).
  pickAvatar(ray, maxDist, pids) {
    const wanted = new Map();
    for (const pid of pids) {
      const a = this.avatars.get(pid);
      if (a) wanted.set(pid, { group: a.root, center: 0.6, pick: 0.7 });
    }
    return this.pickFrom(wanted, ray, maxDist);
  }

  pickFrom(models, ray, maxDist, skip = 0) {
    let best = null;
    for (const [id, m] of models) {
      if (id === skip) continue;
      const c = m.group.position;
      const cy = c.y + m.center;
      const r = m.pick;
      const ox = c.x - ray.origin.x;
      const oy = cy - ray.origin.y;
      const oz = c.z - ray.origin.z;
      const t = ox * ray.dir.x + oy * ray.dir.y + oz * ray.dir.z;
      if (t < 0 || t > maxDist) continue;
      const d2 = ox * ox + oy * oy + oz * oz - t * t;
      if (d2 > r * r) continue;
      if (!best || t < best.dist) best = { id, dist: t };
    }
    return best;
  }

  project(x, y, z) {
    const p = tmpV.set(x, y, z).project(this.camera);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h, visible: p.z < 1 && p.z > -1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2 };
  }

  // ------------------------------------------------ previews

  // cells: flat [x, y, z, id...]; mode 'add' shows see-through blocks, 'remove' outlines them.
  showPreview(cells, mode) {
    const n = Math.min(MAX_PREVIEW, cells ? cells.length / 4 : 0);
    const tint = this.atlas.studTint;
    for (let i = 0; i < n; i++) {
      const x = cells[i * 4];
      const y = cells[i * 4 + 1];
      const z = cells[i * 4 + 2];
      const id = cells[i * 4 + 3];
      tmpM.makeTranslation(x - 0.01, y - 0.01, z - 0.01);
      this.preview.setMatrixAt(i, tmpM);
      if (mode === 'remove') tmpC.setRGB(1, 0.35, 0.35);
      else if (mode === 'paint' || mode === 'add') tmpC.setRGB(tint[id * 3] / 255, tint[id * 3 + 1] / 255, tint[id * 3 + 2] / 255, THREE.SRGBColorSpace);
      else tmpC.setRGB(1, 1, 1);
      this.preview.setColorAt(i, tmpC);
    }
    this.preview.count = n;
    this.preview.instanceMatrix.needsUpdate = true;
    if (this.preview.instanceColor) this.preview.instanceColor.needsUpdate = true;
    this.previewMat.opacity = mode === 'remove' ? 0.3 : 0.5;
  }

  showOutline(cell) {
    if (!cell) {
      this.outline.visible = false;
      return;
    }
    this.outline.visible = true;
    this.outline.position.set(cell[0] - 0.015, cell[1] - 0.015, cell[2] - 0.015);
  }

  // ------------------------------------------------ each frame

  frame(dt, state) {
    this.time += dt;
    const env = environment(state.time, state.weather, this.world?.theme, this.env);
    this.snow = Math.min(1, Math.max(0, this.snow + dt * (state.weather === 'snow' ? SNOW_RATE : -MELT_RATE)));
    // A flash of lightning lights the sky and the island up white.
    const flash = this.sky.flash;
    if (flash) {
      env.top.lerp(FLASH, flash * 0.55);
      env.horizon.lerp(FLASH, flash * 0.65);
      env.fog.lerp(FLASH, flash * 0.45);
      env.daylight += (1 - env.daylight) * flash * 0.5;
      env.sun.lerp(FLASH, flash * 0.4);
    }
    const fogFar = this.free ? Math.max(this.fogFar ?? 150, FREE_FOG) : (this.fogFar ?? 150);
    this.terrain.setLighting({
      daylight: env.daylight,
      sun: env.sun,
      ambient: env.ambient,
      fog: env.fog,
      fogNear: fogFar * 0.45,
      fogFar,
      time: this.time,
      // Looking through your own eyes, nothing near should dissolve.
      nearFade: this.nearFade,
      shadowFocus: state.focus,
      shadowReach: SHADOW_EXTENT * 0.95,
      snow: this.snow,
    });
    this.sky.setWeather(state.weather);
    this.focus.x = state.focus.x;
    this.focus.y = state.focus.y;
    this.focus.z = state.focus.z;
    this.sky.update(dt, this.time, env, this.camera, this.focus);
    this.tornado.update(dt, this.time, state.tornado ?? null, env.day);
    this.scene.fog = null;

    // Lights for the players and animals follow the sun.
    this.sun.color.copy(env.sun);
    this.sun.intensity = 0.8 + 1.6 * env.day;
    this.aimSun(state.focus, env.day > 0.15 ? env.sunDir : env.moonDir);
    this.hemi.color.copy(env.top).lerp(tmpC.setRGB(1, 0.98, 0.94), 0.5);
    this.hemi.groundColor.setRGB(0.55, 0.62, 0.45).multiplyScalar(0.5 + 0.5 * env.day);
    this.hemi.intensity = 1.05 + 0.65 * env.day + 0.8 * flash;
    // The toys give back less of the studio's light at night, and the light
    // round their edges takes the sky's colour.
    toyLight.studio.value = 0.3 + 0.7 * env.day;
    toyLight.rim.value = 0.08 + 0.17 * env.day;
    toyLight.rimColor.value.copy(env.top).lerp(WHITE, 0.55);
    if (this.finish.shadows) {
      this.sweepIn -= dt;
      if (this.sweepIn <= 0) {
        this.sweepIn = 0.5;
        this.castShadows();
      }
    }
    // In focus: what the camera looks at (you), but everything when it looks
    // through your own eyes.
    if (this.focusPass) {
      const u = this.focusPass.uniforms;
      this.focusPass.enabled = this.nearFade;
      u.focus.value = this.camDist ?? 8;
      u.cameraNear.value = this.camera.near;
      u.cameraFar.value = this.camera.far;
      u.resolution.value.set(this.canvas.width, this.canvas.height);
      u.maxBlur.value = Math.min(8, Math.max(2.5, this.canvas.height * 0.005));
    }

    this.terrain.update(state.focus, 6);
    this.terrain.updateVisibility(this.camera.position, fogFar);
    this.terrain.animate(this.time, state.time, state.satIn);
    this.fires.update(dt, state.focus);
    this.campfireSparks(dt, state.focus);
    this.effects.update(dt);
    this.drawings.update();
    this.goBoards.update();
    this.robotKits.update(dt);
    this.shockwaves = this.shockwaves.filter((s) => s.update(dt));
    this.bossFx = this.bossFx.filter((f) => f.update(dt));
    const pulse = 0.55 + 0.35 * Math.sin(this.time * 6);
    this.outline.material.opacity = pulse;
    if (this.drawing) {
      this.draw();
    } else {
      // All that render() changes besides the picture.
      this.scene.updateMatrixWorld();
      this.camera.updateMatrixWorld();
    }
  }

  // The sun (or the moon) shines on what is round focus, from dir. With
  // shadows, its aim moves in whole texels of the shadow map, so the shadows
  // of things standing still hold still as you walk.
  aimSun(focus, dir) {
    const target = tmpV.copy(focus);
    const size = this.finish.shadows;
    if (size) {
      const texel = (2 * SHADOW_EXTENT) / size;
      // The shadow camera's own axes, as lookAt makes them.
      tmpZ.copy(dir).normalize();
      tmpX.crossVectors(UP, tmpZ);
      if (tmpX.lengthSq() < 1e-8) tmpX.set(1, 0, 0);
      tmpX.normalize();
      tmpY.crossVectors(tmpZ, tmpX);
      const x = target.dot(tmpX);
      const y = target.dot(tmpY);
      target.addScaledVector(tmpX, Math.round(x / texel) * texel - x).addScaledVector(tmpY, Math.round(y / texel) * texel - y);
    }
    this.sun.target.position.copy(target);
    this.sun.position.copy(target).addScaledVector(dir, 50);
  }

  dispose() {
    this.disposePost();
    this.studio.dispose();
    this.terrain.dispose();
    this.gl.dispose();
  }
}
