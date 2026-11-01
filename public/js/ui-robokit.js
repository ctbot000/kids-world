// A robot kit's window (shared/robokit.js), opened from ui.js: build a
// robot on the plate, program it with word blocks, and run it on the play
// mat. The robot and program go to the island as they change (game.js
// saveKit), so friends see the robot on its kit and can carry on with it.
import { h } from './ui.js';
import { RoboStage } from './render/robokit3d.js';
import {
  analyse,
  BRICK,
  CATEGORIES,
  cellsOf,
  cleanCode,
  cleanParts,
  COLORS,
  countBlocks,
  DEFAULT_BRICKS,
  DIRS,
  GO_DIRS,
  GO_NAMES,
  GRID,
  IMAGES,
  LAMP_COLORS,
  MAX_BLOCKS,
  MAX_BRICKS,
  MAX_PARTS,
  NOTES,
  noteName,
  OPS,
  PART_KEYS,
  PARTS,
  PORTS,
  problems,
  RobotSim,
  SEEN_COLORS,
  START,
  TEMPLATES,
} from './shared/robokit.js';

const IMAGE_ICONS = { happy: '🙂', sad: '🙁', heart: '❤️', star: '⭐', surprised: '😮', up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️', yes: '✔️', no: '✖️', square: '⬜' };
const COLOR_DOTS = { off: '⚫', white: '⚪', black: '⚫', red: '🔴', orange: '🟠', yellow: '🟡', green: '🟢', blue: '🔵', purple: '🟣' };
const TEST_NAMES = { near: '👀 distance closer than', far: '👀 distance farther than', color: '🔴 color sensor sees', pressed: '🔘 bumper is pressed' };

// The blocks in each category of the palette, as they come out of it.
const PALETTE = {
  motors: [{ op: 'run', dir: 1, sec: 1 }, { op: 'start', dir: 1 }, { op: 'stop' }, { op: 'speed', v: 75 }],
  move: [{ op: 'move', dir: 'fwd', cm: 10 }, { op: 'turn', dir: 'right', deg: 90 }, { op: 'go', dir: 'fwd' }, { op: 'halt' }, { op: 'mspeed', v: 50 }],
  light: [{ op: 'show', img: 'happy' }, { op: 'clear' }, { op: 'lamp', col: 'red' }],
  sound: [{ op: 'beep', note: 60, sec: 0.5 }, { op: 'beep', note: 67, sec: 0.25 }],
  control: [{ op: 'wait', sec: 1 }, { op: 'repeat', n: 4 }, { op: 'forever' }, { op: 'if', c: { s: 'near', cm: 10 } }, { op: 'ifelse', c: { s: 'color', col: 'black' } }, { op: 'until', c: { s: 'pressed' } }, { op: 'end' }],
  sensors: [{ op: 'if', c: { s: 'near', cm: 10 } }, { op: 'if', c: { s: 'far', cm: 30 } }, { op: 'ifelse', c: { s: 'color', col: 'black' } }, { op: 'until', c: { s: 'color', col: 'red' } }, { op: 'until', c: { s: 'pressed' } }],
};
// Which kind of part each block's port wants, to pick it by default.
const WANTS = { run: 'motor', start: 'motor', stop: 'motor', speed: 'motor', lamp: 'lamp', near: 'distance', far: 'distance', color: 'color', pressed: 'bumper' };

const clone = (o) => JSON.parse(JSON.stringify(o));

export function robotKitDialog(ui) {
  const g = ui.game;
  const at = g?.kitAt;
  if (!at) return;
  const start = g.kitOf(at);
  const st = {
    parts: clone(start.parts),
    code: clone(start.code),
    tab: ui.kitTab ?? 'build',
    tool: 'hub',
    selected: -1,
    // Where a block from the palette goes: a list in the program and the
    // place in it.
    cursor: null,
    picked: null,
    bricks: ui.kitBricks ?? clone(DEFAULT_BRICKS),
    brickMode: false,
    follow: false,
    sim: null,
    editedAt: 0,
    saveTimer: 0,
    raf: 0,
    sure: '',
  };
  if (!st.parts.length && !st.code.length) st.tool = 'hub';
  else st.tool = null;
  st.cursor = { list: st.code, index: st.code.length };

  // ---------------------------------------------------------- saving

  const changed = () => {
    st.editedAt = performance.now();
    clearTimeout(st.saveTimer);
    st.saveTimer = setTimeout(flush, 350);
  };
  const flush = () => {
    clearTimeout(st.saveTimer);
    st.saveTimer = 0;
    if (g.kitAt === at) g.saveKit({ parts: st.parts, code: st.code });
  };

  // ---------------------------------------------------------- the window

  const tabs = [
    ['build', '🔧 Build'],
    ['code', '🧩 Code'],
    ['play', '🏁 Play mat'],
  ].map(([key, label]) => h('button', { class: 'chip rk-tab', type: 'button', 'data-tab': key, 'aria-pressed': 'false', onclick: () => show(key) }, label));
  const runBtn = h('button', { class: 'big green rk-run', type: 'button', onclick: () => run() }, h('span', { class: 'emoji' }, '▶'), 'Run');
  const stopBtn = h('button', { class: 'big rk-stop', type: 'button', hidden: true, onclick: () => stopRun() }, h('span', { class: 'emoji' }, '⏹'), 'Stop');
  const outBtn = h('button', { class: 'chip rk-out', type: 'button', onclick: () => driveOut() }, '🏝️ Drive on the island');
  const homeBtn = h('button', { class: 'chip rk-home', type: 'button', hidden: true, onclick: () => {
    g.kitOut(false);
    ui.sound.play('ui');
  } }, '↩️ Call it back');
  // Whether this kit's robot is out on the island.
  const showOut = () => {
    homeBtn.hidden = !g.bots.has(at.key);
  };
  const canvas = h('canvas', { class: 'rk-canvas', role: 'img', 'aria-label': 'Your robot' });
  const stageBox = h('div', { class: 'rk-stage' }, canvas);
  const side = h('div', { class: 'rk-side' });
  const main = h('div', { class: 'rk-main' }, stageBox, side);
  const codeBox = h('div', { class: 'rk-code', hidden: true });
  let stage = null;
  try {
    stage = new RoboStage(canvas);
  } catch {
    stageBox.replaceChildren(h('p', { class: 'muted rk-no3d' }, '🙈 This device cannot show the robot in 3D — but you can still write its program in 🧩 Code.'));
  }

  const show = (key) => {
    st.tab = key;
    ui.kitTab = key;
    for (const t of tabs) {
      t.classList.toggle('on', t.dataset.tab === key);
      t.setAttribute('aria-pressed', String(t.dataset.tab === key));
    }
    main.hidden = key === 'code';
    codeBox.hidden = key !== 'code';
    stage?.setMode(key === 'play' ? 'run' : 'build');
    if (key === 'play') {
      ensureSim();
      stage?.placeRobot(st.sim);
    }
    if (key === 'build' && st.sim?.running) stopRun();
    render();
  };

  // ---------------------------------------------------------- building

  const info = () => analyse(st.parts);
  const occupied = () => {
    const taken = new Map();
    st.parts.forEach((p, i) => {
      for (const [x, z] of cellsOf(p)) taken.set(x * GRID + z, i);
    });
    return taken;
  };

  // A part put down at (x, z), facing the way that makes sense there.
  const place = (kind, x, z) => {
    if (st.parts.length >= MAX_PARTS) return ui.toast('🧰', `A robot has ${MAX_PARTS} parts at most.`);
    const taken = occupied();
    if (kind === 'hub') {
      if (st.parts.some((p) => p.k === 'hub')) return ui.toast('🟨', 'A robot has only one hub — tap it to pick it, or take it off first.');
      x = Math.min(x, GRID - 2);
      z = Math.min(z, GRID - 2);
    }
    const part = { k: kind, x, z, r: 0 };
    if (cellsOf(part).some(([cx, cz]) => taken.has(cx * GRID + cz))) return ui.sound.play('no');
    const hub = st.parts.find((p) => p.k === 'hub');
    if (kind === 'motor') part.r = x + 0.5 < (hub ? hub.x + 1 : GRID / 2) ? 3 : 1;
    else if (kind === 'wheel' || kind === 'propeller') {
      // Onto the axle of a motor beside it, if one points this way.
      const m = st.parts.find((p) => p.k === 'motor' && p.x + DIRS[p.r][0] === x && p.z + DIRS[p.r][1] === z);
      part.r = m ? m.r : x + 0.5 < GRID / 2 ? 3 : 1;
    } else if (PARTS[kind].turns) part.r = hub ? hub.r : 0;
    st.parts.push(part);
    st.selected = st.parts.length - 1;
    ui.sound.play('place');
    rebuild();
    changed();
  };

  const turn = (i) => {
    const p = st.parts[i];
    if (!p || !PARTS[p.k].turns) return;
    p.r = (p.r + 1) % 4;
    ui.sound.play('ui');
    rebuild();
    changed();
  };

  const remove = (i) => {
    if (!st.parts[i]) return;
    st.parts.splice(i, 1);
    st.selected = -1;
    ui.sound.play('pick');
    rebuild();
    changed();
  };

  const rebuild = () => {
    st.parts = cleanParts(st.parts);
    stage?.setParts(st.parts, st.tab === 'build' ? st.selected : -1);
    st.sim = null;
    stopBtn.hidden = true;
    runBtn.hidden = false;
    if (st.tab === 'play') {
      ensureSim();
      stage?.placeRobot(st.sim);
    }
    render();
  };

  // Taps on the 3D view: a part to pick it (again to turn it), a free stud
  // to put the part in hand there; on the mat, a brick put down or taken
  // away, or the robot moved there.
  let down = null;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || !stage) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const long = performance.now() - down.t;
    down = null;
    if (moved > 8 || long > 600) return;
    const hit = stage.pick(e.clientX, e.clientY);
    if (st.tab === 'build') {
      if (hit?.part !== undefined) {
        if (st.selected === hit.part && !st.tool) turn(hit.part);
        else {
          st.selected = hit.part;
          st.tool = null;
          ui.sound.play('ui');
          rebuild();
        }
      } else if (hit && st.tool) place(st.tool, hit.x, hit.z);
      else if (st.selected >= 0) {
        st.selected = -1;
        rebuild();
      }
    } else if (st.tab === 'play' && hit?.cx !== undefined) {
      if (st.brickMode) toggleBrick(hit.cx, hit.cz);
      else if (!st.sim?.running) {
        st.sim.reset({ x: hit.cx, z: hit.cz, a: st.sim.a });
        if (st.sim.hits(st.sim.x, st.sim.z, st.sim.a)) st.sim.reset();
        stage.placeRobot(st.sim);
        render();
      }
    }
  });

  const toggleBrick = (cx, cz) => {
    const i = Math.floor(cx / BRICK);
    const j = Math.floor(cz / BRICK);
    const k = st.bricks.findIndex(([a, b]) => a === i && b === j);
    if (k >= 0) st.bricks.splice(k, 1);
    else if (st.bricks.length >= MAX_BRICKS) return ui.toast('🧱', `${MAX_BRICKS} bricks at most on the mat.`);
    else {
      st.bricks.push([i, j]);
      // Not on top of the robot.
      if (st.sim && st.sim.hits(st.sim.x, st.sim.z, st.sim.a)) {
        st.bricks.pop();
        return ui.sound.play('no');
      }
    }
    ui.kitBricks = st.bricks;
    ui.sound.play('place');
    stage.setBricks(st.bricks);
    if (st.sim) st.sim.bricks = st.bricks;
  };

  // ---------------------------------------------------------- running

  const ensureSim = () => {
    if (st.sim) return st.sim;
    st.sim = new RobotSim(st.parts, st.bricks);
    if (st.sim.hits(st.sim.x, st.sim.z, st.sim.a)) {
      // The start blocked by a brick: clear the bricks there.
      st.bricks = st.bricks.filter((b) => {
        st.sim.bricks = [b];
        return !st.sim.hits(st.sim.x, st.sim.z, st.sim.a);
      });
      st.sim.bricks = st.bricks;
      ui.kitBricks = st.bricks;
    }
    stage?.setBricks(st.bricks);
    return st.sim;
  };

  const run = () => {
    ui.sound.unlock();
    if (!st.parts.some((p) => p.k === 'hub')) {
      ui.sound.play('no');
      return ui.toast('🟨', 'Build a robot with a hub first, in 🔧 Build!');
    }
    if (!st.code.length) {
      ui.sound.play('no');
      return ui.toast('🧩', 'Give your robot a program first, in 🧩 Code!');
    }
    flush();
    if (st.tab !== 'play') show('play');
    const sim = ensureSim();
    // The program itself, kept clean as it is edited, so the block running
    // is the one on the page that glows.
    sim.start(st.code);
    g.ranRobot();
    runBtn.hidden = true;
    stopBtn.hidden = false;
    ui.sound.play('ui');
    render();
  };

  // 🏝️ The robot drives out in front of its kit and runs its program on the
  // island itself, for everyone; the window closes to watch it go.
  const driveOut = () => {
    ui.sound.unlock();
    if (!st.parts.some((p) => p.k === 'hub') || !st.code.length) {
      ui.sound.play('no');
      return ui.toast('🤖', 'Build a robot with a hub and give it a program first!');
    }
    stopRun();
    flush();
    g.kitOut(true);
    ui.closeModal();
    ui.toast('🏝️', 'Off it goes! Walk up to the kit and tap ↩️ Call it back to bring it home.');
  };

  const stopRun = () => {
    st.sim?.stop();
    runBtn.hidden = false;
    stopBtn.hidden = true;
    renderCode();
    render();
  };

  // ---------------------------------------------------------- the side panel

  const partButtons = PART_KEYS.map((k) =>
    h(
      'button',
      { class: 'rk-part', type: 'button', 'data-part': k, title: PARTS[k].about, onclick: () => {
        st.tool = st.tool === k ? null : k;
        st.selected = -1;
        ui.sound.play('ui');
        rebuild();
      } },
      h('span', { class: 'emoji' }, PARTS[k].icon),
      h('span', { class: 'rk-part-name' }, PARTS[k].name),
    ),
  );

  const buildSide = () => {
    const out = [];
    out.push(h('p', { class: 'rk-hint' }, st.tool ? `Tap the plate to put a ${PARTS[st.tool].name.toLowerCase()} there.` : 'Pick a part, then tap the plate. Tap a part on the plate to pick it.'));
    for (const b of partButtons) b.classList.toggle('on', b.dataset.part === st.tool);
    out.push(h('div', { class: 'rk-parts', role: 'group', 'aria-label': 'Parts' }, ...partButtons));
    const p = st.parts[st.selected];
    if (p) {
      const i = info();
      const port = i.portOf.get(st.selected);
      out.push(
        h(
          'div',
          { class: 'rk-picked' },
          h('div', { class: 'rk-picked-name' }, `${PARTS[p.k].icon} ${PARTS[p.k].name}${port ? ` · port ${port}` : ''}`),
          h('div', { class: 'muted rk-about' }, PARTS[p.k].about),
          h(
            'div',
            { class: 'rk-picked-buttons' },
            PARTS[p.k].turns ? h('button', { class: 'chip', type: 'button', onclick: () => turn(st.selected) }, '↻ Turn') : null,
            h('button', { class: 'chip', type: 'button', onclick: () => remove(st.selected) }, '🗑️ Take off'),
          ),
        ),
      );
    }
    const issues = problems(st.parts);
    const i = info();
    const ports = Object.entries(i.ports).map(([letter, k]) => h('span', { class: 'rk-port' }, h('b', {}, letter), ` ${PARTS[st.parts[k].k].icon}`));
    out.push(h('div', { class: 'rk-status' + (issues.length ? ' warn' : '') }, issues.length ? issues[0] : '✅ Ready to program!', ports.length ? h('div', { class: 'rk-ports' }, ...ports) : null));
    out.push(
      h('h3', { class: 'rk-h3' }, '📦 Ready-made robots'),
      h(
        'div',
        { class: 'rk-templates' },
        ...TEMPLATES.map((t) =>
          h('button', { class: 'chip rk-template', type: 'button', 'data-template': t.key, title: t.about, onclick: (e) => useTemplate(t, e.currentTarget) }, st.sure === t.key ? '❓ Tap again to swap' : `${t.icon} ${t.name}`),
        ),
      ),
    );
    return out;
  };

  const useTemplate = (t) => {
    const mine = st.parts.length || st.code.length;
    if (mine && st.sure !== t.key) {
      st.sure = t.key;
      ui.sound.play('ui');
      render();
      return;
    }
    st.sure = '';
    st.parts = clone(t.parts);
    st.code = cleanCode(t.code);
    st.cursor = { list: st.code, index: st.code.length };
    st.selected = -1;
    st.tool = t.parts.length ? null : 'hub';
    ui.sound.play('collect');
    ui.toast(t.icon, `${t.name}: ${t.about}`);
    rebuild();
    renderCode();
    changed();
  };

  const matrixEl = h('div', { class: 'rk-matrix', 'aria-label': 'The hub\'s light matrix' }, ...Array.from({ length: 25 }, () => h('span', {})));
  const readEl = h('div', { class: 'rk-readings' });
  const doingEl = h('div', { class: 'rk-doing muted', 'aria-live': 'polite' });
  const playSide = () => [
    h('div', { class: 'rk-hub' }, h('div', { class: 'rk-hub-title' }, '🟨 Hub'), matrixEl, readEl, doingEl),
    h(
      'div',
      { class: 'rk-play-buttons' },
      h('button', { class: 'chip', type: 'button', onclick: () => {
        stopRun();
        st.sim?.reset();
        stage?.placeRobot(st.sim);
        render();
      } }, '↩️ Back to START'),
      h('button', { class: 'chip' + (st.brickMode ? ' on' : ''), type: 'button', 'aria-pressed': String(st.brickMode), onclick: () => {
        st.brickMode = !st.brickMode;
        render();
      } }, '🧱 Bricks'),
      h('button', { class: 'chip' + (st.follow ? ' on' : ''), type: 'button', 'aria-pressed': String(st.follow), onclick: () => {
        st.follow = !st.follow;
        render();
      } }, '🎥 Follow'),
    ),
    h('p', { class: 'rk-hint' }, st.brickMode ? 'Tap the mat to put a brick down, or tap one to take it away.' : 'Tap the mat to move the robot there. Drag to look round.'),
  ];

  const render = () => {
    side.replaceChildren(...(st.tab === 'play' ? playSide() : buildSide()));
    if (st.tab === 'play') readHub();
  };

  // What the hub shows and the ports read, while on the mat.
  let lastRead = '';
  const readHub = () => {
    const sim = st.sim;
    if (!sim) return;
    const matrix = sim.matrix;
    [...matrixEl.children].forEach((el, k) => el.classList.toggle('on', matrix[k] === '#'));
    const rows = sim.readings();
    const turned = Math.round((((sim.a - START.a) * 180) / Math.PI) % 360);
    const key = JSON.stringify(rows) + turned + (sim.doing ? describe(sim.doing) : '') + sim.running;
    if (key === lastRead) return;
    lastRead = key;
    readEl.replaceChildren(
      ...rows.map((r) => h('div', { class: 'rk-reading' }, h('b', {}, r.port), ` ${PARTS[r.kind].icon} ${PARTS[r.kind].name}`, h('span', {}, r.value))),
      h('div', { class: 'rk-reading' }, h('b', {}, '🧭'), ' Gyro', h('span', {}, `${turned}°`)),
    );
    doingEl.textContent = sim.running ? `▶ ${sim.doing ? describe(sim.doing) : '…'}` : st.sim.ended || !sim.program ? 'Ready — tap ▶ Run!' : '';
  };

  // ---------------------------------------------------------- the program

  const portOptions = (want) => {
    const i = info();
    return PORTS.map((p) => {
      const k = i.ports[p];
      const kind = k === undefined ? null : st.parts[k].k;
      return [p, `${p}${kind ? ` ${PARTS[kind].icon}` : ''}`, kind && want && kind !== want];
    });
  };
  // The port a new block uses: the first with the part it wants.
  const portFor = (want) => {
    const i = info();
    return PORTS.find((p) => i.ports[p] !== undefined && st.parts[i.ports[p]].k === want) ?? 'A';
  };

  const select = (value, options, onchange, label) => {
    const el = h('select', { class: 'rk-field', 'aria-label': label }, ...options.map(([v, text]) => h('option', { value: String(v) }, text)));
    el.value = String(value);
    el.addEventListener('change', () => onchange(el.value));
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    return el;
  };
  const number = (value, lo, hi, step, onchange, label) => {
    const el = h('input', { class: 'rk-field rk-num', type: 'number', min: lo, max: hi, step, value, inputmode: 'decimal', 'aria-label': label });
    el.addEventListener('change', () => {
      const v = Math.min(hi, Math.max(lo, Number(el.value) || lo));
      el.value = v;
      onchange(v);
    });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    return el;
  };

  // A block's words and fields, its fields changing the block itself.
  const fieldsOf = (b, live) => {
    const set = (k, cast = (v) => v) => (v) => {
      b[k] = cast(v);
      changed();
    };
    const P = () => select(b.p, portOptions(WANTS[b.op]), set('p'), 'Port');
    const dirMotor = () => select(b.dir, [[1, '↻ clockwise'], [-1, '↺ counter-clockwise']], set('dir', Number), 'Which way');
    switch (b.op) {
      case 'run':
        return ['⚙️ motor', P(), 'run', dirMotor(), 'for', number(b.sec, 0.1, 10, 0.1, set('sec'), 'Seconds'), 'seconds'];
      case 'start':
        return ['⚙️ motor', P(), 'start', dirMotor()];
      case 'stop':
        return ['⚙️ motor', P(), 'stop'];
      case 'speed':
        return ['⚙️ set motor', P(), 'speed to', number(b.v, 0, 100, 5, set('v'), 'Speed'), '%'];
      case 'move':
        return ['🚗 move', select(b.dir, [['fwd', 'forward'], ['back', 'back']], set('dir'), 'Which way'), 'for', number(b.cm, 1, 200, 1, set('cm'), 'Centimetres'), 'cm'];
      case 'turn':
        return ['🚗 turn', select(b.dir, [['right', 'right ↻'], ['left', 'left ↺']], set('dir'), 'Which way'), number(b.deg, 1, 720, 5, set('deg'), 'Degrees'), '°'];
      case 'go':
        return ['🚗 start moving', select(b.dir, GO_DIRS.map((d) => [d, GO_NAMES[d]]), set('dir'), 'Which way')];
      case 'halt':
        return ['🚗 stop moving'];
      case 'mspeed':
        return ['🚗 set movement speed to', number(b.v, 10, 100, 5, set('v'), 'Speed'), '%'];
      case 'show':
        return ['🟨 show', select(b.img, Object.keys(IMAGES).map((k) => [k, `${IMAGE_ICONS[k]} ${IMAGES[k].name}`]), set('img'), 'Picture'), 'on the light matrix'];
      case 'clear':
        return ['🟨 turn off the light matrix'];
      case 'lamp':
        return ['💡 set lamp', P(), 'to', select(b.col, LAMP_COLORS.map((c) => [c, `${COLOR_DOTS[c]} ${COLORS[c].name}`]), set('col'), 'Colour')];
      case 'beep':
        return ['🔊 beep', select(b.note, NOTES.map((n) => [n, `🎵 ${noteName(n)}`]), set('note', Number), 'Note'), 'for', number(b.sec, 0.1, 4, 0.1, set('sec'), 'Seconds'), 'seconds'];
      case 'wait':
        return ['⏱️ wait', number(b.sec, 0.1, 10, 0.1, set('sec'), 'Seconds'), 'seconds'];
      case 'repeat':
        return ['🔁 repeat', number(b.n, 1, 100, 1, set('n'), 'Times'), 'times'];
      case 'forever':
        return ['♾️ forever'];
      case 'if':
      case 'ifelse':
        return ['❓ if', testOf(b, live), 'then'];
      case 'until':
        return ['⏳ wait until', testOf(b, live)];
      case 'end':
        return ['⏹️ stop the program'];
    }
    return [];
  };

  // A sensor test, a pill of its own inside the block.
  const testOf = (b, live) => {
    const c = b.c;
    const pill = h('span', { class: 'rk-test' });
    const fill = () => {
      const set = (k, cast = (v) => v) => (v) => {
        c[k] = cast(v);
        changed();
      };
      const kind = select(c.s, Object.entries(TEST_NAMES), (v) => {
        b.c = { s: v, p: portFor(WANTS[v]), ...(v === 'color' ? { col: 'black' } : v === 'pressed' ? {} : { cm: 10 }) };
        changed();
        renderCode();
      }, 'Sensor');
      const port = select(c.p, portOptions(WANTS[c.s]), set('p'), 'Port');
      const parts = [kind, 'on', port];
      if (c.s === 'near' || c.s === 'far') parts.push(number(c.cm, 1, 200, 1, set('cm'), 'Centimetres'), 'cm');
      if (c.s === 'color') parts.push(select(c.col, SEEN_COLORS.map((k) => [k, `${COLOR_DOTS[k]} ${COLORS[k].name}`]), set('col'), 'Colour'));
      pill.replaceChildren(...parts);
    };
    if (live) fill();
    else pill.append(TEST_NAMES[c.s]);
    return pill;
  };

  // A block in words, for the hub to say what it is doing (worked out once
  // for each way a block is set).
  const said = new WeakMap();
  const describe = (b) => {
    const key = JSON.stringify(b);
    if (said.get(b)?.key === key) return said.get(b).text;
    const words = fieldsOf(clone(b), false).map((f) => (typeof f === 'string' ? f : f.tagName === 'SELECT' ? f.options[f.selectedIndex]?.textContent : f.tagName === 'INPUT' ? f.value : f.textContent));
    const text = words.join(' ').trim().replace(/\s+/g, ' ');
    said.set(b, { key, text });
    return text;
  };

  const blockEls = new Map();
  const programEl = h('div', { class: 'rk-program' });
  const blockBar = h('div', { class: 'rk-block-bar' });
  const countEl = h('span', { class: 'muted rk-count' });

  // A block on the page: its words and fields, and the blocks it holds.
  const blockEl = (b, list, live = true) => {
    const op = OPS[b.op];
    const el = h('div', { class: `rk-block cat-${op.cat}${op.holds ? ' holds' : ''}`, style: `--cat: ${CATEGORIES[op.cat].color}` });
    const head = h('div', { class: 'rk-block-head' }, ...fieldsOf(b, live).map((f) => (typeof f === 'string' ? h('span', { class: 'rk-word' }, f) : f)));
    el.append(head);
    if (live) {
      blockEls.set(b, el);
      el.blockRef = { b, list };
      head.addEventListener('click', (e) => {
        if (e.target.closest('select, input')) return;
        e.stopPropagation();
        st.picked = st.picked === b ? null : b;
        st.cursor = { list, index: list.indexOf(b) + 1 };
        ui.sound.play('ui');
        renderCode();
      });
      head.addEventListener('pointerdown', (e) => startDrag(e, { b, list }));
    }
    if (op.holds) {
      el.append(slotEl(b.do ?? (b.do = []), live));
      if (op.otherwise) el.append(h('div', { class: 'rk-block-head rk-else' }, h('span', { class: 'rk-word' }, 'else')), slotEl(b.else ?? (b.else = []), live));
      el.append(h('div', { class: 'rk-block-foot' }));
    }
    if (st.picked === b) el.classList.add('picked');
    return el;
  };

  // The blocks a loop or an if holds, with a gap to tap that puts the next
  // block from the palette inside.
  const slotEl = (list, live) => {
    const el = h('div', { class: 'rk-slot' });
    el.listRef = list;
    if (live) {
      list.forEach((b, i) => {
        if (st.cursor?.list === list && st.cursor.index === i) el.append(cursorEl());
        el.append(blockEl(b, list));
      });
      if (st.cursor?.list === list && st.cursor.index === list.length) el.append(cursorEl());
      el.addEventListener('click', (e) => {
        if (e.target !== el) return;
        e.stopPropagation();
        st.cursor = { list, index: list.length };
        st.picked = null;
        renderCode();
      });
    }
    return el;
  };
  const cursorEl = () => h('div', { class: 'rk-cursor', 'aria-hidden': 'true' });

  const renderCode = () => {
    blockEls.clear();
    const list = st.code;
    if (!st.cursor || !reachable(st.cursor.list)) st.cursor = { list, index: list.length };
    const top = slotEl(list, true);
    top.classList.add('rk-top');
    programEl.replaceChildren(h('div', { class: 'rk-block rk-hat cat-control', style: `--cat: ${CATEGORIES.control.color}` }, h('div', { class: 'rk-block-head' }, h('span', { class: 'rk-word' }, '▶ when program starts'))), top);
    countEl.textContent = `${countBlocks(st.code)} / ${MAX_BLOCKS} blocks`;
    const b = st.picked;
    blockBar.replaceChildren(
      ...(b
        ? [
            h('button', { class: 'chip', type: 'button', onclick: () => nudge(-1) }, '⬆️'),
            h('button', { class: 'chip', type: 'button', onclick: () => nudge(1) }, '⬇️'),
            h('button', { class: 'chip', type: 'button', onclick: () => duplicate() }, '📄 Copy'),
            h('button', { class: 'chip', type: 'button', onclick: () => deleteBlock(b) }, '🗑️ Delete'),
          ]
        : [h('span', { class: 'muted' }, 'Tap or drag a block in. Tap a block to pick it.')]),
    );
  };

  // Whether a list is still part of the program.
  const reachable = (list, within = st.code) => list === within || within.some((b) => (b.do && reachable(list, b.do)) || (b.else && reachable(list, b.else)));
  const parentList = (b, within = st.code) => {
    if (within.includes(b)) return within;
    for (const x of within) {
      const found = (x.do && parentList(b, x.do)) || (x.else && parentList(b, x.else));
      if (found) return found;
    }
    return null;
  };

  const insert = (raw, list, index) => {
    if (countBlocks(st.code) + countBlocks([raw]) > MAX_BLOCKS) {
      ui.sound.play('no');
      return ui.toast('🧩', `A program has ${MAX_BLOCKS} blocks at most.`);
    }
    list.splice(index, 0, raw);
    // A loop or an if takes the next blocks inside it.
    st.cursor = OPS[raw.op].holds ? { list: raw.do, index: 0 } : { list, index: index + 1 };
    st.picked = null;
    ui.sound.play('place');
    renderCode();
    changed();
  };

  const fresh = (tpl) => {
    const b = clone(tpl);
    if (WANTS[b.op]) b.p = portFor(WANTS[b.op]);
    if (b.c) b.c.p = portFor(WANTS[b.c.s]);
    const [clean] = cleanCode([b]);
    return clean;
  };

  const nudge = (d) => {
    const b = st.picked;
    const list = parentList(b);
    if (!list) return;
    const i = list.indexOf(b);
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    list.splice(i, 1);
    list.splice(j, 0, b);
    st.cursor = { list, index: j + 1 };
    renderCode();
    changed();
  };

  const duplicate = () => {
    const b = st.picked;
    const list = parentList(b);
    if (list) insert(clone(b), list, list.indexOf(b) + 1);
  };

  const deleteBlock = (b) => {
    const list = parentList(b);
    if (!list) return;
    const i = list.indexOf(b);
    list.splice(i, 1);
    st.picked = null;
    st.cursor = { list, index: i };
    ui.sound.play('pick');
    renderCode();
    changed();
  };

  // ---- dragging blocks in from the palette, about, and out to delete

  let drag = null;
  const startDrag = (e, from) => {
    if (e.target.closest('select, input')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, from, ghost: null, drop: null };
  };
  const dropPoints = () => {
    const out = [];
    for (const slot of programEl.querySelectorAll('.rk-slot')) {
      const list = slot.listRef;
      if (drag.from.b && (OPS[drag.from.b.op].holds && (list === drag.from.b.do || list === drag.from.b.else || reachable(list, drag.from.b.do ?? []) || reachable(list, drag.from.b.else ?? [])))) continue;
      const kids = [...slot.children].filter((c) => c.blockRef);
      const r = slot.getBoundingClientRect();
      kids.forEach((k, i) => out.push({ list, index: i, x: r.left, y: k.getBoundingClientRect().top }));
      out.push({ list, index: kids.length, x: r.left, y: kids.length ? kids.at(-1).getBoundingClientRect().bottom : r.top + 6 });
    }
    return out;
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.ghost) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
      const b = drag.from.b ?? drag.from.tpl;
      drag.ghost = blockEl(clone(b), [], false);
      drag.ghost.classList.add('rk-ghost');
      document.body.append(drag.ghost);
      if (drag.from.b) blockEls.get(drag.from.b)?.classList.add('rk-dragging');
    }
    e.preventDefault();
    drag.ghost.style.transform = `translate(${e.clientX + 8}px, ${e.clientY - 18}px)`;
    let best = null;
    let near = 90;
    for (const p of dropPoints()) {
      const d = Math.abs(p.y - e.clientY) + Math.max(0, p.x - e.clientX) * 0.5 + Math.abs(p.x - e.clientX) * 0.15;
      if (d < near) {
        near = d;
        best = p;
      }
    }
    drag.drop = best;
    programEl.querySelector('.rk-drop')?.remove();
    if (best) {
      const slot = [...programEl.querySelectorAll('.rk-slot')].find((s) => s.listRef === best.list);
      const kids = [...slot.children].filter((c) => c.blockRef);
      const mark = h('div', { class: 'rk-drop' });
      slot.insertBefore(mark, kids[best.index] ?? null);
    }
  };
  window.addEventListener('pointermove', onMove, { passive: false });
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    programEl.querySelector('.rk-drop')?.remove();
    if (!d.ghost) {
      if (d.from.tpl) insert(fresh(d.from.tpl), st.cursor.list, st.cursor.index);
      return;
    }
    d.ghost.remove();
    const overPalette = paletteEl.contains(document.elementFromPoint(e.clientX, e.clientY));
    if (d.from.b) {
      blockEls.get(d.from.b)?.classList.remove('rk-dragging');
      if (overPalette) return deleteBlock(d.from.b);
      if (!d.drop) return;
      const list = d.from.list;
      const i = list.indexOf(d.from.b);
      let index = d.drop.index;
      if (d.drop.list === list && i < index) index--;
      list.splice(i, 1);
      d.drop.list.splice(index, 0, d.from.b);
      st.cursor = { list: d.drop.list, index: index + 1 };
      ui.sound.play('place');
      renderCode();
      changed();
    } else if (d.drop) insert(fresh(d.from.tpl), d.drop.list, d.drop.index);
  };
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  // The palette: a category's blocks, to tap or drag in.
  const catTabs = Object.entries(CATEGORIES).map(([key, c]) =>
    h('button', { class: 'rk-cat', type: 'button', 'data-cat': key, style: `--cat: ${c.color}`, onclick: () => showCat(key) }, h('span', { class: 'rk-dot' }), c.name),
  );
  const paletteList = h('div', { class: 'rk-palette-list' });
  const paletteEl = h('div', { class: 'rk-palette' }, h('div', { class: 'rk-cats' }, ...catTabs), paletteList);
  const showCat = (key) => {
    ui.kitCat = key;
    for (const t of catTabs) t.classList.toggle('on', t.dataset.cat === key);
    paletteList.replaceChildren(
      ...PALETTE[key].map((tpl) => {
        const el = blockEl(fresh(tpl), [], false);
        el.classList.add('rk-from');
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.addEventListener('pointerdown', (e) => startDrag(e, { tpl }));
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') insert(fresh(tpl), st.cursor.list, st.cursor.index);
        });
        return el;
      }),
    );
  };
  showCat(ui.kitCat ?? 'move');
  programEl.addEventListener('click', (e) => {
    if (e.target === programEl) {
      st.cursor = { list: st.code, index: st.code.length };
      st.picked = null;
      renderCode();
    }
  });
  codeBox.append(paletteEl, h('div', { class: 'rk-script' }, h('div', { class: 'rk-script-top' }, blockBar, countEl), programEl));

  // ---------------------------------------------------------- the loop

  let last = performance.now();
  let acc = 0;
  let lastRunning = null;
  const frame = (now) => {
    st.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const sim = st.sim;
    if (sim?.running) {
      acc += dt;
      let n = 0;
      while (acc >= 1 / 60 && n++ < 6) {
        sim.step(1 / 60);
        acc -= 1 / 60;
      }
      for (const s of sim.sounds.splice(0)) ui.sound.beep?.(s.note, s.sec);
    } else acc = 0;
    if (lastRunning !== (sim?.doing ?? null)) {
      for (const el of programEl.querySelectorAll('.rk-block.running')) el.classList.remove('running');
      if (sim?.running && sim.doing) blockEls.get(sim.doing)?.classList.add('running');
      lastRunning = sim?.doing ?? null;
    }
    if (sim && !sim.running && !stopBtn.hidden) {
      stopBtn.hidden = true;
      runBtn.hidden = false;
      lastRunning = undefined;
    }
    if (st.tab === 'play') readHub();
    if (st.tab !== 'code') stage?.render(st.tab === 'play' ? sim : null, st.follow);
  };

  // A friend changed the robot or program here: theirs, unless you are
  // in the middle of changing it yourself.
  const heard = (e) => {
    if (e.detail !== at.key || performance.now() - st.editedAt < 2000 || drag) return;
    const kit = g.kitOf(at);
    st.parts = clone(kit.parts);
    st.code = clone(kit.code);
    st.picked = null;
    st.cursor = null;
    rebuild();
    renderCode();
  };
  g.addEventListener('kit', heard);
  g.addEventListener('bots', showOut);
  showOut();
  const panel = document.querySelector('#modal .panel');

  ui.openModal(
    (root) => {
      root.append(h('h2', {}, '🤖 Robot Kit'), h('div', { class: 'rk-bar' }, h('div', { class: 'rk-tabs' }, ...tabs), h('div', { class: 'rk-run-buttons' }, homeBtn, outBtn, runBtn, stopBtn)), main, codeBox);
      rebuild();
      renderCode();
      show(st.tab);
      st.raf = requestAnimationFrame(frame);
    },
    {
      fills: true,
      onClose: () => {
        cancelAnimationFrame(st.raf);
        if (st.saveTimer) flush();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        g.removeEventListener('kit', heard);
        g.removeEventListener('bots', showOut);
        panel?.classList.remove('rk-panel');
        stage?.dispose();
        g.closeKit();
      },
    },
  );
  panel?.classList.add('rk-panel');
  // From the top, whatever the window before it was scrolled to.
  if (panel) panel.scrollTop = 0;
}
