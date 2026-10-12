import { useRef, useState } from 'react';
import { profilePoint, sampleProfile } from '../geometry/profiles';
import type { Profile, Vec2 } from '../geometry/types';
import { useStore } from '../state/store';

export default function ProfileEditor({
  profile,
  large = false,
}: {
  profile: Profile;
  large?: boolean;
}) {
  const update = useStore((s) => s.updateProfile),
    svg = useRef<SVGSVGElement>(null),
    dragging = useRef<number | null>(null);
  const [active, setActive] = useState(0),
    extent = useRef(250);
  const loop = sampleProfile(profile, 96),
    needed = Math.max(120, ...loop.flat().map(Math.abs)) * 1.22;
  if (dragging.current === null) extent.current = needed;
  const size = extent.current;
  const path = loop.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${-y}`).join(' ') + ' Z';
  const handles = profile.controls.map((_, i) =>
    profilePoint(profile, (i / profile.controls.length) * Math.PI * 2),
  );
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragging.current === null || !svg.current) return;
    const matrix = svg.current.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    const x = point.x - profile.center[0],
      y = -point.y - profile.center[1],
      a = (-profile.rotation * Math.PI) / 180;
    const local: Vec2 = [
      (x * Math.cos(a) - y * Math.sin(a)) / profile.scaleX,
      (x * Math.sin(a) + y * Math.cos(a)) / profile.scaleY,
    ];
    const k = dragging.current,
      angle = (k / profile.controls.length) * Math.PI * 2,
      r = profile.radius * (1 + profile.amplitude * Math.cos(profile.lobes * angle));
    const controls = profile.controls.map((p) => [...p] as Vec2);
    controls[k] = [
      (local[0] - r * Math.cos(angle)) / profile.radius,
      (local[1] - r * Math.sin(angle)) / profile.radius,
    ];
    update(profile.id, { controls });
  };
  const end = () => {
    dragging.current = null;
  };
  return (
    <div className={`profile-editor ${large ? 'large' : ''}`}>
      <svg
        ref={svg}
        viewBox={`${-size} ${-size} ${size * 2} ${size * 2}`}
        aria-label="Interactive XY profile editor"
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
      >
        <defs>
          <pattern
            id={large ? 'grid-large' : 'grid-small'}
            width={50}
            height={50}
            patternUnits="userSpaceOnUse"
          >
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e6e2ec" strokeWidth={size / 220} />
          </pattern>
        </defs>
        <rect
          x={-size}
          y={-size}
          width={size * 2}
          height={size * 2}
          fill={`url(#${large ? 'grid-large' : 'grid-small'})`}
        />
        <path
          d={`M ${-size} 0 H ${size} M 0 ${-size} V ${size}`}
          stroke="#d4cddd"
          strokeWidth={size / 160}
          strokeDasharray={`${size / 35} ${size / 35}`}
        />
        <path d={path} fill="#9c7bc518" stroke="#9675b8" strokeWidth={size / 80} />
        {handles.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={-y}
            r={size / (large ? 45 : 28)}
            fill={active === i ? '#7954a3' : '#fff'}
            stroke="#9574b6"
            strokeWidth={size / 110}
            tabIndex={0}
            role="button"
            aria-label={`Control point ${i + 1}`}
            onKeyDown={(e) => {
              const axes: Record<string, Vec2> = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, 1],
                ArrowDown: [0, -1],
              };
              const d = axes[e.key];
              if (!d) return;
              e.preventDefault();
              const controls = structuredClone(profile.controls);
              controls[i][0] += d[0] / profile.radius;
              controls[i][1] += d[1] / profile.radius;
              update(profile.id, { controls });
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              dragging.current = i;
              setActive(i);
              svg.current?.setPointerCapture(e.pointerId);
            }}
          />
        ))}
      </svg>
      <div className="profile-editor-caption">
        <span>XY · Z {profile.z.toFixed(0)} mm</span>
        <span>Drag a point to shape</span>
      </div>
    </div>
  );
}
