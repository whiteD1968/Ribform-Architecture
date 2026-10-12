import { useMemo } from 'react';
import { Line } from '@react-three/drei/core/Line';
import { Html } from '@react-three/drei/web/Html';
import { profilePoint, sortedProfiles, stationContour } from '../geometry/profiles';
import { useStore } from '../state/store';
import type { Profile } from '../geometry/types';

function Station({
  profile,
  index,
  active,
  onSelect,
}: {
  profile: Profile;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  const around = useStore((s) => s.project.resolution.around);
  const surface = useStore((s) => s.surface);
  const points = useMemo(() => {
    const contour = stationContour(profile, around);
    return [...contour, contour[0]];
  }, [profile, around]);
  const handles = useMemo(
    () =>
      profile.controls.map((_, i) => {
        const [x, y] = profilePoint(profile, (i / profile.controls.length) * Math.PI * 2);
        return [x, y, profile.z] as [number, number, number];
      }),
    [profile],
  );
  const anchor = points.reduce((best, point) => (point[0] > best[0] ? point : best), points[0]);
  return (
    <group>
      <Line
        points={points}
        color={active ? '#7942ad' : '#94849f'}
        lineWidth={active ? 2.5 : 1}
        transparent
        opacity={active ? 1 : 0.5}
        depthTest={false}
        depthWrite={false}
        renderOrder={10}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      />
      {active &&
        handles.map((position, i) => (
          <mesh key={i} position={position} renderOrder={11}>
            <sphereGeometry args={[1.7, 8, 8]} />
            <meshBasicMaterial color="#7942ad" depthTest={false} depthWrite={false} />
          </mesh>
        ))}
      <Html position={anchor} zIndexRange={[20, 0]} style={{ pointerEvents: 'auto' }}>
        <button
          className={`station-contour-label ${active ? 'active' : ''}`}
          aria-label={`Select ${surface} station ${index + 1} contour at ${profile.z} mm`}
          aria-pressed={active}
          onClick={onSelect}
        >
          S{String(index + 1).padStart(2, '0')} <span>{profile.z} mm</span>
        </button>
      </Html>
    </group>
  );
}

export default function StationContours({ onSelectStation }: { onSelectStation: () => void }) {
  const { project, surface, selected, set } = useStore();
  const profiles = sortedProfiles(project[surface]);
  const activeId = profiles.some((p) => p.id === selected) ? selected : profiles[0].id;
  return (
    <group>
      {profiles.map((profile, index) => (
        <Station
          key={`${surface}-${profile.id}`}
          profile={profile}
          index={index}
          active={profile.id === activeId}
          onSelect={() => {
            set({ selected: profile.id, tab: 'profiles', isolate: false });
            onSelectStation();
          }}
        />
      ))}
    </group>
  );
}
