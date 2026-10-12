import type { BuildResult, Issue, PlanarPart, Project, Vec2 } from './types';
import { EPS } from './types';
import { bounds, multiArea, scanIntervals } from './math';
import { internalRingContours } from './rings';
import { loft, sortedProfiles } from './profiles';
import { difference, horizontalFrame, positiveHalf, radialFrame, section } from './sections';

const warning = (code: string, message: string): Issue => ({ severity: 'warning', code, message });
const error = (code: string, message: string): Issue => ({ severity: 'error', code, message });
export function validateProject(p: Project) {
  if (!p || typeof p.name !== 'string' || p.name.length > 200)
    throw new Error('Project name must be text of at most 200 characters.');
  if (
    !Array.isArray(p.outer?.profiles) ||
    !Array.isArray(p.inner?.profiles) ||
    !Array.isArray(p.rings)
  )
    throw new Error('Project must contain outer profiles, inner profiles, and rings.');
  if (p.version !== 1 || p.units !== 'mm')
    throw new Error('Only version 1 millimeter projects are supported.');
  if (!['none', 'approximate', 'independent'].includes(p.innerMode))
    throw new Error('Unknown inner surface mode.');
  const r = p.ribs;
  if (!r || !Array.isArray(r.origin) || r.origin.length !== 2)
    throw new Error('Radial origin must contain X and Y coordinates.');
  if (
    p.rings.some((ring) => !ring || typeof ring.id !== 'string') ||
    new Set(p.rings.map((ring) => ring.id)).size !== p.rings.length
  )
    throw new Error('Rings require unique text identifiers.');
  if (!Number.isInteger(r.count) || r.count < 1 || r.count > 96)
    throw new Error('Rib count must be between 1 and 96.');
  if (
    [
      ...r.origin,
      r.orientation,
      r.sweep,
      r.thickness,
      r.depth,
      r.minDepth,
      p.offset,
      ...p.rings.flatMap((x) => [x.z, x.width]),
    ].some((x) => !Number.isFinite(x))
  )
    throw new Error('Parameters must be finite numbers.');
  if (
    r.sweep <= 0 ||
    r.sweep > 360 ||
    r.thickness <= 0 ||
    r.depth <= 0 ||
    r.minDepth <= 0 ||
    p.offset <= 0
  )
    throw new Error('Thickness, depth, offset, and angular sweep must be positive.');
  if (
    !Number.isInteger(p.resolution.around) ||
    p.resolution.around < 24 ||
    p.resolution.around > 256 ||
    !Number.isInteger(p.resolution.perSpan) ||
    p.resolution.perSpan < 2 ||
    p.resolution.perSpan > 32
  )
    throw new Error('Unsupported sampling resolution.');
  if (p.outer.profiles.length > 16 || p.inner.profiles.length > 16 || p.rings.length > 16)
    throw new Error('Build 01 supports up to 16 stations per surface and 16 rings.');
}

