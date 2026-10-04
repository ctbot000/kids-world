// Dedicated server: serves the game from public/ (with serve-static) and hosts
// islands over WebSocket (with ws), so nobody's browser has to stay open as
// the host. The keeper's WebRTC module is loaded only when it starts.
// Started from the command line, it is also the keeper (see keeper.js) once
// that is set up, with its admin pages at /admin/. Usage:
//   npm start                        # http://localhost:8747/
//   npm start -- --host 0.0.0.0      # also reachable from other devices on the LAN
//   npm start -- --port 8080         # or PORT=8080 npm start
//   npm start -- --data ~/kw-copies  # where the keeper keeps copies (or KIDS_WORLD_DATA)
import { createServer, STATUS_CODES } from 'node:http';
import { networkInterfaces } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import serveStatic from 'serve-static';
import { generateCode, isValidCode, normalizeCode } from '../public/js/shared/codes.js';
import { sortListings } from '../public/js/shared/listing.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { SIZES, THEMES } from '../public/js/shared/worldgen.js';
import { adminHandler } from './admin.js';
import { DEFAULT_DATA_DIR, Keeper, KeeperStore, loadIdentity, PUBLIC_CONFIG, readPublicConfig, sameKeeper } from './keeper.js';
import { WebSocketServer } from 'ws';

export const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const JSON_TYPE = 'application/json; charset=utf-8';
const TEXT_TYPE = 'text/plain; charset=utf-8';

const HEARTBEAT_MS = 20000;
const TICK_MS = 100;
// A bigger message closes the connection (1009); a whole island is far smaller.
const MAX_MESSAGE = 4 * 1024 * 1024;

export function createGameServer({
  root = PUBLIC_DIR,
  log = (error) => console.error(error),
  maxRooms = 200,
  maxConnections = 1600,
  // How long an island with nobody on it is kept, so friends can come back.
  idleMs = 2 * 60 * 60 * 1000,
  // What pages get at /keeper.json: the keeper this server runs, or none.
  keeperConfig = null,
  // The admin pages' handler, from adminHandler().
  admin = null,
} = {}) {
  // The files in public/, never cached, so a restart serves new code at once.
  // Paths that climb out of it get 403; dotfiles, like missing files, 404.
  const serve = serveStatic(root, {
    fallthrough: false,
    cacheControl: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  });
  const rooms = new Map();
  const sockets = new Set();
  // Its `clients` are the open connections.
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE });

  async function serveFile(req, res) {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }
    if (admin && (await admin(req, res, pathname))) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    // Pages find the keeper here. This server answers for itself, never with
    // public/keeper.json, so a test run or someone else's server never sends
    // copies to the keeper that file names.
    if (pathname === '/keeper.json') {
      const body = keeperConfig ? JSON.stringify(keeperConfig) : null;
      if (body) res.writeHead(200, { 'Content-Type': JSON_TYPE, 'Cache-Control': 'no-store' }).end(body);
      else res.writeHead(404, { 'Content-Type': TEXT_TYPE, 'Cache-Control': 'no-store' }).end('No keeper here');
      return;
    }
    if (pathname === '/api/info') {
      const body = JSON.stringify({ app: 'kids-world', mode: 'server', protocol: PROTOCOL, islands: rooms.size });
      res.writeHead(200, { 'Content-Type': JSON_TYPE, 'Cache-Control': 'no-store' }).end(body);
      return;
    }
    // The list of open islands here (see shared/listing.js): those with
    // someone on them, and not closed to new visitors.
    if (pathname === '/api/islands') {
      const open = [...rooms.values()].map((entry) => (entry.room.online > 0 ? entry.room.listing() : null)).filter(Boolean);
      const body = JSON.stringify({ islands: sortListings(open) });
      res.writeHead(200, { 'Content-Type': JSON_TYPE, 'Cache-Control': 'no-store' }).end(body);
      return;
    }
    // Answered by serve-static, or here with the status it gives up with.
    serve(req, res, (error) => {
      const status = error?.statusCode ?? 404;
      if (status >= 500) log(error);
      if (res.headersSent) res.destroy();
      else if (status >= 500) res.writeHead(500).end('Internal error');
      else res.writeHead(status, { 'Content-Type': TEXT_TYPE, 'Cache-Control': 'no-store' }).end(STATUS_CODES[status]);
    });
  }

  const server = createServer((req, res) => {
    serveFile(req, res).catch((error) => {
      log(error);
      if (res.headersSent) res.destroy();
      else res.writeHead(500).end('Internal error');
    });
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  server.on('upgrade', (req, socket, head) => {
    // A path URL cannot parse (`//[`) would throw here and end the process.
    const path = URL.parse(req.url, 'http://localhost')?.pathname ?? '';
    if (!path.endsWith('/ws') || wss.clients.size >= maxConnections) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    // ws answers a malformed handshake itself, and keeps the frames in `head`.
    wss.handleUpgrade(req, socket, head, accept);
  });

  function uniqueCode() {
    for (;;) {
      const code = generateCode();
      if (!rooms.has(code)) return code;
    }
  }

  function accept(ws) {
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
    // A bad frame (unmasked, too big, not UTF-8) closes the connection, and ws
    // reports it here too; with no listener, it would end the process.
    ws.on('error', () => {});
    let entry = null;
    const conn = {
      send: (text) => ws.send(text),
      close: () => ws.close(1000),
    };
    const reply = (msg) => ws.send(JSON.stringify(msg));
    ws.on('message', (data, isBinary) => {
      ws.isAlive = true;
      if (isBinary) {
        ws.close(1003, 'Binary messages are not supported');
        return;
      }
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      if (entry) {
        entry.room.receive(conn, msg);
        return;
      }
      if (msg.t === 'ping') {
        reply({ t: 'pong' });
        return;
      }
      if (msg.t === 'create') {
        if (rooms.size >= maxRooms) {
          reply({ t: 'error', code: 'busy', text: 'This server has lots of islands right now. Try again later!' });
          ws.close(1013);
          return;
        }
        const code = uniqueCode();
        let room;
        try {
          room = msg.save
            ? new Room({ code, save: msg.save, log })
            : new Room({ code, theme: THEMES.some((t) => t.key === msg.theme) ? msg.theme : 'sunny', size: SIZES.some((s) => s.key === msg.size) ? msg.size : 'small', name: msg.name, settings: msg.settings, log });
        } catch (error) {
          reply({ t: 'error', code: 'load', text: `That island could not be opened: ${error.message}` });
          ws.close(1000);
          return;
        }
        entry = { room, emptySince: 0 };
        rooms.set(code, entry);
      } else if (msg.t === 'join') {
        const code = normalizeCode(msg.code);
        entry = isValidCode(code) ? (rooms.get(code) ?? null) : null;
        if (!entry) {
          reply({ t: 'error', code: 'missing', text: `There is no island with the code ${code || '(blank)'} here.` });
          ws.close(1000);
          return;
        }
      } else {
        return;
      }
      entry.room.attach(conn);
      entry.room.receive(conn, { ...msg, t: 'join' });
    });
    ws.on('close', () => entry?.room.detach(conn));
  }

  let beat = 0;
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [code, entry] of rooms) {
      if (entry.room.online > 0) {
        entry.room.tick();
        entry.emptySince = 0;
        continue;
      }
      entry.emptySince ||= now;
      if (now - entry.emptySince > idleMs) {
        entry.room.close();
        rooms.delete(code);
      }
    }
    if (++beat % Math.round(HEARTBEAT_MS / TICK_MS) === 0) {
      for (const ws of wss.clients) {
        if (!ws.isAlive) {
          ws.terminate();
        } else {
          ws.isAlive = false;
          ws.ping();
        }
      }
    }
  }, TICK_MS);
  timer.unref();

  server.rooms = rooms;
  server.shutdown = () =>
    new Promise((done) => {
      clearInterval(timer);
      for (const entry of rooms.values()) entry.room.close();
      rooms.clear();
      server.close(() => done());
      for (const socket of sockets) socket.destroy();
    });
  return server;
}

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => net.address);
}

