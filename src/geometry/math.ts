import type { Loop, MultiPolygon, Vec2, Vec3, PlaneFrame } from './types';
import { EPS } from './types';
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const area = (p: Loop) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
export const multiArea = (polys: MultiPolygon) =>
  polys.reduce(
    (s, p) => s + Math.abs(area(p[0])) - p.slice(1).reduce((h, l) => h + Math.abs(area(l)), 0),
    0,
  );
export function pointInLoop(p: Vec2, loop: Loop) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i],
      b = loop[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function selfIntersects(p: Loop) {
  const orient = (a: Vec2, b: Vec2, c: Vec2) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const on = (a: Vec2, b: Vec2, c: Vec2) =>
    Math.abs(orient(a, b, c)) < EPS &&
    c[0] >= Math.min(a[0], b[0]) - EPS &&
    c[0] <= Math.max(a[0], b[0]) + EPS &&
    c[1] >= Math.min(a[1], b[1]) - EPS &&
    c[1] <= Math.max(a[1], b[1]) + EPS;
  for (let i = 0; i < p.length; i++)
    for (let j = i + 2; j < p.length; j++) {
      if (i === 0 && j === p.length - 1) continue;
      const a = p[i],
        b = p[(i + 1) % p.length],
        c = p[j],
        d = p[(j + 1) % p.length];
      if (
        (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) ||
        on(a, b, c) ||
        on(a, b, d) ||
        on(c, d, a) ||
        on(c, d, b)
      )
        return true;
    }
  return false;
}
export function worldPoint(frame: PlaneFrame, p: Vec2, thicknessOffset = 0): Vec3 {
  return frame.origin.map(
    (o, i) => o + p[0] * frame.u[i] + p[1] * frame.v[i] + thicknessOffset * frame.normal[i],
  ) as Vec3;
}
export function bounds(vertices: Vec3[]) {
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  vertices.forEach((p) =>
    p.forEach((v, i) => {
      min[i] = Math.min(min[i], v);
      max[i] = Math.max(max[i], v);
    }),
  );
  return { min, max, size: max.map((v, i) => v - min[i]) as Vec3 };
}
/** Material intervals along local u at the given v; handles multiple shells and holes. */
export function scanIntervals(polys: MultiPolygon, v: number): Vec2[] {
  const intervals: Vec2[] = [];
  for (const polygon of polys) {
    const crossings: number[] = [];
    for (const loop of polygon)
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i],
          b = loop[(i + 1) % loop.length];
        if ((a[1] <= v && b[1] > v) || (b[1] <= v && a[1] > v))
          crossings.push(a[0] + ((v - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2)
      if (crossings[i + 1] - crossings[i] > EPS) intervals.push([crossings[i], crossings[i + 1]]);
  }
  return intervals;
}