export function buildProject(p: Project): BuildResult {
  const result: BuildResult = {
    outer: { vertices: [], triangles: [] },
    ribs: [],
    rings: [],
    notches: [],
    issues: [],
    dimensions: [0, 0, 0],
    fabricationReady: false,
  };
  let stage = 'Profiles';
  try {
    validateProject(p);
    const { around, perSpan } = p.resolution;
    result.outer = loft(p.outer, around, perSpan);
    const box = bounds(result.outer.vertices);
    result.dimensions = box.size;
    if (p.innerMode === 'approximate') {
      result.inner = loft(p.outer, around, perSpan, p.offset);
      result.issues.push(
        warning(
          'approximate-offset',
          'Inner surface uses a radial approximation, not a true normal offset. Fabrication export is unavailable.',
        ),
      );
    } else if (p.innerMode === 'independent') {
      result.inner = loft(p.inner, around, perSpan);
      const innerBox = bounds(result.inner.vertices);
      if (
        Math.abs(innerBox.min[2] - box.min[2]) > EPS ||
        Math.abs(innerBox.max[2] - box.max[2]) > EPS
      )
        throw new Error('Inner and outer surfaces must share bottom and top elevations.');
    }
    if (result.inner) {
      // Check every tessellation elevation plus midpoints against the authoritative meshes.
      const levels = [
        ...new Set([...result.outer.vertices, ...result.inner.vertices].map((v) => v[2])),
      ].sort((a, b) => a - b);
      const checks = levels.flatMap((z, i) => (i ? [(z + levels[i - 1]) / 2, z] : [z]));
      for (const z of checks) {
        const frame = horizontalFrame(z),
          outer = section(result.outer, frame),
          inner = section(result.inner, frame);
        if (multiArea(difference(inner, outer)) > 0.01)
          throw new Error(`Inner surface exits the outer surface near Z ${z.toFixed(2)} mm.`);
      }
    }
    for (let i = 0; i < p.ribs.count; i++) {
      stage = `Rib ${i + 1}`;
      const angle =
        p.ribs.orientation +
        (i * p.ribs.sweep) / (p.ribs.sweep === 360 ? p.ribs.count : Math.max(1, p.ribs.count - 1));
      const frame = radialFrame(p.ribs.origin, angle),
        issues: Issue[] = [];
      const outer = section(result.outer, frame);
      const inner = result.inner
        ? section(result.inner, frame)
        : outer.map((poly) =>
            poly.map((loop) => loop.map(([u, v]) => [u - p.ribs.depth, v] as Vec2)),
          );
      const contours = positiveHalf(difference(outer, inner));
      if (!contours.length)
        issues.push(error('empty-rib', `Rib ${i + 1} does not intersect the form.`));
      let minimum = Infinity;
      for (let k = 1; k < 80; k++) {
        const z = box.min[2] + (box.size[2] * k) / 80;
        for (const [lo, hi] of scanIntervals(contours, z)) minimum = Math.min(minimum, hi - lo);
      }
      if (minimum < p.ribs.minDepth - EPS)
        issues.push(
          error(
            'rib-depth',
            `Rib ${i + 1} has sampled depth ${minimum.toFixed(2)} mm, below ${p.ribs.minDepth} mm.`,
          ),
        );
      result.ribs.push({
        id: `rib-${i + 1}`,
        frame,
        contours,
        thickness: p.ribs.thickness,
        area: multiArea(contours),
        issues,
      });
    }
    for (const ring of p.rings) {
      stage = `Ring at ${ring.z} mm`;
      if (
        ring.z <= box.min[2] + p.ribs.thickness / 2 ||
        ring.z >= box.max[2] - p.ribs.thickness / 2
      ) {
        result.issues.push(
          error('ring-elevation', `Ring at ${ring.z} mm must fit between the end profiles.`),
        );
        continue;
      }
      if (ring.width <= 0) throw new Error('Ring width must be positive.');
      const frame = horizontalFrame(ring.z);
      const contours = internalRingContours(result.outer, result.inner, p, ring);
      const part: PlanarPart = {
        id: ring.id,
        frame,
        contours,
        thickness: p.ribs.thickness,
        area: multiArea(contours),
        issues: [],
      };
      result.rings.push(part);
      for (const rib of result.ribs) {
        stage = `Joint ${ring.id} / ${rib.id}`;
        const ringInRibCoordinates = contours.map((poly) =>
          poly.map((loop) =>
            loop.map(([x, y]) => {
              const dx = x - rib.frame.origin[0],
                dy = y - rib.frame.origin[1];
              return [
                dx * rib.frame.u[0] + dy * rib.frame.u[1],
                dx * rib.frame.normal[0] + dy * rib.frame.normal[1],
              ] as Vec2;
            }),
          ),
        );
        const ringIntervals = scanIntervals(ringInRibCoordinates, 0);
        for (const a of scanIntervals(rib.contours, ring.z))
          for (const b of ringIntervals) {
            const lo = Math.max(a[0], b[0]),
              hi = Math.min(a[1], b[1]);
            if (hi - lo > EPS)
              result.notches.push({
                ribId: rib.id,
                ringId: ring.id,
                z: ring.z,
                radialInterval: [lo, hi],
                nominalSlotWidth: p.ribs.thickness,
                clearance: null,
                status: 'unvalidated',
              });
          }
      }
    }
    result.issues.push(...result.ribs.flatMap((r) => r.issues));
    if (result.rings.length)
      result.issues.push(
        warning(
          'notches-unvalidated',
          'Rings overlap ribs. Joint intersections are calculated; mating notches and fit tolerances are not yet validated.',
        ),
      );
    result.issues.push(
      warning(
        'prototype',
        'Prototype geometry: sampled validity checks only. Cutting export and fabrication certification are deferred.',
      ),
    );
  } catch (e) {
    result.issues.push(
      error(
        'invalid-geometry',
        `${stage}: ${e instanceof Error ? e.message : 'Geometry calculation failed.'}`,
      ),
    );
    // Prevent presenting a partially computed set of parts as a valid assembly.
    result.ribs = [];
    result.rings = [];
    result.notches = [];
  }
  return result;
}

export function makeProfile(
  id: string,
  z: number,
  radius: number,
): Project['outer']['profiles'][number] {
  return {
    id,
    name: `Station ${id}`,
    z,
    radius,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    center: [0, 0],
    lobes: 5,
    amplitude: 0.08,
    controls: Array.from({ length: 12 }, () => [0, 0] as Vec2),
  };
}
export function cloveProject(): Project {
  const outer = {
    profiles: [
      makeProfile('01', 0, 65),
      makeProfile('02', 70, 138),
      makeProfile('03', 170, 173),
      makeProfile('04', 280, 127),
      makeProfile('05', 340, 58),
    ],
  };
  outer.profiles.forEach((p, i) => {
    p.rotation = i * 4;
    p.amplitude = 0.09;
  });
  return {
    version: 1,
    name: 'Clove / Pendant 01',
    units: 'mm',
    outer,
    inner: {
      profiles: outer.profiles.map((p) => ({
        ...structuredClone(p),
        id: `inner-${p.id}`,
        radius: p.radius - 22,
      })),
    },
    innerMode: 'none',
    offset: 22,
    ribs: {
      count: 32,
      origin: [0, 0],
      orientation: 0,
      sweep: 360,
      thickness: 3,
      depth: 22,
      minDepth: 5,
    },
    rings: [
      { id: 'ring-1', z: 75, width: 28 },
      { id: 'ring-2', z: 270, width: 28 },
    ],
    resolution: { around: 96, perSpan: 8 },
  };
}
export function nextProfile(surface: Project['outer']) {
  const ps = sortedProfiles(surface);
  let at = 0,
    gap = 0;
  for (let i = 0; i < ps.length - 1; i++)
    if (ps[i + 1].z - ps[i].z > gap) {
      gap = ps[i + 1].z - ps[i].z;
      at = i;
    }
  const profile = structuredClone(ps[at]);
  profile.id = crypto.randomUUID();
  profile.name = 'New station';
  profile.z = (ps[at].z + ps[at + 1].z) / 2;
  profile.radius = (ps[at].radius + ps[at + 1].radius) / 2;
  return profile;
}
