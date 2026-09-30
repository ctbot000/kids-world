// The dedicated server: static files (and nothing outside public/), the
// WebSocket handshake and framing, and islands shared by real WebSocket
// clients.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { request } from 'node:http';
import { connect } from 'node:net';
import { after, before, test } from 'node:test';
import * as B from '../public/js/shared/blocks.js';
import { PROTOCOL } from '../public/js/shared/room.js';
import { World } from '../public/js/shared/world.js';
import { applyCells } from '../public/js/shared/tools.js';
import { createGameServer } from '../server/server.js';

let server;
let port;

before(async () => {
  server = createGameServer({ log: () => {} });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  port = server.address().port;
});

after(async () => {
  await server.shutdown();
});

// A WebSocket client that keeps a copy of the world, like the browser does.
class Client {
  constructor() {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.inbox = [];
    this.waiters = [];
    this.world = null;
    this.closed = new Promise((done) => this.ws.addEventListener('close', done));
    this.opened = new Promise((done, fail) => {
      this.ws.addEventListener('open', done);
      this.ws.addEventListener('error', fail);
    });
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.t === 'welcome') {
        this.world = World.decode(msg.meta, msg.blocks);
        this.you = msg.you;
        this.token = msg.token;
        this.code = msg.code;
        this.host = msg.host;
      } else if (msg.t === 'edit' && this.world) {
        applyCells(this.world, msg.cells);
      }
      this.inbox.push(msg);
      for (const w of [...this.waiters]) w();
    });
  }

  send(msg) {
    this.ws.send(JSON.stringify(msg));
  }

  // Resolves with the first message (old or new) matching pred, and consumes it.
  next(pred, timeout = 3000) {
    return new Promise((done, fail) => {
      const check = () => {
        const index = this.inbox.findIndex(pred);
        if (index < 0) return false;
        const [msg] = this.inbox.splice(index, 1);
        this.waiters = this.waiters.filter((w) => w !== check);
        clearTimeout(timer);
        done(msg);
        return true;
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== check);
        fail(new Error(`timed out; inbox: ${this.inbox.map((m) => m.t).join(',')}`));
      }, timeout);
      if (!check()) this.waiters.push(check);
    });
  }

  close() {
    this.ws.close();
    return this.closed;
  }
}

async function create(name, extra = {}) {
  const c = new Client();
  await c.opened;
  c.send({ t: 'create', protocol: PROTOCOL, name, look: { animal: 'bear' }, theme: 'sunny', ...extra });
  await c.next((m) => m.t === 'welcome');
  return c;
}

async function join(code, name, extra = {}) {
  const c = new Client();
  await c.opened;
  c.send({ t: 'join', protocol: PROTOCOL, code, name, look: { animal: 'frog' }, ...extra });
  c.first = await c.next((m) => m.t === 'welcome' || m.t === 'error');
  return c;
}

const get = (path) => fetch(`http://127.0.0.1:${port}${path}`);

// fetch() normalises dot segments away; this sends the path exactly as written.
const statusOf = (path) =>
  new Promise((done, fail) => {
    request({ host: '127.0.0.1', port, path }, (res) => {
      res.resume();
      done(res.statusCode);
    })
      .on('error', fail)
      .end();
  });

