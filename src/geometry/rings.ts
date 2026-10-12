import type { MeshData, MultiPolygon, Project, RingSettings, Vec2 } from './types';
import { EPS } from './types';
import { difference, horizontalFrame, section } from './sections';
import { scanIntervals } from './math';

export function ringElevationRange(project: Project) {
  const elevations = project.outer.profiles.map((p) => p.z);
  const margin = project.ribs.thickness / 2 + 0.1;
  return {
    min: Math.ceil((Math.min(...elevations) + margin) * 10) / 10,
    max: Math.floor((Math.max(...elevations) - margin) * 10) / 10,
  };
}

/** A support ring straddles the INNER rib edge, with its body extending into the cavity.
 * Three slab sections check room for engagement across the ring's material thickness.
 * Only one radial shell per direction is supported; ambiguous shells fail explicitly.
 */
export function internalRingContours(
  outerMesh: MeshData,
  innerMesh: MeshData | undefined,
  project: Project,
  ring: RingSettings,
): MultiPolygon {
  const { ribs, resolution } = project;
  const sections = [-ribs.thickness / 2, 0, ribs.thickness / 2].map((dz) => ({
    outer: section(outerMesh, horizontalFrame(ring.z + dz)),
    inner: innerMesh ? section(innerMesh, horizontalFrame(ring.z + dz)) : undefined,
  }));
  const angles = Array.from({ length: resolution.around }, (_, i) => (i * 360) / resolution.around);
  // Include the actual rib directions so their joint intervals meet exact ring vertices.
  for (let i = 0; i < ribs.count; i++)
    angles.push(
      ribs.orientation +
        (i * ribs.sweep) / (ribs.sweep === 360 ? ribs.count : Math.max(1, ribs.count - 1)),
    );
  const directions = [
    ...new Set(angles.map((a) => Number((((a % 360) + 360) % 360).toFixed(10)))),
  ].sort((a, b) => a - b);
  const outside: Vec2[] = [],
    inside: Vec2[] = [];
  const boundary = (polygons: MultiPolygon, c: number, s: number) => {
    const local = polygons.map((poly) =>
      poly.map((loop) =>
        loop.map(([x, y]) => {
          const dx = x - ribs.origin[0],
            dy = y - ribs.origin[1];
          return [dx * c + dy * s, -dx * s + dy * c] as Vec2;
        }),
      ),
    );
    const spans = scanIntervals(local, 0).filter(([, hi]) => hi > EPS);
    if (spans.length !== 1 || spans[0][0] > EPS)
      throw new Error(
        'An internal support ring requires a single radial boundary around the rib origin. Move the origin inside the form or simplify the profile.',
      );
    return spans[0][1];
  };
  for (const degrees of directions) {
    const angle = (degrees * Math.PI) / 180,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const spans = sections.map(({ outer, inner }) => {
      const hi = boundary(outer, c, s);
      return { lo: inner ? boundary(inner, c, s) : Math.max(0, hi - ribs.depth), hi };
    });
    const minInner = Math.min(...spans.map((p) => p.lo)),
      maxInner = Math.max(...spans.map((p) => p.lo));
    const minOuter = Math.min(...spans.map((p) => p.hi));
    const availableDepth = minOuter - maxInner,
      availableWidth = ring.width - (maxInner - minInner);
    if (availableDepth <= EPS || availableWidth <= EPS)
      throw new Error(
        'The support ring cannot engage the inner rib edge across its thickness at this elevation. Move the ring or increase its radial width.',
      );
    const engagement = Math.min(availableDepth, availableWidth) / 2;
    const outerRadius = maxInner + engagement,
      innerRadius = outerRadius - ring.width;
    if (innerRadius <= EPS)
      throw new Error(
        'The internal support ring opening collapses. Reduce its radial width or move it to a wider section.',
      );
    outside.push([ribs.origin[0] + c * outerRadius, ribs.origin[1] + s * outerRadius]);
    inside.push([ribs.origin[0] + c * innerRadius, ribs.origin[1] + s * innerRadius]);
  }
  return difference([[outside]], [[inside]]);
}
