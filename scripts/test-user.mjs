// Makes a test player at the keeper: a login whose coins never run out (its
// pages keep them topped up, see profile.js), left out of the ranking. Log in
// with it on the title screen to try the shop, gashapons and the rest
// without earning coins first. Run again for the same username to give it a
// new password; the admin pages' Unlimited coins button turns any player
// into one, or back.
//
//   npm run test-user                          # "tester", ~/.kids-world or KIDS_WORLD_DATA
//   npm run test-user -- --username <name> --password <password> --data <folder>
//
// With no --password a new one is made. Either way it is written to
// <data>/test-user.json (only this computer's user can read it), never here.
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_DATA_DIR, KeeperStore } from '../server/keeper.js';
import { usernameKey } from '../public/js/shared/keeper.js';

const { values } = parseArgs({
  options: {
    data: { type: 'string', default: process.env.KIDS_WORLD_DATA ?? DEFAULT_DATA_DIR },
    username: { type: 'string', default: 'tester' },
    password: { type: 'string' },
  },
});

const store = await new KeeperStore(values.data).open();
const password = values.password ?? randomBytes(9).toString('base64url');
const old = (await store.logins()).find((l) => usernameKey(l.login.username) === usernameKey(values.username));
const device = old?.device ?? randomBytes(10).toString('hex');
const { username } = await store.makeLogin(device, password, null, { session: false, username: values.username });
await store.setUnlimited(device, true);
await store.setRanked(device, false);
const file = join(values.data, 'test-user.json');
await writeFile(file, `${JSON.stringify({ username, password, player: device }, null, 2)}\n`, { mode: 0o600 });
console.log(`${old ? 'Updated' : 'Made'} the test player "${username}" (unlimited coins, not ranked). Its password is in ${file}.`);