test('serves the game and its info endpoint, and nothing outside public/', async () => {
  const info = await (await get('/api/info')).json();
  assert.equal(info.app, 'kids-world');
  assert.equal(info.protocol, PROTOCOL);
  const page = await get('/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<title>Kids World<\/title>/);
  const js = await get('/js/shared/blocks.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
  assert.equal(js.headers.get('cache-control'), 'no-store');
  const font = await get('/vendor/fonts/fredoka-latin-700-normal.woff2');
  assert.equal(font.headers.get('content-type'), 'font/woff2');
  assert.equal((await get('/nope.js')).status, 404);
  assert.equal(await statusOf('/%2e%2e%2fpackage.json'), 403);
  assert.equal(await statusOf('/..%2f..%2fpackage.json'), 403);
  assert.equal(await statusOf('/js/../../package.json'), 404);
});

test('two friends make and visit an island and build together', async () => {
  const a = await create('Happy Panda');
  assert.match(a.code, /^\d{6}$/);
  assert.equal(a.host, a.you);
  const b = await join(a.code, 'Brave Otter');
  assert.equal(b.first.t, 'welcome');
  assert.deepEqual(b.world.blocks, a.world.blocks);
  const arrived = await a.next((m) => m.t === 'joined');
  assert.equal(arrived.player.name, 'Brave Otter');

  // A block from one appears for the other.
  const s = a.world.spawn;
  const x = Math.floor(s.x) + 2;
  const z = Math.floor(s.z) + 2;
  const y = a.world.top(x, z) + 1;
  a.send({ t: 'edit', seq: 1, kind: 'build', cells: [x, y, z, B.TOY_BRICKS[4]] });
  await a.next((m) => m.t === 'ack' && m.seq === 1);
  await b.next((m) => m.t === 'edit');
  assert.equal(b.world.get(x, y, z), B.TOY_BRICKS[4]);

  // Talking and moving reach the other one.
  b.send({ t: 'say', p: 0 });
  assert.equal((await a.next((m) => m.t === 'say')).p, 0);
  b.send({ t: 'm', s: [s.x + 1, s.y, s.z, 0.5, 1, 0] });
  const moved = await a.next((m) => m.t === 'm');
  assert.equal(moved.p, b.you);
  // The animals are on the move.
  assert.ok((await b.next((m) => m.t === 'c', 2000)).c.length > 0);

  await a.close();
  await b.close();
});

test('a friend who drops can come back with their token', async () => {
  const a = await create('Happy Panda');
  const b = await join(a.code, 'Brave Otter');
  const { you, token } = b;
  await b.close();
  await a.next((m) => m.t === 'left' && m.pid === you);
  const again = await join(a.code, 'Brave Otter', { token });
  assert.equal(again.you, you);
  await again.close();
  await a.close();
});

test('the owner role passes on when the owner leaves', async () => {
  const a = await create('Happy Panda');
  const b = await join(a.code, 'Brave Otter');
  await a.close();
  const handed = await b.next((m) => m.t === 'host');
  assert.equal(handed.pid, b.you);
  await b.close();
});

test('visiting a code that does not exist is refused, kindly', async () => {
  const c = await join('000000', 'Happy Panda');
  assert.equal(c.first.t, 'error');
  assert.equal(c.first.code, 'missing');
  await c.closed;
});

test('an island file can be opened on the server', async () => {
  const a = await create('Happy Panda');
  const x = Math.floor(a.world.spawn.x);
  const z = Math.floor(a.world.spawn.z) + 3;
  const y = a.world.top(x, z) + 1;
  a.send({ t: 'edit', seq: 1, kind: 'build', cells: [x, y, z, B.LAMP] });
  await a.next((m) => m.t === 'ack');
  const room = server.rooms.get(a.code).room;
  const save = JSON.parse(JSON.stringify(room.exportSave()));
  const c = await create('Clever Fox', { save });
  assert.notEqual(c.code, a.code);
  assert.equal(c.world.get(x, y, z), B.LAMP);
  const broken = new Client();
  await broken.opened;
  broken.send({ t: 'create', protocol: PROTOCOL, name: 'Clever Fox', save: { app: 'nope' } });
  assert.equal((await broken.next((m) => m.t === 'error')).code, 'load');
  await a.close();
  await c.close();
});

// ---------------------------------------------------------------- raw frames

function rawSocket() {
  return new Promise((done) => {
    const socket = connect(port, '127.0.0.1', () => done(socket));
  });
}

function handshake(key = randomBytes(16).toString('base64')) {
  return [
    'GET /ws HTTP/1.1',
    `Host: 127.0.0.1:${port}`,
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Key: ${key}`,
    'Sec-WebSocket-Version: 13',
    '',
    '',
  ].join('\r\n');
}

function maskedFrame(text, { fin = true, opcode = 1, mask = true } = {}) {
  const payload = Buffer.from(text);
  const key = randomBytes(4);
  const header = [];
  header.push((fin ? 0x80 : 0) | opcode);
  if (payload.length < 126) header.push((mask ? 0x80 : 0) | payload.length);
  else header.push((mask ? 0x80 : 0) | 126, payload.length >> 8, payload.length & 255);
  const body = Buffer.from(payload);
  if (mask) for (let i = 0; i < body.length; i++) body[i] ^= key[i & 3];
  return Buffer.concat([Buffer.from(header), mask ? key : Buffer.alloc(0), body]);
}

function readAll(socket, until, timeout = 3000) {
  return new Promise((done, fail) => {
    let data = Buffer.alloc(0);
    const timer = setTimeout(() => fail(new Error(`timed out with ${data.length} bytes`)), timeout);
    const onData = (chunk) => {
      data = Buffer.concat([data, chunk]);
      if (until(data)) {
        clearTimeout(timer);
        socket.off('data', onData);
        done(data);
      }
    };
    socket.on('data', onData);
  });
}

test('frames sent in the same packet as the handshake are not lost', async () => {
  const socket = await rawSocket();
  const hello = JSON.stringify({ t: 'ping' });
  socket.write(Buffer.concat([Buffer.from(handshake()), maskedFrame(hello)]));
  const data = await readAll(socket, (d) => d.includes('pong'));
  assert.match(data.toString('latin1'), /101 Switching Protocols/);
  socket.destroy();
});

test('fragmented messages are reassembled, unmasked frames are rejected', async () => {
  const socket = await rawSocket();
  socket.write(handshake());
  await readAll(socket, (d) => d.includes('\r\n\r\n'));
  const text = JSON.stringify({ t: 'ping' });
  socket.write(maskedFrame(text.slice(0, 4), { fin: false }));
  socket.write(maskedFrame(text.slice(4), { fin: true, opcode: 0 }));
  await readAll(socket, (d) => d.includes('pong'));
  socket.write(maskedFrame(text, { mask: false }));
  const closing = await readAll(socket, (d) => d.length >= 4 && d[0] === 0x88);
  assert.equal(closing.readUInt16BE(2), 1002);
  socket.destroy();
});

test('a malformed handshake gets a 400', async () => {
  const socket = await rawSocket();
  socket.write(handshake().replace('Sec-WebSocket-Version: 13', 'Sec-WebSocket-Version: 8'));
  const data = await readAll(socket, (d) => d.includes('\r\n\r\n'));
  assert.match(data.toString(), /400 Bad Request/);
  socket.destroy();
});
