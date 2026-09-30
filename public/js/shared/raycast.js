// Walks a ray through the grid one cell at a time (Amanatides & Woo), so the
// first block it meets is found exactly, along with the face it entered by.

export function raycast(world, ox, oy, oz, dx, dy, dz, maxDist, stopAt) {
  const len = Math.hypot(dx, dy, dz);
  if (!(len > 0)) return null;
  dx /= len;
  dy /= len;
  dz /= len;
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tMaxX = dx !== 0 ? (dx > 0 ? x + 1 - ox : ox - x) * tDeltaX : Infinity;
  let tMaxY = dy !== 0 ? (dy > 0 ? y + 1 - oy : oy - y) * tDeltaY : Infinity;
  let tMaxZ = dz !== 0 ? (dz > 0 ? z + 1 - oz : oz - z) * tDeltaZ : Infinity;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  let t = 0;
  const first = world.get(x, y, z);
  const startId = first;
  if (stopAt(first, x, y, z, startId)) return { x, y, z, nx: 0, ny: 0, nz: 0, dist: 0, id: first };
  while (t <= maxDist) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      t = tMaxX;
      tMaxX += tDeltaX;
      nx = -stepX;
      ny = 0;
      nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      t = tMaxY;
      tMaxY += tDeltaY;
      nx = 0;
      ny = -stepY;
      nz = 0;
    } else {
      z += stepZ;
      t = tMaxZ;
      tMaxZ += tDeltaZ;
      nx = 0;
      ny = 0;
      nz = -stepZ;
    }
    if (t > maxDist) break;
    // Leaving the world sideways or downward ends the search; above it, keep going.
    if (x < -1 || z < -1 || x > world.W || z > world.D || y < -1) break;
    const id = world.get(x, y, z);
    if (stopAt(id, x, y, z, startId)) return { x, y, z, nx, ny, nz, dist: t, id };
  }
  return null;
}
