import { Component, Suspense, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei/core/OrbitControls';
import { GizmoHelper } from '@react-three/drei/core/GizmoHelper';
import { GizmoViewport } from '@react-three/drei/core/GizmoViewport';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { BuildResult, MeshData, PlanarPart } from '../geometry/types';
import { extrude } from '../geometry/sections';
import { bounds } from '../geometry/math';
import { useStore } from '../state/store';
import StationContours from './StationContours';

class ViewportBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="viewport-error">
        The 3D view requires WebGL. Profile editing and the 2D Parts workspace are still available.
      </div>
    ) : (
      this.props.children
    );
  }
}
function Geometry({
  data,
  color,
  opacity = 1,
  wireframe = false,
  flat = false,
}: {
  data: MeshData;
  color: string;
  opacity?: number;
  wireframe?: boolean;
  flat?: boolean;
}) {
  const geometry = useMemo(() => {
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(data.vertices.flat(), 3));
    g.setIndex(data.triangles.flat());
    if (flat) {
      const original = g;
      g = g.toNonIndexed();
      original.dispose();
    }
    g.computeVertexNormals();
    return g;
  }, [data, flat]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={0.72}
        metalness={0.02}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity === 1}
        side={THREE.DoubleSide}
        wireframe={wireframe}
      />
    </mesh>
  );
}
function Part({
  part,
  selected,
  wireframe,
}: {
  part: PlanarPart;
  selected: boolean;
  wireframe: boolean;
}) {
  const data = useMemo(() => extrude(part.contours, part.frame, part.thickness), [part]);
  return (
    <Geometry
      data={data}
      color={part.issues.length ? '#c17b5b' : selected ? '#9a82c4' : '#cdbd9c'}
      wireframe={wireframe}
      flat
    />
  );
}
function Scene({ result, onSelectStation }: { result: BuildResult; onSelectStation: () => void }) {
  const { view, showRings, showStations, wireframe, isolate, ribIndex, resetKey } = useStore();
  const controls = useRef<OrbitControlsImpl>(null),
    { camera } = useThree();
  const box = useMemo(
    () =>
      result.outer.vertices.length
        ? bounds(result.outer.vertices)
        : { min: [-100, -100, 0], max: [100, 100, 340], size: [200, 200, 340] },
    [result.outer],
  );
  const initial = useRef(false);
  useEffect(() => {
    if (initial.current && resetKey === 0) return;
    const center = new THREE.Vector3(
      ...(box.min.map((v, i) => (v + box.max[i]) / 2) as [number, number, number]),
    );
    const span = Math.max(...box.size, 100);
    camera.up.set(0, 0, 1);
    camera.position.copy(center).add(new THREE.Vector3(span * 1.45, -span * 2.05, span * 1.05));
    camera.lookAt(center);
    if (controls.current) {
      controls.current.target.copy(center);
      controls.current.update();
    }
    initial.current = true;
    // Geometry edits preserve the user's camera; Reset view explicitly reframes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, resetKey]);
  return (
    <>
      <color attach="background" args={['#f1f0ec']} />
      <ambientLight intensity={1.25} />
      <hemisphereLight args={['#fff9ed', '#aaa6b4', 1.8]} />
      <directionalLight position={[350, -400, 700]} intensity={3.0} />
      <directionalLight position={[-300, 100, 250]} intensity={1.5} />
      <gridHelper
        args={[1200, 24, '#c9c7c0', '#dedcd5']}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, box.min[2] - 2]}
      />
      {view === 'form' && <Geometry data={result.outer} color="#b5a3cd" wireframe={wireframe} />}
      {view === 'surfaces' && (
        <>
          <Geometry data={result.outer} color="#a990c4" opacity={0.24} wireframe={wireframe} />
          {result.inner && (
            <Geometry data={result.inner} color="#758f92" opacity={0.5} wireframe={wireframe} />
          )}
        </>
      )}
      {view === 'ribs' &&
        result.ribs.map(
          (part, i) =>
            (!isolate || i === ribIndex) && (
              <Part
                key={part.id}
                part={part}
                selected={isolate || i === ribIndex}
                wireframe={wireframe}
              />
            ),
        )}
      {showRings &&
        view !== 'form' &&
        !isolate &&
        result.rings.map((part) => (
          <Part key={part.id} part={part} selected={false} wireframe={wireframe} />
        ))}
      {showStations && !isolate && <StationContours onSelectStation={onSelectStation} />}
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minDistance={10}
        maxDistance={10000}
      />
      <GizmoHelper alignment="bottom-right" margin={[50, 65]}>
        <GizmoViewport axisColors={['#b37879', '#819b7a', '#9586b6']} labelColor="#fff" />
      </GizmoHelper>
    </>
  );
}
export default function Viewport({
  result,
  onSelectStation,
}: {
  result: BuildResult | null;
  onSelectStation: () => void;
}) {
  return (
    <ViewportBoundary>
      <Canvas
        camera={{ position: [550, -750, 500], up: [0, 0, 1], fov: 38, near: 0.1, far: 20000 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          {result && <Scene result={result} onSelectStation={onSelectStation} />}
        </Suspense>
      </Canvas>
    </ViewportBoundary>
  );
}
