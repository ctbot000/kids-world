// Dedicated server: serves the game from public/ and hosts islands over
// WebSocket, so nobody's browser has to stay open as the host. Node
// built-ins only. Usage:
//   npm start                        # http://localhost:8747/
//   npm start -- --host 0.0.0.0      # also reachable from other devices on the LAN
//   npm start -- --port 8080         # or PORT=8080 npm start
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { generateCode, isValidCode, normalizeCode } from '../public/js/shared/codes.js';
import { PROTOCOL, Room } from '../public/js/shared/room.js';
import { THEMES } from '../public/js/shared/worldgen.js';
import { acceptUpgrade } from './websocket.js';

export const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const HEARTBEAT_MS = 20000;
const TICK_MS = 100;

export function createGameServer({
  root = PUBLIC_DIR,
  log = (error) => console.error(error),
  maxRooms = 200,
  maxConnections = 1600,
  // How long an island with nobody on it is kept, so friends can come back.
  idleMs = 2 * 60 * 60 * 1000,
} = {}) {
  const base = resolve(root);
  const rooms = new Map();
  const sockets = new Set();
  const peers = new Set();

  async function serveFile(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('Bad request');
      return;
    }
    if (pathname === '/api/info') {
      const body = JSON.stringify({ app: 'kids-world', mode: 'server', protocol: PROTOCOL, islands: rooms.size });
      res.writeHead(200, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' }).end(body);
      return;
    }
    let file = resolve(base, `.${pathname}`);
    if (file !== base && !file.startsWith(base + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      file = join(file, 'index.html');
      info = await stat(file).catch(() => null);
    }
    if (!info?.isFile()) {
      res.writeHead(404, { 'Content-Type': TYPES['.txt'], 'Cache-Control': 'no-store' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(file)
      .on('error', () => res.destroy())
      .pipe(res);
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
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!path.endsWith('/ws') || peers.size >= maxConnections) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    const ws = acceptUpgrade(req, socket, head);
    if (ws) accept(ws);
  });

  function uniqueCode() {
    for (;;) {
      const code = generateCode();
      if (!rooms.has(code)) return code;
    }
  }

  function accept(ws) {
    peers.add(ws);
    let entry = null;
    const conn = {
      send: (text) => ws.send(text),
      close: () => ws.close(1000),
    };
    const reply = (msg) => ws.send(JSON.stringify(msg));
    ws.on('message', (text) => {
      let msg;
      try {
        msg = JSON.parse(text);
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
            : new Room({ code, theme: THEMES.some((t) => t.key === msg.theme) ? msg.theme : 'sunny', name: msg.name, settings: msg.settings, log });
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
    ws.on('close', () => {
      peers.delete(ws);
      entry?.room.detach(conn);
    });
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
      for (const ws of peers) {
        if (!ws.alive) ws.terminate();
        else ws.ping();
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({
    options: {
      port: { type: 'string', default: process.env.PORT ?? '8747' },
      host: { type: 'string', default: process.env.HOST ?? 'localhost' },
    },
  });
  const port = Number(values.port);
  const server = createGameServer();
  server.listen(port, values.host, () => {
    console.log(`Kids World is running at http://localhost:${port}/`);
    if (values.host === '0.0.0.0' || values.host === '::') {
      for (const address of lanAddresses()) console.log(`  on your network: http://${address}:${port}/`);
    }
  });
  const stop = () => server.shutdown().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
