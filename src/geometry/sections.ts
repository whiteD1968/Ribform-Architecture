import clipping from 'polygon-clipping';
import earcut from 'earcut';
import type { Loop, MeshData, MultiPolygon, PlaneFrame, Vec2, Vec3 } from './types';
import { EPS } from './types';
import { area, dot, pointInLoop, sub, worldPoint } from './math';

export const difference = (a: MultiPolygon, b: MultiPolygon): MultiPolygon =>
  a.length ? (b.length ? clipping.difference(a, b) : a) : [];
export const intersection = (a: MultiPolygon, b: MultiPolygon): MultiPolygon =>
  a.length && b.length ? clipping.intersection(a, b) : [];

/** Exact triangle/plane segments on the tessellated model. Ambiguous topology fails closed. */
export function section(mesh: MeshData, frame: PlaneFrame): MultiPolygon {
  const points = new Map<string, Vec2>(),
    segments = new Map<string, [string, string]>(),
    coplanar = new Map<string, number>();
  const buckets = new Map<string, string[]>();
  const key = (p: Vec2) => {
    const x = Math.floor(p[0] / EPS),
      y = Math.floor(p[1] / EPS);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const id of buckets.get(`${x + dx},${y + dy}`) ?? []) {
          const q = points.get(id)!;
          if (Math.hypot(p[0] - q[0], p[1] - q[1]) <= EPS) return id;
        }
    const id = String(points.size),
      bucket = `${x},${y}`;
    points.set(id, p);
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), id]);
    return id;
  };
  const add = (a: Vec3, b: Vec3, coplanarEdge = false) => {
    const project = (p: Vec3): Vec2 => {
      const d = sub(p, frame.origin);
      return [dot(d, frame.u), dot(d, frame.v)];
    };
    const p = project(a),
      q = project(b),
      ka = key(p),
      kb = key(q);
    if (ka === kb) return;
    const edge = [ka, kb].sort().join('|');
    if (coplanarEdge) coplanar.set(edge, (coplanar.get(edge) ?? 0) + 1);
    else segments.set(edge, [ka, kb]);
  };
  for (const triangle of mesh.triangles) {
    const vs = triangle.map((i) => mesh.vertices[i]),
      ds = vs.map((p) => dot(sub(p, frame.origin), frame.normal));
    if (ds.every((d) => Math.abs(d) <= EPS)) {
      for (let i = 0; i < 3; i++) add(vs[i], vs[(i + 1) % 3], true);
      continue;
    }
    const hits: Vec3[] = [];
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3,
        a = vs[i],
        b = vs[j],
        da = ds[i],
        db = ds[j];
      if (Math.abs(da) <= EPS) hits.push(a);
      if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
        const t = da / (da - db);
        hits.push(a.map((v, k) => v + t * (b[k] - v)) as Vec3);
      }
    }
    const unique = hits.filter(
      (p, i) => !hits.slice(0, i).some((q) => Math.hypot(...sub(p, q)) < EPS),
    );
    if (unique.length === 2) add(unique[0], unique[1]);
  }
  for (const [edge, count] of coplanar)
    if (count % 2 === 1) segments.set(edge, edge.split('|') as [string, string]);
  const adjacency = new Map<string, Set<string>>();
  for (const [a, b] of segments.values()) {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }
  if ([...adjacency.values()].some((n) => n.size !== 2))
    throw new Error(
      'Section has an open or ambiguous junction. Adjust the radial origin or profile.',
    );
  const visited = new Set<string>(),
    loops: Loop[] = [];
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const loop: Loop = [];
    let current = start,
      previous = '';
    do {
      if (visited.has(current)) throw new Error('Section contour could not be closed.');
      visited.add(current);
      loop.push(points.get(current)!);
      const next = [...adjacency.get(current)!].find((k) => k !== previous)!;
      previous = current;
      current = next;
    } while (current !== start);
    if (Math.abs(area(loop)) > EPS) loops.push(loop);
  }
  loops.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
  const polygons: MultiPolygon = [];
  for (let i = 0; i < loops.length; i++) {
    const parents = loops.slice(0, i).filter((l) => pointInLoop(loops[i][0], l));
    if (parents.length % 2 === 0) polygons.push([loops[i]]);
    else {
      const parent = polygons.findLast((p) => pointInLoop(loops[i][0], p[0]));
      if (!parent) throw new Error('Unassigned section hole.');
      parent.push(loops[i]);
    }
  }
  return polygons;
}
export function radialFrame(origin: Vec2, angleDegrees: number): PlaneFrame {
  const a = (angleDegrees * Math.PI) / 180,
    u: Vec3 = [Math.cos(a), Math.sin(a), 0],
    v: Vec3 = [0, 0, 1];
  return { origin: [...origin, 0], u, v, normal: [u[1], -u[0], 0] };
}
export const horizontalFrame = (z: number): PlaneFrame => ({
  origin: [0, 0, z],
  u: [1, 0, 0],
  v: [0, 1, 0],
  normal: [0, 0, 1],
});
export function positiveHalf(polys: MultiPolygon): MultiPolygon {
  const size = 1 + Math.max(1, ...polys.flat(2).flat().map(Math.abs));
  return intersection(polys, [
    [
      [
        [0, -size],
        [size, -size],
        [size, size],
        [0, size],
        [0, -size],
      ],
    ],
  ]);
}
/** Extrude 2D contours along the plane normal. Mid-plane vertices are exactly planar. */
export function extrude(contours: MultiPolygon, frame: PlaneFrame, thickness: number): MeshData {
  const vertices: Vec3[] = [],
    triangles: MeshData['triangles'] = [];
  for (const polygon of contours) {
    const loops = polygon.map((l, i) => {
      let p = l.slice();
      if (p.length > 1 && Math.hypot(p[0][0] - p.at(-1)![0], p[0][1] - p.at(-1)![1]) < EPS) p.pop();
      if (area(p) > 0 !== (i === 0)) p.reverse();
      return p;
    });
    const points = loops.flat(),
      holes: number[] = [];
    let count = loops[0].length;
    for (let i = 1; i < loops.length; i++) {
      holes.push(count);
      count += loops[i].length;
    }
    const base = vertices.length,
      n = points.length;
    vertices.push(
      ...points.map((p) => worldPoint(frame, p, -thickness / 2)),
      ...points.map((p) => worldPoint(frame, p, thickness / 2)),
    );
    const indices = earcut(points.flat(), holes);
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = indices.slice(i, i + 3);
      triangles.push([base + c, base + b, base + a], [base + n + a, base + n + b, base + n + c]);
    }
    let offset = 0;
    for (const loop of loops) {
      for (let i = 0; i < loop.length; i++) {
        const a = base + offset + i,
          b = base + offset + ((i + 1) % loop.length);
        triangles.push([a, b, b + n], [a, b + n, a + n]);
      }
      offset += loop.length;
    }
  }
  return { vertices, triangles };
}