// The keeper, if this computer holds the key that public/keeper.json names.
// Returns { keeper, config } or null.
async function startKeeper(store) {
  const identity = await loadIdentity(store.dir);
  const config = await readPublicConfig(PUBLIC_CONFIG);
  if (!identity) {
    console.log('Keeper: not set up on this computer. Run `npm run keeper-setup` to make it the keeper.');
    return null;
  }
  if (!sameKeeper(config, identity)) {
    console.log(`Keeper: public/keeper.json names another keeper than the one in ${store.dir}.`);
    console.log('  Run `npm run keeper-setup` to write this one into it, then commit and deploy it.');
    return null;
  }
  const keeper = new Keeper({ store, identity, signal: config.signal ?? null });
  keeper.on('state', (state, detail) => console.log(`Keeper: ${state}${detail ? ` (${detail})` : ''}`));
  const said = {
    island: (e, who) => `kept the island "${e.island}"${who ? ` from ${who}` : ''}`,
    profile: (e, who) => `kept a profile${who ? ` from ${who}` : ''}`,
    login: (e, who) => `logged ${e.username || who || 'a player'} in on a device`,
    'made-login': (e, who) => `made the login ${e.username || ''} for ${who || 'a player'}`,
    'new-password': (e, who) => `gave ${who || 'a player'} a new password`,
    adopt: (e, who) => `moved ${e.islands ? (e.islands === 1 ? 'an island' : `${e.islands} islands`) : 'what a device did'} from before into ${who || 'a player'}'s login`,
  };
  keeper.on('kept', (e) => console.log(`Keeper: ${(said[e.what] ?? said.profile)(e, e.player)}`));
  try {
    await keeper.start();
  } catch (error) {
    console.log(`Keeper: could not start: ${error.message}`);
    return null;
  }
  return { keeper, config };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({
    options: {
      port: { type: 'string', default: process.env.PORT ?? '8747' },
      host: { type: 'string', default: process.env.HOST ?? 'localhost' },
      data: { type: 'string', default: process.env.KIDS_WORLD_DATA ?? DEFAULT_DATA_DIR },
    },
  });
  const port = Number(values.port);
  const store = await new KeeperStore(values.data).open();
  const { keeper, config } = (await startKeeper(store)) ?? {};
  const server = createGameServer({ keeperConfig: config ?? null, admin: adminHandler({ store, keeper }) });
  server.listen(port, values.host, () => {
    console.log(`Kids World is running at http://localhost:${port}/`);
    if (values.host === '0.0.0.0' || values.host === '::') {
      for (const address of lanAddresses()) console.log(`  on your network: http://${address}:${port}/`);
    }
    if (keeper) console.log(`Keeper: copies are kept in ${store.dir}; see them at http://localhost:${port}/admin/`);
  });
  const stop = async () => {
    await keeper?.stop();
    await server.shutdown();
    keeper?.rtc?.cleanup?.();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
