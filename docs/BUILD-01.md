# Build 01 status

## Implemented

Interactive profile/loft studio, independent geometry engine, multi-station editing and XY handles, the Clove sample, all three inner-surface modes, radial plane sections and thickness extrusion, support rings, ring/rib intersection data, viewport modes, planar part previews, dimensions, diagnostics, undo/redo, local autosave, JSON save/open, and regression tests.

## Partial / explicitly approximate

- Generated inner surfaces use radial contraction rather than a true 3D normal offset.
- Validity and minimum-depth checks operate at a documented sampling resolution.
- Rings are geometric reference components. Joint overlaps and thickness are calculated, but notches remain uncut and unvalidated.
- Axis control supports XY translation and angular orientation around vertical Z. Tilted axes are not implemented.
- Distribution is uniform over a configurable angular sweep.

## Deferred

True normal offsets; fabrication clearance and kerf; notch cutting and fit verification; SVG/DXF layers; stock/material libraries; grain-aware and free-orientation nesting; perforation patterns; embedded labels; assembly documentation; metaballs and contour stacking; Rhino/CAD/mesh import; developable slats; non-developable segmentation; forming tools; lighting hardware, sourcing and budgets; architectural wall generators.

All future features have module boundaries under `src/modules`. Build 01 does not present future modules as functional tools.

## Acceptance observations

- Tested with Node 24, Vitest, strict TypeScript, and a Vite production build.
- Clove defaults: five stations, 32 radial pieces, 3 mm thickness, two rings, 64 joint candidates.
- Browser changes to rib count, station radius, and dragged control points visibly update the model envelope and/or piece count.
- Station addition/removal works; approximate and independent inner modes expose their appropriate controls.
- Invalid inner geometry produces an error and suppresses the part assembly.
- Fabrication readiness is false for every Build 01 project.
