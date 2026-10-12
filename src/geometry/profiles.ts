import earcut from 'earcut';
import type { Profile, Vec2, Vec3, MeshData, SurfaceSettings } from './types';
import { EPS } from './types';
import { area, selfIntersects } from './math';
const TAU = 2 * Math.PI;
function controlOffset(p: Profile, angle: number): Vec2 {
  const n = p.controls.length,
    t = ((((angle / TAU) % 1) + 1) % 1) * n,
    i = Math.floor(t),
    f = t - i;
  const smooth = (axis: number) => {
    const c = (j: number) => p.controls[(j + n) % n][axis];
    const a = c(i - 1),
      b = c(i),
      d = c(i + 1),
      e = c(i + 2);
    return (
      0.5 *
      (2 * b +
        (-a + d) * f +
        (2 * a - 5 * b + 4 * d - e) * f * f +
        (-a + 3 * b - 3 * d + e) * f * f * f)
    );
  };
  return [smooth(0), smooth(1)];
}
/** Resample the existing displacement curve instead of resetting edited handles. */
export function resizeProfileControls(p: Profile, count: number): Vec2[] {
  if (!Number.isInteger(count) || count < 4 || count > 64)
    throw new Error('Control point count must be an integer between 4 and 64.');
  return Array.from({ length: count }, (_, i) => controlOffset(p, (i / count) * TAU));
}
export function profilePoint(p: Profile, angle: number): Vec2 {
  const offset = controlOffset(p, angle);
  const r = p.radius * (1 + p.amplitude * Math.cos(p.lobes * angle));
  const x = (r * Math.cos(angle) + p.radius * offset[0]) * p.scaleX;
  const y = (r * Math.sin(angle) + p.radius * offset[1]) * p.scaleY;
  const rot = (p.rotation * Math.PI) / 180,
    c = Math.cos(rot),
    s = Math.sin(rot);
  return [p.center[0] + x * c - y * s, p.center[1] + x * s + y * c];
}
export function sampleProfile(p: Profile, count: number): Vec2[] {
  return Array.from({ length: count }, (_, i) => profilePoint(p, (i / count) * TAU));
}
/** The horizontal station contour is the same angular sample row used by the loft. */
export function stationContour(p: Profile, count: number): Vec3[] {
  return sampleProfile(p, count).map(([x, y]) => [x, y, p.z]);
}
export function sortedProfiles(surface: SurfaceSettings) {
  return [...surface.profiles].sort((a, b) => a.z - b.z);
}
/** Cubic Hermite interpolation of corresponding angular samples; derivatives are shared at stations. */
export function surfaceLoop(surface: SurfaceSettings, z: number, count: number): Vec2[] {
  const ps = sortedProfiles(surface);
  if (z < ps[0].z - EPS || z > ps.at(-1)!.z + EPS)
    throw new Error('Section lies outside the profile elevations.');
  let i = ps.findIndex((_, j) => j < ps.length - 1 && z <= ps[j + 1].z + EPS);
  if (i < 0) i = ps.length - 2;
  const dz = ps[i + 1].z - ps[i].z,
    t = Math.max(0, Math.min(1, (z - ps[i].z) / dz));
  return Array.from({ length: count }, (_, k) => {
    const angle = (k / count) * TAU;
    const values = ps.map((p) => profilePoint(p, angle));
    const slope = (j: number, axis: number) => {
      const lo = Math.max(0, j - 1),
        hi = Math.min(ps.length - 1, j + 1);
      return (values[hi][axis] - values[lo][axis]) / (ps[hi].z - ps[lo].z);
    };
    return [0, 1].map(
      (axis) =>
        (2 * t * t * t - 3 * t * t + 1) * values[i][axis] +
        (t * t * t - 2 * t * t + t) * dz * slope(i, axis) +
        (-2 * t * t * t + 3 * t * t) * values[i + 1][axis] +
        (t * t * t - t * t) * dz * slope(i + 1, axis),
    ) as Vec2;
  });
}
export function validateProfiles(surface: SurfaceSettings) {
  const ps = sortedProfiles(surface);
  if (ps.length < 2) throw new Error('At least two profile stations are required.');
  if (new Set(ps.map((p) => p.id)).size !== ps.length)
    throw new Error('Profile identifiers must be unique within each surface.');
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (
      typeof p.id !== 'string' ||
      typeof p.name !== 'string' ||
      !Array.isArray(p.center) ||
      p.center.length !== 2 ||
      !Array.isArray(p.controls) ||
      p.controls.length > 64 ||
      p.controls.some((c) => !Array.isArray(c) || c.length !== 2)
    )
      throw new Error('Invalid profile identity or XY control-point data.');
    const numbers = [
      p.z,
      p.radius,
      p.scaleX,
      p.scaleY,
      p.rotation,
      ...p.center,
      p.lobes,
      p.amplitude,
      ...p.controls.flat(),
    ];
    if (numbers.some((v) => !Number.isFinite(v)))
      throw new Error('Profile parameters must be finite.');
    if (
      p.radius <= 0 ||
      p.scaleX <= 0 ||
      p.scaleY <= 0 ||
      p.controls.length < 4 ||
      !Number.isInteger(p.lobes) ||
      p.lobes < 1 ||
      Math.abs(p.amplitude) >= 1
    )
      throw new Error('Invalid profile radius, scale, lobes, modulation, or control points.');
    if (i && p.z - ps[i - 1].z < 0.1)
      throw new Error('Profile elevations must be at least 0.1 mm apart.');
  }
}
export function loft(
  surface: SurfaceSettings,
  around: number,
  perSpan: number,
  radialInset = 0,
): MeshData {
  validateProfiles(surface);
  const ps = sortedProfiles(surface),
    vertices: Vec3[] = [],
    triangles: MeshData['triangles'] = [];
  const levels: number[] = [];
  for (let i = 0; i < ps.length - 1; i++)
    for (let j = 0; j < perSpan; j++)
      levels.push(ps[i].z + ((ps[i + 1].z - ps[i].z) * j) / perSpan);
  levels.push(ps.at(-1)!.z);
  for (const z of levels) {
    let loop = surfaceLoop(surface, z, around);
    if (radialInset > 0) {
      // Approximation: shrink rays toward the sampled section centroid. This is NOT a normal offset.
      const center = loop.reduce((s, p) => [s[0] + p[0] / around, s[1] + p[1] / around] as Vec2, [
        0, 0,
      ] as Vec2);
      loop = loop.map((p) => {
        const dx = p[0] - center[0],
          dy = p[1] - center[1],
          r = Math.hypot(dx, dy);
        if (r <= radialInset + EPS)
          throw new Error('Approximate inner offset collapses a profile.');
        return [center[0] + dx * (1 - radialInset / r), center[1] + dy * (1 - radialInset / r)];
      });
    }
    if (area(loop) <= EPS || selfIntersects(loop))
      throw new Error(`Invalid or self-intersecting profile near Z ${z.toFixed(2)} mm.`);
    vertices.push(...loop.map(([x, y]) => [x, y, z] as Vec3));
  }
  for (let j = 0; j < levels.length - 1; j++)
    for (let k = 0; k < around; k++) {
      const a = j * around + k,
        b = j * around + ((k + 1) % around),
        c = b + around,
        d = a + around;
      triangles.push([a, b, c], [a, c, d]);
    }
  for (const end of [0, levels.length - 1]) {
    const base = end * around,
      flat = vertices.slice(base, base + around).flatMap((p) => p.slice(0, 2));
    const indices = earcut(flat);
    for (let k = 0; k < indices.length; k += 3) {
      const [a, b, c] = indices.slice(k, k + 3).map((v) => v + base);
      triangles.push(end === 0 ? [c, b, a] : [a, b, c]);
    }
  }
  return { vertices, triangles };
}
