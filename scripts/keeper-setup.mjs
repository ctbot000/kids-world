// Makes this computer the keeper: creates its peer id and key pair in the
// data folder (once), and writes the public half to public/keeper.json, which
// the pages read to find the keeper and to check that it is the real one.
// Commit and deploy public/keeper.json afterwards; `npm start` then goes
// online as the keeper.
//
//   npm run keeper-setup                       # ~/.kids-world, or KIDS_WORLD_DATA
//   npm run keeper-setup -- --data <folder>
//   npm run keeper-setup -- --signal <url>     # a self-hosted PeerServer instead of the PeerJS cloud
//   npm run keeper-setup -- --new              # a new id and key; pages with the old file stop sending
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createIdentity, DEFAULT_DATA_DIR, loadIdentity, PUBLIC_CONFIG, publicConfig, readPublicConfig } from '../server/keeper.js';

const { values } = parseArgs({
  options: {
    data: { type: 'string', default: process.env.KIDS_WORLD_DATA ?? DEFAULT_DATA_DIR },
    signal: { type: 'string' },
    new: { type: 'boolean', default: false },
  },
});

if (values.signal) {
  const url = new URL(values.signal);
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) throw new Error('--signal must be an http(s) or ws(s) URL');
}

let identity = values.new ? null : await loadIdentity(values.data);
if (identity) console.log(`This computer is already the keeper ${identity.peer} (key in ${values.data}).`);
else {
  identity = await createIdentity(values.data);
  console.log(`This computer is now the keeper ${identity.peer}. Its private key is in ${values.data}/keeper.json: keep that file safe and private.`);
}

const signal = values.signal ?? (await readPublicConfig(PUBLIC_CONFIG))?.signal ?? null;
await writeFile(PUBLIC_CONFIG, `${JSON.stringify(publicConfig(identity, signal), null, 2)}\n`);
console.log('Wrote public/keeper.json. Commit and deploy it, then run `npm start` to go online as the keeper.');
