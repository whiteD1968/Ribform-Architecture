import { describe, expect, it } from 'vitest';
import { buildProject, cloveProject, makeProfile } from './build';
import { loft, profilePoint, resizeProfileControls, stationContour, surfaceLoop } from './profiles';
import { extrude, horizontalFrame, positiveHalf, radialFrame, section } from './sections';
import { area, bounds, cross, dot, multiArea, scanIntervals, sub, worldPoint } from './math';
import type { Project, Vec2 } from './types';
function cylinder(): Project {
  const p = cloveProject();
  p.outer.profiles = [makeProfile('a', 0, 100), makeProfile('b', 200, 100)];
  p.outer.profiles.forEach((p) => (p.amplitude = 0));
  p.inner.profiles = structuredClone(p.outer.profiles).map((x) => ({ ...x, radius: 80 }));
  p.rings = [];
  p.ribs.count = 8;
  p.ribs.depth = 20;
  p.resolution = { around: 64, perSpan: 4 };
  return p;
}
describe('profiles and lofts in millimeters', () => {
  it('links each editable horizontal contour exactly to its station row in the loft', () => {
    const p = cylinder();
    p.outer.profiles.splice(1, 0, {
      ...makeProfile('middle', 80, 125),
      center: [14, -9],
      rotation: 23,
    });
    const middle = p.outer.profiles[1];
    middle.controls[2] = [0.08, -0.04];
    const contour = stationContour(middle, 64);
    expect(contour.every((point) => point[2] === 80)).toBe(true);
    const mesh = loft(p.outer, 64, 4);
    mesh.vertices
      .slice(4 * 64, 5 * 64)
      .forEach((point, i) =>
        point.forEach((v, axis) => expect(v).toBeCloseTo(contour[i][axis], 10)),
      );
    middle.controls[2] = [0.16, -0.04];
    expect(stationContour(middle, 64)).not.toEqual(contour);
    const changed = loft(p.outer, 64, 4);
    expect(changed.vertices.slice(0, 64)).toEqual(mesh.vertices.slice(0, 64));
    expect(changed.vertices.slice(4 * 64, 5 * 64)).not.toEqual(mesh.vertices.slice(4 * 64, 5 * 64));
  });
  it('resamples point counts without resetting edits or changing retained handle positions', () => {
    const profile = makeProfile('edited', 50, 100);
    profile.controls[1] = [0.15, -0.1];
    profile.controls[5] = [-0.05, 0.2];
    profile.center = [30, -20];
    profile.scaleX = 1.2;
    profile.rotation = 35;
    const original = structuredClone(profile);
    const next = { ...profile, controls: resizeProfileControls(profile, 24) };
    expect(next.controls).toHaveLength(24);
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const before = profilePoint(profile, angle),
        after = profilePoint(next, angle);
      after.forEach((v, axis) => expect(v).toBeCloseTo(before[axis], 10));
    }
    expect(profile).toEqual(original);
    const reduced = resizeProfileControls(next, 6);
    expect(reduced).toHaveLength(6);
    expect(reduced.some((point) => Math.hypot(...point) > 0)).toBe(true);
    expect(() => resizeProfileControls(profile, 3)).toThrow(/between 4 and 64/);
    expect(() => resizeProfileControls(profile, 4.5)).toThrow(/integer/);
    expect(() => resizeProfileControls(profile, 65)).toThrow(/between 4 and 64/);
  });
  it('preserves unedited parametric shapes at every supported control-point count', () => {
    const profile = makeProfile('seed', 0, 100);
    for (const count of [4, 8, 16, 32, 64]) {
      const resized = { ...profile, controls: resizeProfileControls(profile, count) };
      expect(stationContour(resized, 96)).toEqual(stationContour(profile, 96));
    }
    const p = cylinder();
    p.outer.profiles[0].controls = resizeProfileControls(p.outer.profiles[0], 4);
    p.outer.profiles[1].controls = resizeProfileControls(p.outer.profiles[1], 64);
    expect(buildProject(p).issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('generates a circle and applies scale, rotation, and translation in order', () => {
    const p = makeProfile('a', 0, 100);
    p.amplitude = 0;
    expect(profilePoint(p, 0)).toEqual([100, 0]);
    p.scaleX = 2;
    p.rotation = 90;
    p.center = [10, 20];
    const pt = profilePoint(p, 0);
    expect(pt[0]).toBeCloseTo(10);
    expect(pt[1]).toBeCloseTo(220);
  });
  it('interpolates stations exactly and has a shared derivative', () => {
    const p = cylinder();
    p.outer.profiles.splice(1, 0, { ...makeProfile('middle', 80, 150), amplitude: 0 });
    expect(surfaceLoop(p.outer, 80, 64)[0][0]).toBeCloseTo(150);
    const h = 0.001,
      left = (150 - surfaceLoop(p.outer, 80 - h, 64)[0][0]) / h,
      right = (surfaceLoop(p.outer, 80 + h, 64)[0][0] - 150) / h;
    expect(Math.abs(left - right)).toBeLessThan(0.001);
  });
  it('creates a closed manifold with correct dimensions and reproducible parameters', () => {
    const p = cylinder(),
      mesh = loft(p.outer, 64, 4),
      edges = new Map<string, number>();
    for (const t of mesh.triangles)
      for (let i = 0; i < 3; i++) {
        const e = [t[i], t[(i + 1) % 3]].sort((a, b) => a - b).join(',');
        edges.set(e, (edges.get(e) ?? 0) + 1);
      }
    expect([...edges.values()].every((n) => n === 2)).toBe(true);
    expect(bounds(mesh.vertices).size).toEqual([200, 200, 200]);
    expect(loft(p.outer, 64, 4)).toEqual(mesh);
    p.outer.profiles[1].radius = 120;
    expect(loft(p.outer, 64, 4)).not.toEqual(mesh);
    p.outer.profiles[1].radius = 100;
    expect(loft(p.outer, 64, 4)).toEqual(mesh);
  });
  it('rejects duplicate elevations and crossed profiles', () => {
    const p = cylinder();
    p.outer.profiles[1].z = 0;
    expect(() => loft(p.outer, 64, 4)).toThrow(/elevations/);
    p.outer.profiles[1].z = 200;
    p.outer.profiles[0].controls[0] = [-3, 0];
    expect(() => loft(p.outer, 64, 4)).toThrow(/self-intersecting/);
  });
});
describe('mesh plane intersections and planar sheet components', () => {
  it('extracts the known cylindrical full and radial sections, including planes through mesh vertices', () => {
    const p = cylinder(),
      mesh = loft(p.outer, 64, 4),
      frame = radialFrame([0, 0], 0);
    expect(multiArea(section(mesh, frame))).toBeCloseTo(40000, 3);
    expect(multiArea(positiveHalf(section(mesh, frame)))).toBeCloseTo(20000, 3);
    expect(multiArea(section(mesh, horizontalFrame(0)))).toBeCloseTo(
      (64 * 10000 * Math.sin((2 * Math.PI) / 64)) / 2,
      3,
    );
    expect(multiArea(section(mesh, horizontalFrame(100)))).toBeCloseTo(
      multiArea(section(mesh, horizontalFrame(0))),
      3,
    );
  });
  it('keeps mid-contours planar and extrudes exactly the chosen thickness', () => {
    const p = cylinder();
    p.ribs.origin = [10, 3];
    p.ribs.orientation = 17;
    const built = buildProject(p);
    expect(built.issues.filter((i) => i.severity === 'error')).toEqual([]);
    for (const rib of built.ribs) {
      for (const point of rib.contours.flat())
        for (const xy of point)
          expect(
            Math.abs(dot(sub(worldPoint(rib.frame, xy), rib.frame.origin), rib.frame.normal)),
          ).toBeLessThan(1e-9);
      const mesh = extrude(rib.contours, rib.frame, rib.thickness),
        distances = mesh.vertices.map((v) => dot(sub(v, rib.frame.origin), rib.frame.normal));
      expect(Math.max(...distances) - Math.min(...distances)).toBeCloseTo(3, 8);
    }
  });
  it('produces 20 mm deep rectangular ribs from a cylinder', () => {
    const p = cylinder(),
      built = buildProject(p);
    expect(built.ribs).toHaveLength(8);
    expect(built.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(built.ribs[0].area).toBeCloseTo(4000, 3);
    expect(scanIntervals(built.ribs[0].contours, 100)[0]).toEqual([80, 100]);
  });
  it('supports independent and explicitly approximate inner surfaces', () => {
    const p = cylinder();
    p.innerMode = 'independent';
    let built = buildProject(p);
    expect(built.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(built.ribs[0].area).toBeCloseTo(4000, 3);
    p.innerMode = 'approximate';
    p.offset = 20;
    built = buildProject(p);
    expect(built.ribs[0].area).toBeCloseTo(4000, 3);
    expect(built.issues.some((i) => i.code === 'approximate-offset')).toBe(true);
    expect(built.fabricationReady).toBe(false);
  });
  it('rejects inner surfaces outside the outer shell, mismatched ends, and collapsed offsets', () => {
    const p = cylinder();
    p.innerMode = 'independent';
    p.inner.profiles[1].radius = 130;
    expect(buildProject(p).issues.some((i) => i.message.includes('exits'))).toBe(true);
    p.inner.profiles[1].radius = 80;
    p.inner.profiles[1].z = 210;
    expect(buildProject(p).issues.some((i) => i.message.includes('elevations'))).toBe(true);
    p.innerMode = 'approximate';
    p.offset = 110;
    expect(buildProject(p).issues.some((i) => i.message.includes('collapses'))).toBe(true);
  });
  it('detects insufficient depth and non-intersecting ribs', () => {
    const p = cylinder();
    p.ribs.depth = 2;
    expect(buildProject(p).issues.some((i) => i.code === 'rib-depth')).toBe(true);
    p.ribs.origin = [500, 500];
    expect(buildProject(p).issues.some((i) => i.code === 'empty-rib')).toBe(true);
  });
  it('preserves holes and disconnected contours through extrusion and sectioning', () => {
    const square = (r: number): Vec2[] => [
      [-r, -r],
      [r, -r],
      [r, r],
      [-r, r],
    ];
    const mesh = extrude([[square(20), square(10)]], horizontalFrame(0), 4);
    expect(multiArea(section(mesh, horizontalFrame(0)))).toBeCloseTo(1200, 3);
    const sliced = section(mesh, radialFrame([0, 0], 0));
    expect(sliced).toHaveLength(2);
    expect(multiArea(sliced)).toBeCloseTo(80, 3);
    const volume = mesh.triangles.reduce(
      (sum, [a, b, c]) =>
        sum + dot(mesh.vertices[a], cross(mesh.vertices[b], mesh.vertices[c])) / 6,
      0,
    );
    expect(volume).toBeCloseTo(1200 * 4, 5);
  });
  it('uses individual radial directions and includes partial-sweep endpoints', () => {
    const p = cylinder();
    p.ribs.count = 3;
    p.ribs.orientation = 30;
    p.ribs.sweep = 180;
    const built = buildProject(p);
    expect(built.ribs).toHaveLength(3);
    expect(built.ribs[0].frame.u[0]).toBeCloseTo(Math.cos(Math.PI / 6));
    expect(built.ribs[2].frame.u[0]).toBeCloseTo(Math.cos((7 * Math.PI) / 6));
    p.ribs.sweep = 360;
    const full = buildProject(p);
    expect(full.ribs[0].frame.u).not.toEqual(full.ribs[2].frame.u);
  });
  it('rejects nonfinite dimensions and rings that protrude through an end', () => {
    const p = cylinder();
    p.ribs.thickness = NaN;
    expect(buildProject(p).issues.some((i) => i.severity === 'error')).toBe(true);
    p.ribs.thickness = 3;
    p.rings = [{ id: 'end-ring', z: 0.5, width: 20 }];
    const built = buildProject(p);
    expect(built.rings).toHaveLength(0);
    expect(built.issues.some((i) => i.code === 'ring-elevation')).toBe(true);
  });
  it('builds the irregular Clove sample with rings and unvalidated joint candidates', () => {
    const p = cloveProject(),
      built = buildProject(p);
    expect(built.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(built.ribs).toHaveLength(32);
    expect(built.rings).toHaveLength(2);
    expect(built.notches).toHaveLength(64);
    expect(built.notches.every((n) => n.status === 'unvalidated' && n.clearance === null)).toBe(
      true,
    );
    expect(built.ribs.every((r) => r.contours.every((poly) => Math.abs(area(poly[0])) > 0))).toBe(
      true,
    );
  });
});
