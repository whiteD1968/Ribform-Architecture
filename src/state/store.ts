import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile, Project } from '../geometry/types';
import { cloveProject } from '../geometry/build';
type View = 'ribs' | 'form' | 'surfaces';
interface Store {
  project: Project;
  selected: string;
  surface: 'outer' | 'inner';
  tab: 'design' | 'profiles' | 'parts';
  view: View;
  wireframe: boolean;
  showRings: boolean;
  showStations: boolean;
  isolate: boolean;
  ribIndex: number;
  resetKey: number;
  past: Project[];
  future: Project[];
  edit: (fn: (p: Project) => void) => void;
  updateProfile: (id: string, patch: Partial<Profile>) => void;
  set: (patch: Partial<Store>) => void;
  undo: () => void;
  redo: () => void;
  load: (p: Project) => void;
}
export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      project: cloveProject(),
      selected: '03',
      surface: 'outer',
      tab: 'design',
      view: 'ribs',
      wireframe: false,
      showRings: true,
      showStations: true,
      isolate: false,
      ribIndex: 0,
      resetKey: 0,
      past: [],
      future: [],
      edit: (fn) => {
        const current = get().project,
          p = structuredClone(current);
        fn(p);
        set({ project: p, past: [...get().past.slice(-29), current], future: [] });
      },
      updateProfile: (id, patch) =>
        get().edit((p) => {
          const profile = p[get().surface].profiles.find((x) => x.id === id);
          if (profile) Object.assign(profile, patch);
        }),
      set: (patch) => set(patch),
      undo: () => {
        const s = get();
        if (s.past.length)
          set({
            project: s.past.at(-1)!,
            past: s.past.slice(0, -1),
            future: [s.project, ...s.future],
          });
      },
      redo: () => {
        const s = get();
        if (s.future.length)
          set({ project: s.future[0], past: [...s.past, s.project], future: s.future.slice(1) });
      },
      load: (p) =>
        set({
          project: p,
          selected: p.outer.profiles[0].id,
          surface: 'outer',
          past: [],
          future: [],
          ribIndex: 0,
        }),
    }),
    { name: 'ribform-build-01', partialize: (s) => ({ project: s.project }), version: 1 },
  ),
);
