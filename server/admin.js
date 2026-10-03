// The keeper's admin pages, at /admin/: what it has kept and from whom, with
// downloads of any day's copy and deletes, and players' logins: a new
// password for a player who forgot theirs, no login at all, or the copies of
// a device that is gone moved into a player's login. Only for this computer:
// requests from other machines, or under any other host name (a DNS
// rebinding page), are refused, and changes need a header no other site's
// page can send.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ADMIN_DIR = fileURLToPath(new URL('./admin/', import.meta.url));
const PAGES = {
  '/admin/': ['index.html', 'text/html; charset=utf-8'],
  '/admin/admin.js': ['admin.js', 'text/javascript; charset=utf-8'],
  '/admin/admin.css': ['admin.css', 'text/css; charset=utf-8'],
};
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_NAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

const isLocal = (req) => LOOPBACK.has(req.socket.remoteAddress) && LOCAL_NAMES.has(String(req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase());

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify(body));
}

// A small JSON body, or null.
async function readJson(req, limit = 4096) {
  const parts = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) return null;
    parts.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  } catch {
    return null;
  }
}

async function sendFile(req, res, file, type, extra = {}) {
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) {
    json(res, 404, { error: 'Not found' });
    return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': info.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

// Returns a handler: (req, res, pathname) => true when it answered.
export function adminHandler({ store, keeper = null, dataDir = store.dir }) {
  return async function admin(req, res, pathname) {
    if (pathname !== '/admin' && !pathname.startsWith('/admin/')) return false;
    if (!isLocal(req)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('The keeper’s pages are only for the computer it runs on.');
      return true;
    }
    if (pathname === '/admin') {
      res.writeHead(301, { Location: '/admin/' }).end();
      return true;
    }
    const page = PAGES[pathname];
    if (page) {
      if (req.method !== 'GET' && req.method !== 'HEAD') res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      else await sendFile(req, res, ADMIN_DIR + page[0], page[1]);
      return true;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-kids-world-admin'] !== '1') {
      json(res, 403, { error: 'Missing the admin header.' });
      return true;
    }
    const url = new URL(req.url, 'http://localhost');
    if (pathname === '/admin/api/state' && req.method === 'GET') {
      json(res, 200, {
        keeper: keeper?.status() ?? null,
        dataDir,
        bytes: store.bytes,
        maxBytes: store.maxBytes,
        keepDays: store.keepDays,
        devices: await store.devices(),
      });
      return true;
    }
    const move = /^\/admin\/api\/devices\/([^/]+)\/move$/.exec(pathname);
    if (move) {
      // A device's copies (one that is gone, say) into a player's login.
      if (req.method !== 'POST') res.writeHead(405, { Allow: 'POST' }).end();
      else {
        const body = await readJson(req);
        try {
          json(res, 200, { ok: true, islands: await store.adoptDevice(move[1], body?.to) });
        } catch (error) {
          json(res, error.code === 'bad' ? 400 : 500, { error: error.message });
        }
      }
      return true;
    }
    const login = /^\/admin\/api\/devices\/([^/]+)\/login$/.exec(pathname);
    if (login) {
      const [, device] = login;
      if (req.method === 'PUT') {
        // A new password (a login, if there was none); the devices logged in stay so.
        const body = await readJson(req);
        try {
          await store.makeLogin(device, body?.password, null, { session: false });
          json(res, 200, { ok: true });
        } catch (error) {
          json(res, error.code === 'bad' || error.code === 'weak' ? 400 : 500, { error: error.message });
        }
      } else if (req.method === 'DELETE') {
        // Every device logged in to it is logged out.
        const ok = await store.removeLogin(device);
        json(res, ok ? 200 : 404, { ok });
      } else res.writeHead(405, { Allow: 'PUT, DELETE' }).end();
      return true;
    }
    const m = /^\/admin\/api\/devices\/([^/]+)(?:\/islands\/([^/]+))?$/.exec(pathname);
    if (!m) {
      json(res, 404, { error: 'Not found' });
      return true;
    }
    const [, device, island] = m;
    if (island && (req.method === 'GET' || req.method === 'HEAD')) {
      const file = await store.islandFile(device, island, url.searchParams.get('day'));
      if (!file) {
        json(res, 404, { error: 'No such copy' });
        return true;
      }
      const extra = {};
      if (url.searchParams.has('download')) {
        const info = await store.islandInfo(device, island);
        const name = String(info?.name ?? 'island').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'island';
        const day = file.slice(-15, -5);
        extra['Content-Disposition'] = `attachment; filename="${name}-${day}.kidsworld.json"`;
      }
      await sendFile(req, res, file, 'application/json; charset=utf-8', extra);
      return true;
    }
    if (req.method === 'DELETE') {
      const ok = island ? await store.deleteIsland(device, island) : await store.deleteDevice(device);
      json(res, ok ? 200 : 404, { ok });
      return true;
    }
    res.writeHead(405, { Allow: island ? 'GET, HEAD, DELETE' : 'DELETE' }).end();
    return true;
  };
}
