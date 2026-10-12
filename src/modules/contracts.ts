import type { MultiPolygon, PlaneFrame, Project, Vec2 } from '../geometry/types';
/** Interfaces for later builds; none of these adapters is registered in Build 01. */
export interface SheetMaterial {
  id: string;
  name: string;
  thicknessMm: number;
  stockMm: Vec2;
  grainAngle: number | null;
  kerfMm: number;
}
export interface CutPart {
  id: string;
  contours: MultiPolygon;
  frame: PlaneFrame;
  materialId: string;
  layers: { cut: MultiPolygon; engrave: MultiPolygon; mark: MultiPolygon };
}
export interface PatternProvider {
  apply(part: CutPart, parameters: Record<string, number>): CutPart;
}
export interface NestingProvider {
  nest(parts: CutPart[], material: SheetMaterial, grainAware: boolean): Promise<unknown>;
}
export interface ExportProvider {
  format: 'svg' | 'dxf';
  export(parts: CutPart[]): Promise<Blob>;
}
export interface GeometrySource {
  kind: 'profiles' | 'metaball' | 'cad-import' | 'wall';
  evaluate(project: Project): Promise<unknown>;
}
export interface AssemblyProvider {
  sequence(parts: CutPart[]): Promise<unknown>;
}
export interface SourcingProvider {
  estimate(project: Project): Promise<unknown>;
}
export type FormingEngine =
  'planar-ribs' | 'developable-slats' | 'non-developable-segmentation' | 'printing-tools';
