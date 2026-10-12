import type { BuildResult, MultiPolygon } from '../geometry/types';
import { useStore } from '../state/store';
export function ContourPreview({ contours }: { contours: MultiPolygon }) {
  const points = contours.flat(2);
  if (!points.length) return <div className="empty-part">No contour</div>;
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]),
    minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys),
    pad = 12;
  return (
    <svg
      viewBox={`${minX - pad} ${-maxY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      aria-label="Planar part contour"
    >
      <path
        d={contours
          .flatMap((poly) =>
            poly.map(
              (loop) => loop.map(([u, v], i) => `${i ? 'L' : 'M'}${u},${-v}`).join(' ') + ' Z',
            ),
          )
          .join(' ')}
        fill="#cbb992"
        fillRule="evenodd"
        stroke="#928060"
        strokeWidth={1}
      />
    </svg>
  );
}
export default function Parts({ result }: { result: BuildResult | null }) {
  const set = useStore((s) => s.set),
    ribIndex = useStore((s) => s.ribIndex);
  return (
    <div className="parts-workspace">
      <div className="workspace-title">
        <span className="eyebrow">PART LIBRARY</span>
        <h1>One form. Planar pieces.</h1>
        <p>Actual section contours in millimeters. Select a rib to inspect it in 3D.</p>
      </div>
      <div className="parts-grid">
        {result?.ribs.map((rib, i) => (
          <button
            key={rib.id}
            className={`part-card ${ribIndex === i ? 'selected' : ''}`}
            onClick={() => set({ ribIndex: i, isolate: true, view: 'ribs', tab: 'design' })}
          >
            <ContourPreview contours={rib.contours} />
            <div>
              <strong>R{String(i + 1).padStart(2, '0')}</strong>
              <span>{(rib.area / 100).toFixed(1)} cm²</span>
            </div>
          </button>
        ))}
      </div>
      <p className="muted">
        Cut-file export is deferred. These contours have not been certified for fabrication.
      </p>
    </div>
  );
}
