# RIBFORM / Build 01

A working browser-based parametric studio for lofted architectural forms and planar radial ribs. All geometric coordinates and dimensions are **millimeters**, with **Z up**.

## Run locally

Requires Node.js 22.12+ (tested with Node 24).

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. To verify or preview the production build:

```sh
npm run check
npm run preview
```

The application is entirely local. No backend, API key, CAD service, or external font request is required. The current project autosaves in browser local storage. **Save project** downloads editable JSON; **Open** restores a JSON project. Browser storage is specific to the hostname and port.

## Working features

- React, TypeScript, Vite, React Three Fiber / Three.js, and Zustand.
- Five-station Clove pendant example, 32 individual radial ribs, two support rings.
- Add/remove profile stations; edit elevation, radius, independent XY scales, rotation, translation, and Clove modulation.
- Select a labeled horizontal station contour directly on the 3D form; the tree and XY editor follow the same station.
- Choose 4–64 control points per profile, then drag them in the XY editor; keyboard arrow-key control is also supported. Changing the count resamples existing edits, with possible shape simplification when reducing points.
- Cubic interpolation between corresponding angular samples and a capped triangulated loft.
- Outer-only, explicitly approximate radial inner offset, and independently editable inner surfaces.
- Triangle/plane section extraction into closed contours, holes and disconnected components; positive radial half-plane clipping.
- Real extruded sheet geometry, with configurable rib count, origin, orientation, angular sweep, thickness, and depth.
- Horizontal support rings with radial width and elevation controls; calculated ring/rib overlap intervals for future joints.
- Form, reference-surface, rib, wireframe, ring visibility, individual-rib isolation, orbit/pan/zoom/reset modes.
- Actual 2D rib contour library, model dimensions, parameter history, save/open, and local autosave.
- Geometry calculations run in a dedicated worker and are independent of React and Three.js.

## Prototype boundaries

**This build is not fabrication-ready.** There is no SVG/DXF cutting export. Saving JSON saves design parameters, not manufacturing files.

- Offsets shrink section rays toward the section centroid. They are not true 3D normal offsets. Ring widths use the same radial construction, not a constant normal band width.
- In outer-only mode, rib depth is measured inward along the rib's radial coordinate, using a shifted section difference. Inner-surface modes derive depth from the two surfaces instead.
- The loft is a finite triangle mesh. Intersections are calculated on that mesh; they are not exact sections of an analytic spline surface.
- Validity checks detect self-intersections in sampled profiles, invalid section topology, sampled inner/outer containment, and sampled insufficient rib depth. They are not a continuous mesh-intersection proof or a manufacturing certificate.
- Inner and outer surfaces must share their top and bottom elevations. Their intermediate station counts and positions may differ.
- Rings currently overlap ribs. Joint locations and nominal material thickness are calculated, but mating notch contours, kerf, clearances, fit, and assembly have not been validated.
- The rib axis is vertical Z. Arbitrarily tilted axes, nonuniform custom rib distributions, and variable material thickness are deferred.
- No nesting, perforations, physical lighting components, structural calculations, or cut-ready output is included.

## Testing

`npm test` runs geometric regression tests against analytic cylinders, irregular profiles, holes, and disconnected sections. Checks cover deterministic changes, dimensions, loft continuity, capped topology, radial intersections, inner/outer containment, planarity, extruded thickness, insufficient depth, and Clove joint candidates.

Browser smoke checks cover startup, interactive profile edits, control-point dragging, station addition/removal, inner modes, part inspection, and invalid geometry feedback. See [geometry design](docs/GEOMETRY.md) and [Build 01 status](docs/BUILD-01.md).

## Source layout

- `src/geometry/`: pure geometry types, generation, validation, intersections, extrusion, and worker entry.
- `src/state/`: project state, undo/redo, browser persistence, and worker lifecycle.
- `src/components/`: viewport, SVG profile editor, fields, and 2D parts.
- `src/modules/`: future extension contracts and reserved module boundaries.

Production builds produce the static `dist/` directory. Deployment is not configured in Build 01.
