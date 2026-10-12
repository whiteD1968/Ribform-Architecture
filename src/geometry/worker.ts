import { buildProject } from './build';
import type { Project } from './types';
self.onmessage = (event: MessageEvent<{ id: number; project: Project }>) => {
  const start = performance.now();
  self.postMessage({
    id: event.data.id,
    result: buildProject(event.data.project),
    elapsed: performance.now() - start,
  });
};
