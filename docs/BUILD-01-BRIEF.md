# RIBFORM — Build 01: Parametric Geometry & Planar Rib Generator

You are the lead developer of RIBFORM, a web-based parametric design and digital fabrication application for architectural lighting, wall systems, and sheet-based architectural products.

**Repository:** `whiteD1968/Ribform-Architecture`

## Primary Objective

Initialize the application and produce a functional, interactive V1 prototype, prioritizing accurate parametric geometry and planar rib generation.

This must be a working design application, not simply a static interface or conceptual mockup.

## 1. Application Architecture

Use:
- React + TypeScript + Vite
- Three.js / React Three Fiber for interactive 3D visualization
- Zustand or equivalent for project state
- A modular geometry engine independent from the UI
- Millimeters as the authoritative geometric unit

Create a clean, contemporary designer-focused interface with a restrained neutral palette, generous 3D workspace, accessible parameter controls, and subtle purple accents.

Organize the interface into a left-hand design tree, central interactive viewport, right-hand parameter editor, and workspace navigation.

## 2. Parametric Profile Generator

Create a geometry generator using multiple XY profiles distributed along the Z-axis.

Each profile must support:
- Adjustable elevation
- Circle radius and independent X/Y scale
- Editable control points
- Clove-style radial modulation
- Rotation and center translation
- Smooth interpolation with adjacent profiles

Generate a lofted 3D surface through these profiles.

Provide a working multi-station profile editor with interactive control-point manipulation, numerical parameters, adding/removing stations, and real-time updates.

Include a sample Clove-style pendant project.

## 3. Outer and Inner Surface Systems

Implement three selectable modes:

1. Outer surface only
2. Outer surface with a generated inner offset
3. Outer surface with an independently editable inner surface

For independent surfaces, provide separate profile controls.

For generated offsets, distinguish a true geometric offset from simple radial scaling. If robust offset geometry is not yet available, implement a clearly labeled approximate offset and prevent invalid fabrication export.

Detect invalid geometry, self-intersections, and insufficient rib depth.

## 4. Planar Rib Generator

This is the highest-priority geometry feature.

Generate radial planar ribs by intersecting the lofted geometry with fixed vertical planes distributed around a configurable center and axis.

The resulting components must be genuinely planar and suitable for extraction as 2D sheet-cutting contours.

Include controls for:
- Rib count
- Radial origin and orientation
- Rib distribution
- Material thickness
- Rib depth
- Inner and outer contour relationships

Bulging and irregular outlines are acceptable because the ribs remain planar.

Do not confuse a curved planar rib outline with a physically twisted slat.

Render the actual generated ribs as 3D components with material thickness.

## 5. Structural Rings

Add an initial system for horizontal stabilizing rings with user-defined Z positions.

Create the required geometric data structures for accurately calculated interlocking notches.

Only label notches fabrication-ready when their geometry, material thickness, and tolerances have been validated.

## 6. Geometry and Interface Modes

Provide working viewport controls for:
- Display complete lofted form
- Display outer/inner reference surfaces
- Display structural ribs
- Isolate individual ribs
- Display wireframe
- Toggle structural rings
- Orbit, pan, zoom, and reset view

Show dimensions and model statistics.

## 7. Future Modules

Establish clean interfaces and directories for subsequent development:

- Rib light-filter perforations and patterns
- Material libraries and sheet stock
- Grain-aware nesting for plywood
- Free-orientation nesting for appropriate paper and metal stock
- SVG/DXF export with cut, engrave, and mark layers
- Embedded part labels
- Assembly sequencing and documentation
- Metaball geometry, supporting radial ribs and contour stacking
- Imported Rhino/CAD/mesh geometry
- Separate developable/bendable slat engine
- 3D-printable forming tools
- Separate non-developable segmentation engine
- Lighting hardware/material sourcing and budget intelligence
- Architectural wall and surface generators

Do not attempt to fully implement these future modules during Build 01.

## 8. Testing and Validation

Create tests for:
- Profile generation and interpolation
- Reproducibility of parameter changes
- Loft continuity
- Radial section extraction
- Planarity of rib components
- Inner/outer contour validity
- Correct units and model dimensions

Keep geometry processing deterministic and separate from visualization.

Do not represent placeholder geometry as fabrication-ready.

## 9. Implementation Requirements

1. Inspect the connected repository.
2. Initialize the application if it is empty.
3. Implement the functional geometry engine and interface.
4. Create the example Clove-style pendant project.
5. Add tests and run the available checks.
6. Verify the application starts successfully.
7. Commit and push changes to GitHub, preferably through a reviewable feature branch.
8. Report which features are fully implemented, partially implemented, or deferred.

Do not stop after creating scaffolding. Implement and test the functional first milestone.

## Final Deliverable

A working browser-based RIBFORM V1 prototype in which I can manipulate multiple Z profiles, generate an outer lofted volume, select inner-surface modes, adjust radial ribs, and inspect the resulting geometry interactively.

Prioritize geometric accuracy, interface clarity, and extensibility for fabrication tools.
