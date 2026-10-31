// Copies the browser libraries the game uses from node_modules into
// public/vendor/, so the site needs no build step and no third-party CDN.
// Run after upgrading a package: npm run vendor
//
// three.js ships its ESM build as two files, three.module.js importing
// ./three.core.js, so both are copied (and minified) under the same names.
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { minify } from 'terser';

const modules = new URL('../node_modules/', import.meta.url);
const vendor = new URL('../public/vendor/', import.meta.url);

async function version(pkg) {
  return JSON.parse(await readFile(new URL(`${pkg}/package.json`, modules), 'utf8')).version;
}

async function read(pkg, file) {
  const source = await readFile(new URL(`${pkg}/${file}`, modules), 'utf8');
  // Source maps are not copied, so drop the comments that point at them.
  return source.replace(/^\/\/# sourceMappingURL=.*$/gm, '').trimEnd();
}

await mkdir(new URL('fonts/', vendor), { recursive: true });

const threeVersion = await version('three');
for (const name of ['three.core.js', 'three.module.js']) {
  const source = await read('three', `build/${name}`);
  const result = await minify(source, { module: true, compress: { passes: 2 }, mangle: true, format: { comments: false } });
  const banner = `/*! three.js r${threeVersion.split('.')[1]} | MIT License | https://threejs.org */\n`;
  await writeFile(new URL(name, vendor), `${banner}${result.code}\n`);
  console.log(`vendored three@${threeVersion} -> public/vendor/${name} (${Math.round(result.code.length / 1024)} KB)`);
}

// three.js's add-ons the renderer uses (the picture's finishing passes and the
// studio light glossy toys reflect), with every file they import, under
// three-addons/ as in examples/jsm/ (and nothing else: the folder is made
// afresh). Each import of 'three' is pointed at the vendored build, so add-ons
// and game share one copy of three.
const ADDONS = ['postprocessing/GTAOPass.js', 'postprocessing/ShaderPass.js', 'postprocessing/OutputPass.js', 'postprocessing/FXAAPass.js', 'environments/RoomEnvironment.js', 'geometries/RoundedBoxGeometry.js', 'utils/BufferGeometryUtils.js'];
const addons = new URL('three-addons/', vendor);
await rm(addons, { recursive: true, force: true });
const queue = [...ADDONS];
const done = new Set();
while (queue.length) {
  const file = queue.shift();
  if (done.has(file)) continue;
  done.add(file);
  let source = await read('three', `examples/jsm/${file}`);
  for (const [, spec] of source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) queue.push(new URL(spec, `file:///${file}`).pathname.slice(1));
  source = source.replace(/from\s+['"]three['"]/g, `from '${'../'.repeat(file.split('/').length)}three.module.js'`);
  const result = await minify(source, { module: true, compress: { passes: 2 }, mangle: true, format: { comments: false } });
  const out = new URL(file, addons);
  await mkdir(new URL('.', out), { recursive: true });
  await writeFile(out, `/*! three.js r${threeVersion.split('.')[1]} add-on | MIT License | https://threejs.org */\n${result.code}\n`);
}
console.log(`vendored ${done.size} three.js add-ons -> public/vendor/three-addons/`);

const peerVersion = await version('peerjs');
const peer = await read('peerjs', 'dist/peerjs.min.js');
await writeFile(new URL('peerjs.min.js', vendor), `/*! PeerJS ${peerVersion} | MIT License | https://github.com/peers/peerjs */\n${peer}\n`);
console.log(`vendored peerjs@${peerVersion} -> public/vendor/peerjs.min.js`);

const chartVersion = await version('chart.js');
const chart = await read('chart.js', 'dist/chart.umd.min.js');
await writeFile(new URL('chart.umd.min.js', vendor), `${chart}\n`);
console.log(`vendored chart.js@${chartVersion} -> public/vendor/chart.umd.min.js`);

const fontVersion = await version('@fontsource/fredoka');
for (const weight of [500, 700]) {
  const file = `fredoka-latin-${weight}-normal.woff2`;
  await copyFile(new URL(`@fontsource/fredoka/files/${file}`, modules), new URL(`fonts/${file}`, vendor));
}
await copyFile(new URL('@fontsource/fredoka/LICENSE', modules), new URL('fonts/OFL.txt', vendor));
console.log(`vendored @fontsource/fredoka@${fontVersion} -> public/vendor/fonts/`);

const idbVersion = await version('idb-keyval');
const idb = await read('idb-keyval', 'dist/index.js');
const idbMin = await minify(idb, { module: true, compress: { passes: 2 }, mangle: true, format: { comments: false } });
await writeFile(new URL('idb-keyval.js', vendor), `/*! idb-keyval ${idbVersion} | Apache-2.0 License | https://github.com/jakearchibald/idb-keyval */\n${idbMin.code}\n`);
console.log(`vendored idb-keyval@${idbVersion} -> public/vendor/idb-keyval.js`);

// Pictures of the whole screen, buttons and all, for problem reports (report.js).
const shotVersion = await version('modern-screenshot');
const shot = await read('modern-screenshot', 'dist/index.mjs');
const shotMin = await minify(shot, { module: true, compress: { passes: 2 }, mangle: true, format: { comments: false } });
await writeFile(new URL('modern-screenshot.js', vendor), `/*! modern-screenshot ${shotVersion} | MIT License | https://github.com/qq15725/modern-screenshot */\n${shotMin.code}\n`);
console.log(`vendored modern-screenshot@${shotVersion} -> public/vendor/modern-screenshot.js`);
