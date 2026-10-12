# Geometry contracts

## Coordinates and profiles

The model uses millimeters in a right-handed XYZ system; Z is elevation. Profile IDs are stable. Stations are sorted by elevation and must be separated by at least 0.1 mm. Profile coordinates are not screen pixels.

Each section is parameterized by angle. Its local radial seed is `radius × (1 + amplitude × cos(lobes × angle))`. A periodic Catmull-Rom displacement field through 12 editable XY handles modifies that seed. XY scaling, rotation in degrees, and center translation follow, in that order. Zero displacements and zero modulation yield a sampled ellipse (or circle).

Between stations, cubic Hermite interpolation operates on corresponding angular samples. Shared finite-difference tangents provide C1 continuity in elevation. The interpolated surface is sampled into rings; each adjacent quad uses a consistent diagonal. Earcut triangulates the end caps. A circular cylinder is therefore polygonally approximated around its perimeter while its axial section through sampled cardinal vertices has exact requested dimensions.

Default resolution: 96 angular samples, 8 vertical steps per station span. Angular correspondence is preserved when stations rotate; excessive rotation can collapse or cross intermediate sections and will be reported when detected by sampled validation.

## Planar ribs

One rib count represents **one radial piece**. At angle `a`, a rib frame is:

```
origin = [radialOriginX, radialOriginY, 0]
u      = [cos(a), sin(a), 0]
v      = [0, 0, 1]
normal = [sin(a), -cos(a), 0]
world  = origin + u × radialCoordinate + v × elevation
```

The fixed frame intersects all triangles of the capped loft. Intersections are assembled into closed loops. Endpoint welding uses a spatial search within 0.00001 mm, including adjacent quantization cells. Coplanar internal triangle edges cancel. Ambiguous/open contour graphs fail closed instead of inventing a contour.

Loops are classified by containment parity, preserving holes and separate islands. Polygon clipping subtracts the inner volume section and clips the result to the nonnegative radial half-plane. Full 360° distributions exclude the duplicated last direction; partial sweeps include both endpoints. All ribs remain in their fixed plane regardless of profile translation or rotation.

For outer-only mode, the inner section is the outer section translated inward by the requested radial depth before subtraction. This defines a radial band even when no independent inner surface exists. It is not a normal offset operation.

Each 2D part is extruded by half the sheet thickness on either side of its plane. Its **mid-plane contour** is planar; a solid sheet naturally has thickness. The same contour data drives both the SVG preview and Three.js visualization.

## Inner geometry and validation

Approximate offset mode contracts sampled points toward their section centroid by the given radial amount. Radius collapse is an error. Independent mode lofts a separate station set. Common end elevations are required so both solids can be compared over the full height.

Containment is checked at all inner and outer mesh elevations and their midpoints. Depth is sampled at 79 elevations per rib. Self-intersection checks apply to sampled profile loops and ring openings. Invalid profile and ambiguous section failures remove the part assembly and leave an explanatory error. Geometry diagnostics are surfaced in the status panel.

These checks deliberately do not imply a continuous proof of surface validity. Small features below sampling resolution, between-sample intersections, material bend behavior, and collisions between finite-thickness ribs require additional fabrication validation. `fabricationReady` is always false in Build 01.

## Rings and joints

Each horizontal ring takes a planar section of the actual outer triangle mesh at its requested elevation. A radially contracted boundary defines its opening. Thickness is centered on its elevation; end collisions are rejected.

Ring contours are transformed into each rib's radial/perpendicular XY basis. A line scan intersects their material intervals with the rib's material interval at that elevation. Each overlap records the rib and ring IDs, Z, radial endpoints, nominal slot width, and an explicitly unset clearance. These are joint **candidates**, not cut notches. No fit tolerance or assembly direction is assumed.

## Worker and extension boundaries

`buildProject(project)` is deterministic and returns serializable meshes, planar parts, dimensions, joint candidates, and issues. It imports no rendering or state library. UI edits are debounced for 65 ms before a worker request. Request IDs prevent stale results replacing newer edits.

Future exporters must consume validated planar contours and preserve millimeters. Future slat, segmentation, and printing-tool engines must retain their own geometry contracts; they must not reinterpret these planar ribs as developable or twisted strips.
