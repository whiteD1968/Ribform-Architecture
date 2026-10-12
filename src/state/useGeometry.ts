import { useEffect, useRef, useState } from 'react';
import type { BuildResult, Project } from '../geometry/types';
export function useGeometry(project: Project) {
  const worker = useRef<Worker | null>(null),
    sequence = useRef(0);
  const [state, setState] = useState<{
    result: BuildResult | null;
    elapsed: number;
    busy: boolean;
  }>({ result: null, elapsed: 0, busy: true });
  useEffect(() => {
    const w = new Worker(new URL('../geometry/worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (e: MessageEvent<{ id: number; result: BuildResult; elapsed: number }>) => {
      if (e.data.id === sequence.current)
        setState({ result: e.data.result, elapsed: e.data.elapsed, busy: false });
    };
    w.onerror = () =>
      setState({
        result: {
          outer: { vertices: [], triangles: [] },
          ribs: [],
          rings: [],
          notches: [],
          dimensions: [0, 0, 0],
          fabricationReady: false,
          issues: [
            {
              severity: 'error',
              code: 'worker',
              message: 'Geometry worker could not run. Reload the application.',
            },
          ],
        },
        elapsed: 0,
        busy: false,
      });
    return () => {
      w.terminate();
      worker.current = null;
    };
  }, []);
  useEffect(() => {
    const id = ++sequence.current;
    setState((s) => ({ ...s, busy: true }));
    const timer = setTimeout(() => worker.current?.postMessage({ id, project }), 65);
    return () => clearTimeout(timer);
  }, [project]);
  return state;
}
