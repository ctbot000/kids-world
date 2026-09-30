// Copies the browser libraries the game uses from node_modules into
// public/vendor/, so the site needs no build step and no third-party CDN.
// Run after upgrading a package: npm run vendor
//
// three.js ships its ESM build as two files, three.module.js importing
// ./three.core.js, so both are copied (and minified) under the same names.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
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

const peerVersion = await version('peerjs');
const peer = await read('peerjs', 'dist/peerjs.min.js');
await writeFile(new URL('peerjs.min.js', vendor), `/*! PeerJS ${peerVersion} | MIT License | https://github.com/peers/peerjs */\n${peer}\n`);
console.log(`vendored peerjs@${peerVersion} -> public/vendor/peerjs.min.js`);

const fontVersion = await version('@fontsource/fredoka');
for (const weight of [500, 700]) {
  const file = `fredoka-latin-${weight}-normal.woff2`;
  await copyFile(new URL(`@fontsource/fredoka/files/${file}`, modules), new URL(`fonts/${file}`, vendor));
}
await copyFile(new URL('@fontsource/fredoka/LICENSE', modules), new URL('fonts/OFL.txt', vendor));
console.log(`vendored @fontsource/fredoka@${fontVersion} -> public/vendor/fonts/`);
