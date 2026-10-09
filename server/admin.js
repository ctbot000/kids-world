// The keeper's admin pages, at /admin/: what it has kept and from whom, with
// downloads of any day's copy and deletes, and players' logins: a new
// password for a player who forgot theirs, no login at all, or the copies of
// a device that is gone moved into a player's login, and a player taken out
// of the ranking, or put back, and where each player was last seen from: the
// IP address (a local one for a player on this computer's own network) and,
// from geoip-lite's offline database (no address leaves this computer),
// roughly where that is. Only for this computer: requests from other
// machines, or under any other host name (a DNS rebinding page), are
// refused, and changes need a header no other site's page can send.
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import send from 'send';
import { isLoopbackIp, isPublicIp, KeepError } from './keeper.js';

const ADMIN_DIR = fileURLToPath(new URL('./admin/', import.meta.url));
const PAGES = {
  '/admin/': 'index.html',
  '/admin/admin.js': 'admin.js',
  '/admin/admin.css': 'admin.css',
};
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_NAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

// geoip-lite holds its database in memory (about 100 MB): loaded only once
// there is an address to look up.
let geoip = null;
async function place(ip) {
  if (!ip) return null;
  if (!isPublicIp(ip)) return { local: isLoopbackIp(ip) ? 'computer' : 'network' };
  geoip ??= import('geoip-lite').then((m) => m.default);
  const found = (await geoip).lookup(ip);
  return found ? { country: found.country, region: found.region, city: found.city, timezone: found.timezone } : null;
}

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

// A file, never cached, with any extra headers (a download's file name).
// Its folder is send's root: as a path, ~/.kids-world would be a dotfile.
function sendFile(req, res, file, extra = {}) {
  send(req, `/${encodeURIComponent(basename(file))}`, { root: dirname(file), cacheControl: false })
    .on('headers', (res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      for (const [name, value] of Object.entries(extra)) res.setHeader(name, value);
    })
    .on('error', (error) => {
      if (res.headersSent) res.destroy();
      else json(res, error.statusCode === 404 ? 404 : 500, { error: error.statusCode === 404 ? 'Not found' : error.message });
    })
    .pipe(res);
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
      else sendFile(req, res, join(ADMIN_DIR, page));
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
        devices: await Promise.all((await store.devices()).map(async (d) => ({ ...d, place: await place(d.ip) }))),
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
          json(res, error instanceof KeepError ? 400 : 500, { error: error.message });
        }
      }
      return true;
    }
    const ranked = /^\/admin\/api\/devices\/([^/]+)\/ranked$/.exec(pathname);
    if (ranked) {
      // A player out of the ranking (a name that should not be there, say), or back in.
      if (req.method !== 'PUT') res.writeHead(405, { Allow: 'PUT' }).end();
      else {
        const body = await readJson(req);
        const ok = await store.setRanked(ranked[1], body?.on !== false);
        json(res, ok ? 200 : 404, { ok });
      }
      return true;
    }
    const login = /^\/admin\/api\/devices\/([^/]+)\/login$/.exec(pathname);
    if (login) {
      const [, device] = login;
      if (req.method === 'PUT') {
        // A new password, or a login with a username, if there was none; the devices logged in stay so.
        const body = await readJson(req);
        try {
          const username = typeof body?.username === 'string' ? body.username : null;
          await store.makeLogin(device, body?.password, null, { session: false, username });
          json(res, 200, { ok: true });
        } catch (error) {
          json(res, error instanceof KeepError ? 400 : 500, { error: error.message });
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
      sendFile(req, res, file, extra);
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
