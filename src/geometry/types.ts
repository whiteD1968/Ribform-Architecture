/** Authoritative coordinates are millimeters, right handed, Z up. */
export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Loop = Vec2[];
export type Polygon = Loop[];
export type MultiPolygon = Polygon[];
export interface Profile {
  id: string;
  name: string;
  z: number;
  radius: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  center: Vec2;
  lobes: number;
  amplitude: number;
  /** Dimensionless local XY displacements at uniformly spaced angular handles. */
  controls: Vec2[];
}
export interface SurfaceSettings {
  profiles: Profile[];
}
export interface RibSettings {
  count: number;
  origin: Vec2;
  orientation: number;
  sweep: number;
  thickness: number;
  depth: number;
  minDepth: number;
}
export interface RingSettings {
  id: string;
  z: number;
  width: number;
}
export interface Project {
  version: 1;
  name: string;
  units: 'mm';
  outer: SurfaceSettings;
  inner: SurfaceSettings;
  innerMode: 'none' | 'approximate' | 'independent';
  offset: number;
  ribs: RibSettings;
  rings: RingSettings[];
  resolution: { around: number; perSpan: number };
}
export interface MeshData {
  vertices: Vec3[];
  triangles: [number, number, number][];
}
export interface PlaneFrame {
  origin: Vec3;
  u: Vec3;
  v: Vec3;
  normal: Vec3;
}
export interface Issue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
}
export interface PlanarPart {
  id: string;
  frame: PlaneFrame;
  contours: MultiPolygon;
  thickness: number;
  area: number;
  issues: Issue[];
}
export interface NotchCandidate {
  ribId: string;
  ringId: string;
  z: number;
  radialInterval: Vec2;
  nominalSlotWidth: number;
  clearance: number | null;
  status: 'unvalidated';
}
export interface BuildResult {
  outer: MeshData;
  inner?: MeshData;
  ribs: PlanarPart[];
  rings: PlanarPart[];
  notches: NotchCandidate[];
  issues: Issue[];
  dimensions: Vec3;
  fabricationReady: false;
}
export const EPS = 1e-5;
