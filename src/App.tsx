import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Box,
  Check,
  ChevronDown,
  Circle,
  CircleHelp,
  Copy,
  Focus,
  Grid2X2,
  Layers3,
  Maximize,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';
import { useStore } from './state/store';
import { useGeometry } from './state/useGeometry';
import { cloveProject, nextProfile, validateProject } from './geometry/build';
import { resizeProfileControls, sortedProfiles, validateProfiles } from './geometry/profiles';
import type { Project } from './geometry/types';
import Viewport from './components/Viewport';
import ProfileEditor from './components/ProfileEditor';
import Parts, { ContourPreview } from './components/Parts';
import { Field, Slider } from './components/Fields';

export default function App() {
  const s = useStore(),
    { result, elapsed, busy } = useGeometry(s.project),
    p = s.project;
  const [inspector, setInspector] = useState<'profile' | 'structure'>('structure'),
    [showIssues, setShowIssues] = useState(false),
    [notice, setNotice] = useState(''),
    [help, setHelp] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const profiles = sortedProfiles(p[s.surface]),
    profile = profiles.find((x) => x.id === s.selected) ?? profiles[0];
  const errors = result?.issues.filter((i) => i.severity === 'error') ?? [],
    warnings = result?.issues.filter((i) => i.severity === 'warning') ?? [];
  const activeRib = result?.ribs[Math.min(s.ribIndex, (result?.ribs.length ?? 1) - 1)];
  useEffect(() => {
    if (s.ribIndex >= p.ribs.count) s.set({ ribIndex: p.ribs.count - 1 });
    if (s.surface === 'inner' && p.innerMode !== 'independent')
      s.set({ surface: 'outer', selected: p.outer.profiles[0].id });
  }, [p.ribs.count, p.innerMode, p.outer.profiles, s.ribIndex, s.surface, s.set]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'z' &&
        !(e.target instanceof HTMLInputElement)
      ) {
        e.preventDefault();
        if (e.shiftKey) useStore.getState().redo();
        else useStore.getState().undo();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const update = (patch: Parameters<typeof s.updateProfile>[1]) =>
    s.updateProfile(profile.id, patch);
  const rib = (patch: Partial<Project['ribs']>) => s.edit((p) => Object.assign(p.ribs, patch));
  const save = () => {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }),
      ),
      a = document.createElement('a');
    a.href = url;
    a.download = 'ribform-project.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Project saved as JSON.');
  };
  const loadFile = async (f: File) => {
    try {
      if (f.size > 2_000_000) throw new Error('Project file is too large.');
      const project = JSON.parse(await f.text()) as Project;
      validateProject(project);
      validateProfiles(project.outer);
      validateProfiles(project.inner);
      s.load(project);
      setNotice('Project loaded.');
    } catch (e) {
      setNotice(`Unable to load: ${e instanceof Error ? e.message : 'Invalid project file.'}`);
    }
  };
  const addStation = () => {
    const newProfile = nextProfile(p[s.surface]);
    s.edit((p) => p[s.surface].profiles.push(newProfile));
    s.set({ selected: newProfile.id });
  };
  return (
    <div className="app-shell">
      <header className="app-header">
        <a href="#" className="brand" aria-label="Ribform home" onClick={(e) => e.preventDefault()}>
          <span className="brand-symbol">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          RIBFORM<span className="build-tag">STUDIO / 01</span>
        </a>
        <div className="project-name">
          <span className="project-dot" />
          {p.name}
          <span className="local-label">LOCAL</span>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            disabled={!s.past.length}
            onClick={s.undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!s.future.length}
            onClick={s.redo}
          >
            <Redo2 size={17} />
          </button>
          <span className="divider" />
          <button className="text-button" onClick={() => file.current?.click()}>
            <ArrowUpFromLine size={15} />
            Open
          </button>
          <button className="primary-button" onClick={save}>
            <ArrowDownToLine size={15} />
            Save project
          </button>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </header>
      <div className="studio-body">
        <aside className="design-tree">
          <div className="tree-heading">
            <span className="eyebrow">PROJECT EXPLORER</span>
            <Layers3 size={15} />
          </div>
          <button
            className="project-root"
            onClick={() => {
              s.set({ tab: 'design' });
              setInspector('structure');
            }}
          >
            <Box size={18} />
            <div>
              <strong>Clove pendant</strong>
              <small>Parametric lighting</small>
            </div>
            <ChevronDown size={14} />
          </button>
          <div className="tree-section-label">GEOMETRY</div>
          <button
            className={`tree-item ${inspector === 'profile' ? 'active' : ''}`}
            onClick={() => {
              setInspector('profile');
              s.set({ surface: 'outer', selected: p.outer.profiles[0].id });
            }}
          >
            <Layers3 size={16} />
            <span>Outer profiles</span>
            <small>{p.outer.profiles.length}</small>
          </button>
          <div className="station-tree">
            {sortedProfiles(p.outer).map((station, i) => (
              <button
                key={station.id}
                className={s.selected === station.id && s.surface === 'outer' ? 'selected' : ''}
                onClick={() => {
                  s.set({ selected: station.id, surface: 'outer' });
                  setInspector('profile');
                }}
              >
                <span className="station-node" />
                <span>Station {String(i + 1).padStart(2, '0')}</span>
                <small>{station.z} mm</small>
              </button>
            ))}
          </div>
          <button
            className={`tree-item ${s.surface === 'inner' ? 'active' : ''}`}
            disabled={p.innerMode !== 'independent'}
            onClick={() => {
              s.set({ surface: 'inner', selected: p.inner.profiles[0].id });
              setInspector('profile');
            }}
          >
            <Circle size={16} />
            <span>Inner profiles</span>
            <small>
              {p.innerMode === 'none'
                ? 'OFF'
                : p.innerMode === 'approximate'
                  ? 'AUTO'
                  : p.inner.profiles.length}
            </small>
          </button>
          <div className="tree-section-label">COMPONENTS</div>
          <button
            className={`tree-item ${inspector === 'structure' ? 'active' : ''}`}
            onClick={() => {
              setInspector('structure');
              s.set({ view: 'ribs', tab: 'design' });
            }}
          >
            <span className="rib-icon">|||</span>
            <span>Radial ribs</span>
            <small>{p.ribs.count}</small>
          </button>
          <button
            className="tree-item"
            onClick={() => {
              setInspector('structure');
              s.set({ showRings: !s.showRings });
            }}
          >
            <Circle size={16} />
            <span>Support rings</span>
            <small>{s.showRings ? p.rings.length : 'HIDDEN'}</small>
          </button>
          <div className="tree-section-label">WORKSPACE</div>
          <button
            className={`tree-item ${s.tab === 'parts' ? 'active' : ''}`}
            onClick={() => s.set({ tab: 'parts' })}
          >
            <Grid2X2 size={16} />
            <span>Planar part library</span>
          </button>
          <div className="tree-bottom">
            <div className="sample-card">
              <Sparkles size={19} />
              <span className="eyebrow">A STARTING POINT</span>
              <strong>Explore the Clove.</strong>
              <p>Five profiles. A continuous form. Endless variations.</p>
              <button
                onClick={() => {
                  s.load(cloveProject());
                  s.set({ resetKey: s.resetKey + 1, tab: 'design', isolate: false });
                  setNotice('Clove example restored.');
                }}
              >
                Reset example <RotateCcw size={13} />
              </button>
            </div>
            <button className="help-button" onClick={() => setHelp(true)}>
              <CircleHelp size={16} />
              Studio guide<span>?</span>
            </button>
          </div>
        </aside>
        <main className="workspace">
          <nav className="workspace-nav" aria-label="Workspace">
            <div>
              {(
                [
                  { id: 'design', label: 'Design', icon: Box },
                  { id: 'profiles', label: 'Profiles', icon: SlidersHorizontal },
                  { id: 'parts', label: 'Parts', icon: Grid2X2 },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  className={s.tab === tab.id ? 'active' : ''}
                  onClick={() => {
                    s.set({ tab: tab.id });
                    if (tab.id === 'profiles') setInspector('profile');
                  }}
                >
                  <tab.icon size={15} />
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="units-badge">
              MILLIMETERS <span>mm</span>
            </span>
          </nav>
          <div className="workspace-content">
            {s.tab === 'parts' ? (
              <Parts result={result} />
            ) : (
              <>
                <div className="viewport-wrap">
                  <Viewport result={result} onSelectStation={() => setInspector('profile')} />
                  <div className="viewport-title">
                    <span className="eyebrow">FORM STUDY / 001</span>
                    <h1>
                      {s.isolate
                        ? `Rib ${String(s.ribIndex + 1).padStart(2, '0')}`
                        : 'Clove pendant'}
                    </h1>
                    <p>
                      {s.isolate
                        ? 'An individual planar section'
                        : 'A study in rhythm, light & form'}
                    </p>
                  </div>
                  <div className="viewport-badges">
                    <span className={errors.length ? 'error-pill' : 'status-pill'}>
                      <i />
                      {busy
                        ? 'Updating geometry'
                        : errors.length
                          ? 'Review geometry'
                          : 'Parametric model'}
                    </span>
                    <span className="prototype-pill">PROTOTYPE</span>
                  </div>
                  <div className="view-toolbar" role="group" aria-label="Viewport display">
                    <button
                      title="Toggle station contours"
                      aria-label="Toggle station contours"
                      aria-pressed={s.showStations}
                      className={s.showStations ? 'active' : ''}
                      onClick={() => s.set({ showStations: !s.showStations })}
                    >
                      <Circle size={16} />
                    </button>
                    {(
                      [
                        { id: 'ribs', label: 'Ribs', icon: Layers3 },
                        { id: 'form', label: 'Form', icon: Box },
                        { id: 'surfaces', label: 'Surfaces', icon: Copy },
                      ] as const
                    ).map((v) => (
                      <button
                        key={v.id}
                        className={s.view === v.id ? 'active' : ''}
                        onClick={() => s.set({ view: v.id })}
                      >
                        <v.icon size={15} />
                        {v.label}
                      </button>
                    ))}
                    <span className="divider" />
                    <button
                      title="Toggle wireframe"
                      aria-label="Toggle wireframe"
                      aria-pressed={s.wireframe}
                      className={s.wireframe ? 'active' : ''}
                      onClick={() => s.set({ wireframe: !s.wireframe })}
                    >
                      <Grid2X2 size={16} />
                    </button>
                    <button
                      title="Reset view"
                      aria-label="Reset view"
                      onClick={() => s.set({ resetKey: s.resetKey + 1 })}
                    >
                      <Maximize size={16} />
                    </button>
                  </div>
                  <div className="viewport-footer">
                    <span>
                      Drag to orbit <b>·</b> Right-drag to pan <b>·</b> Scroll to zoom
                    </span>
                    <span>Z UP</span>
                  </div>
                  {s.isolate && (
                    <button className="exit-isolate" onClick={() => s.set({ isolate: false })}>
                      <X size={14} />
                      Show assembly
                    </button>
                  )}
                </div>
                {s.tab === 'profiles' && (
                  <div className="profile-workspace">
                    <div>
                      <span className="eyebrow">PROFILE WORKBENCH</span>
                      <h2>
                        {s.surface === 'outer' ? 'Outer' : 'Inner'} station · {profile.z} mm
                      </h2>
                      <p>
                        Drag the handles to edit this section. Use the inspector for precise
                        dimensions.
                      </p>
                      <select
                        aria-label="Active profile station"
                        value={profile.id}
                        onChange={(e) => s.set({ selected: e.target.value })}
                      >
                        {profiles.map((p, i) => (
                          <option key={p.id} value={p.id}>
                            Station {i + 1} — {p.z} mm
                          </option>
                        ))}
                      </select>
                      <button
                        className="text-button"
                        onClick={() => update({ controls: profile.controls.map(() => [0, 0]) })}
                      >
                        <RotateCcw size={14} />
                        Reset control points
                      </button>
                    </div>
                    <ProfileEditor
                      key={`${s.surface}-${profile.id}-${profile.controls.length}`}
                      profile={profile}
                      large
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <div className="model-stats">
            <div>
              <span>ENVELOPE</span>
              <strong>
                {result?.dimensions.map((v) => v.toFixed(0)).join(' × ') ?? '—'} <small>mm</small>
              </strong>
            </div>
            <div>
              <span>PLANAR RIBS</span>
              <strong>
                {result?.ribs.length ?? 0}
                <small> pieces</small>
              </strong>
            </div>
            <div>
              <span>MATERIAL</span>
              <strong>
                {p.ribs.thickness}
                <small> mm thick</small>
              </strong>
            </div>
            <div>
              <span>RINGS</span>
              <strong>
                {result?.rings.length ?? 0}
                <small> supports</small>
              </strong>
            </div>
          </div>
        </main>
        <aside className="inspector">
          <div className="inspector-heading">
            <div>
              <span className="eyebrow">PARAMETERS</span>
              <h2>{inspector === 'structure' ? 'Structure & form' : 'Profile station'}</h2>
            </div>
            <Settings2 size={18} />
          </div>
          <div className="inspector-tabs">
            <button
              className={inspector === 'structure' ? 'active' : ''}
              onClick={() => setInspector('structure')}
            >
              Structure
            </button>
            <button
              className={inspector === 'profile' ? 'active' : ''}
              onClick={() => setInspector('profile')}
            >
              Profiles
            </button>
          </div>
          <div className="inspector-scroll">
            {inspector === 'structure' ? (
              <>
                <section className="control-section">
                  <div className="section-title">
                    <h3>Radial ribs</h3>
                    <span className="tiny-badge">PLANAR</span>
                  </div>
                  <Slider
                    label="Rib count"
                    value={p.ribs.count}
                    min={4}
                    max={64}
                    onChange={(v) => rib({ count: Math.round(v) })}
                  />
                  <div className="field-pair">
                    <Field
                      label="Thickness"
                      value={p.ribs.thickness}
                      min={0.1}
                      max={30}
                      step={0.1}
                      onChange={(v) => rib({ thickness: v })}
                    />
                    <Field
                      label="Radial depth"
                      value={p.ribs.depth}
                      min={1}
                      max={200}
                      onChange={(v) => rib({ depth: v })}
                    />
                  </div>
                  <p className="field-note">
                    {p.innerMode === 'none'
                      ? 'Depth is measured inward along each radial section.'
                      : 'Depth follows the inner surface. Radial depth applies in outer-only mode.'}
                  </p>
                  <Slider
                    label="Orientation"
                    value={p.ribs.orientation}
                    min={0}
                    max={360}
                    unit="°"
                    onChange={(v) => rib({ orientation: v })}
                  />
                  <details>
                    <summary>
                      Distribution & validation <ChevronDown size={13} />
                    </summary>
                    <div className="field-pair">
                      <Field
                        label="Origin X"
                        value={p.ribs.origin[0]}
                        onChange={(v) => rib({ origin: [v, p.ribs.origin[1]] })}
                      />
                      <Field
                        label="Origin Y"
                        value={p.ribs.origin[1]}
                        onChange={(v) => rib({ origin: [p.ribs.origin[0], v] })}
                      />
                    </div>
                    <Field
                      label="Angular sweep"
                      value={p.ribs.sweep}
                      min={1}
                      max={360}
                      unit="°"
                      onChange={(v) => rib({ sweep: v })}
                    />
                    <Field
                      label="Minimum rib depth"
                      value={p.ribs.minDepth}
                      min={0.1}
                      max={100}
                      onChange={(v) => rib({ minDepth: v })}
                    />
                    <p className="field-note">
                      One count = one radial piece. Uniform spacing around the vertical Z axis.
                    </p>
                  </details>
                </section>
                <section className="control-section">
                  <h3>Surface relationship</h3>
                  <label className="select-label">
                    Inner boundary
                    <select
                      aria-label="Inner boundary"
                      value={p.innerMode}
                      onChange={(e) => {
                        s.edit((p) => {
                          p.innerMode = e.target.value as Project['innerMode'];
                        });
                        if (e.target.value !== 'independent')
                          s.set({ surface: 'outer', selected: p.outer.profiles[0].id });
                      }}
                    >
                      <option value="none">Outer only · radial rib depth</option>
                      <option value="approximate">Approximate inner offset</option>
                      <option value="independent">Independent inner surface</option>
                    </select>
                  </label>
                  {p.innerMode === 'approximate' && (
                    <>
                      <Field
                        label="Radial offset"
                        value={p.offset}
                        min={0.1}
                        max={200}
                        onChange={(v) =>
                          s.edit((p) => {
                            p.offset = v;
                          })
                        }
                      />
                      <p className="warning-note">
                        Approximation — not a true normal offset. Fabrication export is blocked.
                      </p>
                    </>
                  )}
                  {p.innerMode === 'independent' && (
                    <button
                      className="secondary-button"
                      onClick={() => {
                        s.set({ surface: 'inner', selected: p.inner.profiles[0].id });
                        setInspector('profile');
                      }}
                    >
                      Edit inner profiles <SlidersHorizontal size={14} />
                    </button>
                  )}
                </section>
                <section className="control-section">
                  <div className="section-title">
                    <h3>Support rings</h3>
                    <button
                      className={`toggle ${s.showRings ? 'on' : ''}`}
                      role="switch"
                      aria-label="Show support rings"
                      aria-checked={s.showRings}
                      onClick={() => s.set({ showRings: !s.showRings })}
                    >
                      <i />
                    </button>
                  </div>
                  {p.rings.map((ring, i) => (
                    <div className="ring-row" key={ring.id}>
                      <div className="ring-label">
                        <Circle size={13} />
                        <span>Ring {String(i + 1).padStart(2, '0')}</span>
                        <button
                          className="icon-button"
                          aria-label={`Remove ring ${i + 1}`}
                          onClick={() =>
                            s.edit((p) => {
                              p.rings = p.rings.filter((r) => r.id !== ring.id);
                            })
                          }
                        >
                          <Minus size={13} />
                        </button>
                      </div>
                      <div className="field-pair">
                        <Field
                          label="Elevation"
                          value={ring.z}
                          onChange={(v) =>
                            s.edit((p) => {
                              p.rings[i].z = v;
                            })
                          }
                        />
                        <Field
                          label="Radial width"
                          value={ring.width}
                          min={1}
                          max={200}
                          onChange={(v) =>
                            s.edit((p) => {
                              p.rings[i].width = v;
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    className="add-button"
                    disabled={p.rings.length >= 16}
                    onClick={() =>
                      s.edit((p) => {
                        const ps = sortedProfiles(p.outer);
                        p.rings.push({
                          id: crypto.randomUUID(),
                          z: (ps[0].z + ps.at(-1)!.z) / 2,
                          width: 28,
                        });
                      })
                    }
                  >
                    <Plus size={14} />
                    Add support ring
                  </button>
                  <p className="field-note">
                    Joint locations calculated. Notches and fit tolerances remain unvalidated.
                  </p>
                </section>
                <section className="control-section">
                  <div className="section-title">
                    <h3>Inspect a rib</h3>
                    <button
                      className={`icon-button ${s.isolate ? 'accent' : ''}`}
                      title="Isolate selected rib"
                      aria-label="Isolate selected rib"
                      onClick={() => s.set({ isolate: !s.isolate, view: 'ribs', tab: 'design' })}
                    >
                      <Focus size={18} />
                    </button>
                  </div>
                  <Slider
                    label="Selected rib"
                    value={s.ribIndex + 1}
                    min={1}
                    max={p.ribs.count}
                    onChange={(v) => s.set({ ribIndex: Math.round(v) - 1 })}
                  />
                  {activeRib && (
                    <div className="rib-preview">
                      <ContourPreview contours={activeRib.contours} />
                      <div>
                        <strong>R{String(s.ribIndex + 1).padStart(2, '0')}</strong>
                        <span>{(activeRib.area / 100).toFixed(1)} cm²</span>
                        <small>2D mid-plane contour</small>
                      </div>
                    </div>
                  )}
                </section>
              </>
            ) : (
              <>
                <section className="control-section">
                  <label className="select-label">
                    Surface
                    <select
                      aria-label="Profile surface"
                      value={s.surface}
                      onChange={(e) => {
                        const surface = e.target.value as 'outer' | 'inner';
                        s.set({ surface, selected: p[surface].profiles[0].id });
                      }}
                    >
                      <option value="outer">Outer surface</option>
                      <option value="inner" disabled={p.innerMode !== 'independent'}>
                        Independent inner surface
                      </option>
                    </select>
                  </label>
                  <label className="select-label">
                    Active station
                    <select
                      aria-label="Inspector profile station"
                      value={profile.id}
                      onChange={(e) => s.set({ selected: e.target.value })}
                    >
                      {profiles.map((station, i) => (
                        <option key={station.id} value={station.id}>
                          Station {String(i + 1).padStart(2, '0')} · {station.z} mm
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="station-actions">
                    <button
                      className="add-button"
                      disabled={profiles.length >= 16}
                      onClick={addStation}
                    >
                      <Plus size={14} />
                      Add station
                    </button>
                    <button
                      className="icon-button"
                      disabled={profiles.length <= 2}
                      aria-label="Remove selected station"
                      onClick={() => {
                        s.edit((p) => {
                          p[s.surface].profiles = p[s.surface].profiles.filter(
                            (x) => x.id !== profile.id,
                          );
                        });
                        s.set({ selected: profiles.find((x) => x.id !== profile.id)!.id });
                      }}
                    >
                      <Minus size={15} />
                    </button>
                  </div>
                </section>
                <section className="control-section">
                  <h3>Profile shape</h3>
                  <Field
                    label="Control points"
                    value={profile.controls.length}
                    min={4}
                    max={64}
                    unit="points"
                    onChange={(value) =>
                      update({ controls: resizeProfileControls(profile, Math.round(value)) })
                    }
                  />
                  <p className="field-note">
                    This station controls the highlighted horizontal contour. Changing the point
                    count resamples its shape; fewer points can simplify it.
                  </p>
                  <ProfileEditor
                    key={`${s.surface}-${profile.id}-${profile.controls.length}`}
                    profile={profile}
                  />
                  <div className="field-pair">
                    <Field label="Elevation" value={profile.z} onChange={(v) => update({ z: v })} />
                    <Field
                      label="Radius"
                      value={profile.radius}
                      min={1}
                      max={2000}
                      onChange={(v) => update({ radius: v })}
                    />
                  </div>
                  <div className="field-pair">
                    <Field
                      label="X scale"
                      value={profile.scaleX}
                      min={0.05}
                      max={5}
                      step={0.05}
                      unit="×"
                      onChange={(v) => update({ scaleX: v })}
                    />
                    <Field
                      label="Y scale"
                      value={profile.scaleY}
                      min={0.05}
                      max={5}
                      step={0.05}
                      unit="×"
                      onChange={(v) => update({ scaleY: v })}
                    />
                  </div>
                  <Slider
                    label="Clove modulation"
                    value={profile.amplitude}
                    min={0}
                    max={0.65}
                    step={0.01}
                    onChange={(v) => update({ amplitude: v })}
                  />
                  <Field
                    label="Lobes"
                    value={profile.lobes}
                    min={1}
                    max={16}
                    unit=""
                    onChange={(v) => update({ lobes: Math.round(v) })}
                  />
                  <Slider
                    label="Rotation"
                    value={profile.rotation}
                    min={-180}
                    max={180}
                    unit="°"
                    onChange={(v) => update({ rotation: v })}
                  />
                  <div className="field-pair">
                    <Field
                      label="Center X"
                      value={profile.center[0]}
                      onChange={(v) => update({ center: [v, profile.center[1]] })}
                    />
                    <Field
                      label="Center Y"
                      value={profile.center[1]}
                      onChange={(v) => update({ center: [profile.center[0], v] })}
                    />
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => update({ controls: profile.controls.map(() => [0, 0]) })}
                  >
                    <RotateCcw size={14} />
                    Reset control points
                  </button>
                </section>
              </>
            )}
            <div className="fabrication-note">
              <span>BUILD 01</span>
              <p>
                Design geometry is live.
                <br />
                Fabrication export comes next.
              </p>
            </div>
          </div>
        </aside>
      </div>
      <footer className="statusbar">
        <button
          onClick={() => setShowIssues(!showIssues)}
          className={errors.length ? 'has-errors' : ''}
        >
          {busy ? <span className="loading-dot" /> : <Check size={13} />}
          <span>
            {busy
              ? 'Recalculating'
              : errors.length
                ? `${errors.length} geometry issue${errors.length > 1 ? 's' : ''}`
                : 'Sampled geometry checks passed'}
          </span>
          <span className="status-separator">·</span>
          <span>{warnings.length} prototype notes</span>
          <ChevronDown size={12} />
        </button>
        <div>
          <span>{elapsed.toFixed(0)} ms</span>
          <span>Local autosave</span>
          <span className="connection-dot" />
          RIBFORM 0.1
        </div>
      </footer>
      {showIssues && (
        <div className="issues-panel">
          <div className="section-title">
            <h3>Geometry & fabrication status</h3>
            <button
              className="icon-button"
              aria-label="Close status"
              onClick={() => setShowIssues(false)}
            >
              <X size={16} />
            </button>
          </div>
          {result?.issues.map((issue, i) => (
            <p key={i} className={issue.severity === 'error' ? 'error-note' : 'warning-note'}>
              {issue.message}
            </p>
          ))}
          <p className="field-note">
            Sections follow the tessellated loft: {p.resolution.around} samples around each profile
            and {p.resolution.perSpan} subdivisions between stations. Planarity tolerance: 0.00001
            mm. Validity checks do not certify manufacturing tolerances.
          </p>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <div
            className="guide"
            role="dialog"
            aria-modal="true"
            aria-label="Studio guide"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button close-guide"
              aria-label="Close guide"
              onClick={() => setHelp(false)}
            >
              <X size={18} />
            </button>
            <span className="eyebrow">RIBFORM / STUDIO GUIDE</span>
            <h2>
              Shape a form.
              <br />
              Discover its structure.
            </h2>
            <p>
              Select a station in the left tree to adjust its radius, elevation, modulation, and
              position. Open Profiles for a larger canvas, then drag the control points. Arrow keys
              move a focused handle by one local millimeter.
            </p>
            <p>
              Structure controls define individual radial pieces around the vertical axis.
              Outer-only mode measures rib depth radially inward. Other modes use the inner surface
              as the rib boundary.
            </p>
            <p>
              Orbit with a left drag, pan with a right drag, and scroll to zoom. Parts shows the
              actual 2D contours. Save project downloads editable JSON; your current work also
              autosaves in this browser.
            </p>
            <p className="warning-note">
              This build is a design prototype. Offset surfaces are approximate; rings have uncut
              joints. Cutting files, nesting, hardware, and fabrication validation are future
              modules.
            </p>
            <button className="primary-button" onClick={() => setHelp(false)}>
              Start exploring
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
