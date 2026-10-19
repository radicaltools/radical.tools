import React, { useCallback, useMemo, useRef, useState } from 'react'
import type { C4Node, ChainLevel, ChainVia, ChainWay, DiagramView, ViewFilter, ViewPipeline, ViewSort } from '@radical/common/c4'
import { viewShowsEveryNode } from '@radical/common/c4'
import {
  applyFilters, drawsChain, filterLabel, pipelineOf, filterRuns, levelLabel, pipelineSource, runChain, sortLabel, wayLabel,
  suggestFilters, suggestNextWays, suggestSorts, suggestStartWays, type LevelResult, type PipelineContext, type WaySuggestion,
  placeChoices, propertyChoices, relationChoices, typeChoices, viaChoices, levelTypes, type Choice,
} from '@radical/common/viewPipeline'
import { chainSummary, isViewpointKind, saveAsViewpoint, viewpointOfView, viewpointsOf } from '@radical/common/viewpoints'
import { useDiagramStore } from '../store/diagramStore'
import { useOutsideClick } from '../hooks/useOutsideClick'

const NO_PIPELINE: ViewPipeline = {}

// ─── Filter ──────────────────────────────────────────────────────────────────
// A view's pipeline (viewPipeline.ts), edited in the view's properties in
// the left panel: among the view's elements, a chain of levels, one card each — the
// first level's types (the roots), then each next level along a relation or
// containment from the one above ("Refined into → Requirement"), a level
// taking any of several ways ("+ or": needs or ADRs) — each with
// its own filters (joined with and, or in runs with or; each run with how
// many elements come in and go through, each filter with a switch to try it
// off), and the order. "+ Start with" / "+ Level under", "+ Filter" and
// "+ Sort" offer what fits; a click on a way or a filter edits it in place.
// The table, the wiki, the canvas and the Structure panel on the right show
// the result. A view of one of the metamodel's viewpoints (viewpoints.ts)
// shows the viewpoint's chain, read-only until it is detached from the viewpoint; any
// other chain can be saved as a viewpoint.

const IconFilter = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
    <path d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5z" />
  </svg>
)
const IconSort = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 2.5v11M2.5 11 5 13.5 7.5 11M11 13.5v-11M8.5 5 11 2.5 13.5 5" />
  </svg>
)
const IconSource = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <ellipse cx="8" cy="4" rx="5.5" ry="2" /><path d="M2.5 4v8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4" />
  </svg>
)

/** The filter joined to the one before with or, or back with and. */
function toggledJoin(f: ViewFilter): ViewFilter {
  if (f.join !== 'or') return { ...f, join: 'or' }
  const and = { ...f }
  delete and.join
  return and
}

/** The filter switched off, or back on. */
function toggledOff(f: ViewFilter): ViewFilter {
  if (!f.off) return { ...f, off: true }
  const on = { ...f }
  delete on.off
  return on
}

/** A menu that closes on a click outside it. */
function useMenu<T>(): [T | null, (m: T | null) => void, React.RefObject<HTMLDivElement>] {
  const [menu, setMenu] = useState<T | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClick([ref], menu !== null, useCallback(() => setMenu(null), []))
  return [menu, setMenu, ref]
}

/** Ticks for a list of choices; `picked` the values ticked. */
function ChoiceList({ choices, picked, onChange, label }: {
  choices: Choice<string>[]
  picked: string[]
  onChange: (picked: string[]) => void
  label: string
}): React.ReactElement {
  // What is picked stays listed though nothing here has it any more.
  const all = [...choices, ...picked.filter((v) => !choices.some((c) => c.value === v)).map((v) => ({ value: v, label: v, count: 0 }))]
  return (
    <div className="rp-edit-choices" role="group" aria-label={label}>
      {all.map((c) => (
        <label key={c.value} className="rp-edit-choice">
          <input type="checkbox" checked={picked.includes(c.value)}
            onChange={(e) => onChange(e.target.checked ? [...picked, c.value] : picked.filter((v) => v !== c.value))} />
          <span className="rp-edit-choice-label">{c.label}</span>
          <span className="rp-step-option-count">{c.count}</span>
        </label>
      ))}
    </div>
  )
}

const relKey = (r: { relationType: string; direction: 'out' | 'in' }) => `${r.direction}:${r.relationType}`
const viaKey = (via: ChainVia | undefined) => JSON.stringify(via ?? null)

/** Edits one filter in place, its fields by kind; each change applies at
 *  once (one undo step), Done closes it. */
function FilterEditor({ filter, input, types, ctx, onChange, onDone }: {
  filter: ViewFilter
  input: C4Node[]
  /** The level's types: their properties are offered with no element yet. */
  types: string[]
  ctx: PipelineContext
  onChange: (f: ViewFilter) => void
  onDone: () => void
}): React.ReactElement {
  const keep = { ...(filter.off ? { off: true as const } : {}), ...(filter.join ? { join: filter.join } : {}) }
  const [text, setText] = useState(filter.kind === 'text' ? filter.text : '')
  let body: React.ReactNode = null
  if (filter.kind === 'type') {
    body = <ChoiceList label="Types" choices={typeChoices(input, ctx, types)} picked={filter.types}
      onChange={(types) => types.length && onChange({ kind: 'type', types, ...keep })} />
  } else if (filter.kind === 'property') {
    const props = propertyChoices(input, ctx, types)
    const prop = props.find((p) => p.key === filter.key)
    body = (
      <>
        <div className="rp-edit-row">
          <select className="props-input" aria-label="Property" value={filter.key}
            onChange={(e) => onChange({ kind: 'property', key: e.target.value, op: filter.op === 'set' || filter.op === 'unset' ? filter.op : 'is', ...(filter.op === 'set' || filter.op === 'unset' ? {} : { values: [] }), ...keep })}>
            {!prop && <option value={filter.key}>{filter.key}</option>}
            {props.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select className="props-input" aria-label="Operator" value={filter.op}
            onChange={(e) => {
              const op = e.target.value as 'is' | 'is-not' | 'set' | 'unset'
              onChange(op === 'set' || op === 'unset' ? { kind: 'property', key: filter.key, op, ...keep } : { kind: 'property', key: filter.key, op, values: filter.values ?? [], ...keep })
            }}>
            <option value="is">is</option>
            <option value="is-not">is not</option>
            <option value="set">is set</option>
            <option value="unset">is not set</option>
          </select>
        </div>
        {(filter.op === 'is' || filter.op === 'is-not') && (
          <ChoiceList label="Values" choices={prop?.values ?? []} picked={filter.values ?? []}
            onChange={(values) => onChange({ ...filter, values })} />
        )}
      </>
    )
  } else if (filter.kind === 'relation') {
    const rels = relationChoices(input, ctx)
    const current = relKey(filter)
    body = (
      <div className="rp-edit-row">
        <select className="props-input" aria-label="Has or has not" value={filter.has ? 'has' : 'has-no'}
          onChange={(e) => onChange({ ...filter, has: e.target.value === 'has' })}>
          <option value="has">Has</option>
          <option value="has-no">Has no</option>
        </select>
        <select className="props-input" aria-label="Relation" value={current}
          onChange={(e) => { const r = rels.find((c) => relKey(c.value) === e.target.value); if (r) onChange({ ...filter, ...r.value }) }}>
          {!rels.some((r) => relKey(r.value) === current) && <option value={current}>{filter.relationType}</option>}
          {rels.map((r) => <option key={relKey(r.value)} value={relKey(r.value)}>{r.label} ({r.count})</option>)}
        </select>
      </div>
    )
  } else if (filter.kind === 'within') {
    const places = placeChoices(input, ctx)
    body = (
      <select className="props-input" aria-label="Inside" value={filter.nodeId}
        onChange={(e) => onChange({ kind: 'within', nodeId: e.target.value, ...(filter.self ? { self: true as const } : {}), ...keep })}>
        {!places.some((p) => p.value === filter.nodeId) && <option value={filter.nodeId}>{ctx.nodes[filter.nodeId]?.label ?? filter.nodeId}</option>}
        {places.map((p) => <option key={p.value} value={p.value}>{p.label} ({p.count})</option>)}
      </select>
    )
  } else {
    body = (
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) onChange({ kind: 'text', text: text.trim(), ...keep }); onDone() }}>
        <input className="props-input" aria-label="Text" autoFocus value={text}
          onChange={(e) => { setText(e.target.value); if (e.target.value.trim()) onChange({ kind: 'text', text: e.target.value.trim(), ...keep }) }} />
      </form>
    )
  }
  return (
    <div className="rp-edit" role="group" aria-label={`Edit ${filterLabel(filter, ctx)}`}>
      {body}
      <button className="rp-edit-done" onClick={onDone}>Done</button>
    </div>
  )
}

/** What a way could be: the types to start from (first level), or the ways
 *  down from the level above with the types each reaches. */
type WayChoices =
  | { first: true; types: Choice<string>[] }
  | { first: false; vias: Array<{ via: ChainVia; label: string; types: Choice<string>[] }> }

/** Edits one way of a level in place: the relation it follows (not on the
 *  first level) and the types it takes, none ticked for any. */
function WayEditor({ way, choices, ctx, onChange, onDone }: {
  way: ChainWay
  choices: WayChoices
  ctx: PipelineContext
  onChange: (w: ChainWay) => void
  onDone: () => void
}): React.ReactElement {
  const types = way.types ?? []
  const withTypes = (via: ChainVia | undefined, t: string[]): ChainWay => ({ ...(via ? { via } : {}), ...(t.length ? { types: t } : {}) })
  const current = choices.first ? undefined : choices.vias.find((c) => viaKey(c.via) === viaKey(way.via))
  return (
    <div className="rp-edit" role="group" aria-label={`Edit ${wayLabel(way, ctx)}`}>
      {!choices.first && (
        <select className="props-input" aria-label="Along" value={viaKey(way.via)}
          onChange={(e) => {
            const next = choices.vias.find((c) => viaKey(c.via) === e.target.value)
            if (!next) return
            // Keep the types the new way still reaches.
            onChange(withTypes(next.via, types.filter((t) => next.types.some((c) => c.value === t))))
          }}>
          {!current && way.via && <option value={viaKey(way.via)}>{wayLabel({ via: way.via }, ctx)}</option>}
          {choices.vias.map((c) => <option key={viaKey(c.via)} value={viaKey(c.via)}>{c.label}</option>)}
        </select>
      )}
      <div className="rp-edit-hint">{types.length ? 'Of these types:' : choices.first ? 'Every element — or only these types:' : 'Any element — or only these types:'}</div>
      <ChoiceList label="Types" choices={choices.first ? choices.types : current?.types ?? []} picked={types}
        onChange={(t) => onChange(withTypes(way.via, t))} />
      <button className="rp-edit-done" onClick={onDone}>Done</button>
    </div>
  )
}

/** One level of the chain: its ways (joined with or), then its filters. */
function LevelCard({ level, index, result, ctx, readOnly, suggestWays, wayChoices, onChange, onRemove }: {
  level: ChainLevel
  index: number
  result: LevelResult | undefined
  ctx: PipelineContext
  readOnly: boolean
  /** Other ways this level could take besides its own. */
  suggestWays: () => WaySuggestion[]
  /** What this level's ways could be, for editing one. */
  wayChoices: () => WayChoices
  onChange: (level: ChainLevel) => void
  onRemove: () => void
}): React.ReactElement {
  const filters = level.filters ?? []
  const runs = useMemo(() => filterRuns(filters), [filters])
  const input = result?.input ?? []
  const counts = result?.counts ?? []
  const shown = result?.shown ?? []
  const [menu, setMenu, menuRef] = useMenu<'filter'>()
  const [wayMenu, setWayMenu, wayMenuRef] = useMenu<'way'>()
  const [text, setText] = useState('')
  const wayOptions = useMemo(() => (wayMenu ? suggestWays() : []), [wayMenu, suggestWays])
  const setWays = (ways: ChainWay[]) => (ways.length ? onChange({ ...level, ways }) : onRemove())
  // The way or filter being edited in place.
  const [editing, setEditing] = useState<{ way: number } | { filter: number } | null>(null)
  const editingWay = editing && 'way' in editing ? editing.way : -1
  const editingFilter = editing && 'filter' in editing ? editing.filter : -1
  const choices = useMemo(() => (editingWay >= 0 ? wayChoices() : null), [editingWay, wayChoices])
  const setWay = (j: number, way: ChainWay) => setWays(level.ways.map((w, k) => (k === j ? way : w)))
  const wayButton = (way: ChainWay, j: number) => readOnly
    ? <span className="rp-step-label" title={wayLabel(way, ctx)}>{wayLabel(way, ctx)}</span>
    : <button className={`rp-step-label rp-step-edit-btn${editingWay === j ? ' active' : ''}`} title={`${wayLabel(way, ctx)} — click to change`}
        aria-label={`Edit ${wayLabel(way, ctx)}`} onClick={() => setEditing(editingWay === j ? null : { way: j })}>{wayLabel(way, ctx)}</button>
  const wayEditor = (j: number) => editingWay === j && choices && (
    <WayEditor way={level.ways[j]} choices={choices} ctx={ctx} onChange={(w) => setWay(j, w)} onDone={() => setEditing(null)} />
  )

  const typesHere = useMemo(() => levelTypes(level, ctx), [level, ctx])
  const andOptions = useMemo(() => (menu ? suggestFilters(shown, ctx, typesHere) : []), [menu, shown, ctx, typesHere])
  // Alternatives to the level's last run of filters: from what goes into
  // it, those it does not hold yet; picked, they join it with or.
  const orOptions = useMemo(() => {
    if (!menu || !filters.length) return []
    const run = runs[runs.length - 1]
    const before = run[0] === 0 ? input : applyFilters(input, filters.slice(0, run[0]), ctx).nodes
    const held = new Set(run.map((i) => filterLabel(filters[i], ctx)))
    return suggestFilters(before, ctx, typesHere).filter((o) => !held.has(o.label))
  }, [menu, filters, runs, input, ctx, typesHere])

  const setFilters = (next: ViewFilter[]) => onChange({ ...level, filters: next })
  const addFilter = (f: ViewFilter) => { setFilters([...filters, f]); setMenu(null) }

  return (
    <div className="rp-level">
      <div className="rp-level-head">
        <span className="rp-level-num">{index + 1}</span>
        {wayButton(level.ways[0], 0)}
        <span className="rp-step-count" title={`${shown.length} element${shown.length === 1 ? '' : 's'} on this level`}>{shown.length}</span>
        {!readOnly && (
          <button className="rp-step-btn" aria-label={`Remove level ${levelLabel(level, ctx)}`}
            title={index === 0 ? 'Remove the chain' : 'Remove this level and those under it'} onClick={onRemove}>×</button>
        )}
      </div>
      {wayEditor(0)}
      {/* The level's other ways: any of them reaches its elements. */}
      {level.ways.slice(1).map((way, j) => (
        <React.Fragment key={j}>
          <div className="rp-level-way">
            <span className="rp-step-kind">or</span>
            {wayButton(way, j + 1)}
            {!readOnly && (
              <button className="rp-step-btn" aria-label={`Remove or ${wayLabel(way, ctx)}`} title="Remove this way"
                onClick={() => { setEditing(null); setWays(level.ways.filter((_, k) => k !== j + 1)) }}>×</button>
            )}
          </div>
          {wayEditor(j + 1)}
        </React.Fragment>
      ))}

      {filters.map((f, i) => {
        // A run of filters joined with or counts as one step: its count
        // stands by its last filter.
        const run = runs.find((r) => r.includes(i))!
        const inRun = run.length > 1
        const last = run[run.length - 1] === i
        const before = run[0] === 0 ? input.length : counts[run[0] - 1]
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <button className={`rp-step-join${f.join === 'or' ? ' or' : ''}`} disabled={readOnly}
                title={f.join === 'or' ? 'Either this or the filter above (click for and)' : 'This and the filters above (click for or)'}
                aria-label={`Join ${filterLabel(f, ctx)} with ${f.join === 'or' ? 'and' : 'or'}`}
                onClick={() => setFilters(filters.map((g, j) => (j === i ? toggledJoin(g) : g)))}>
                {f.join === 'or' ? 'or' : 'and'}
              </button>
            )}
            <div className={`rp-step${f.off ? ' off' : ''}${inRun ? ' in-run' : ''}${inRun && run[0] === i ? ' run-first' : ''}${inRun && last ? ' run-last' : ''}`}>
              <span className="rp-step-icon"><IconFilter /></span>
              {readOnly
                ? <span className="rp-step-label" title={filterLabel(f, ctx)}>{filterLabel(f, ctx)}</span>
                : <button className={`rp-step-label rp-step-edit-btn${editingFilter === i ? ' active' : ''}`} title={`${filterLabel(f, ctx)} — click to change`}
                    aria-label={`Edit ${filterLabel(f, ctx)}`} onClick={() => setEditing(editingFilter === i ? null : { filter: i })}>{filterLabel(f, ctx)}</button>}
              {last && <span className="rp-step-count" title={`${before} in, ${counts[i]} through`}>{before} → {counts[i]}</span>}
              {!readOnly && (
                <>
                  <button className="rp-step-btn" title={f.off ? 'Apply this filter' : 'Try without this filter'}
                    aria-label={f.off ? `Apply ${filterLabel(f, ctx)}` : `Switch off ${filterLabel(f, ctx)}`}
                    onClick={() => setFilters(filters.map((g, j) => (j === i ? toggledOff(g) : g)))}>
                    {f.off ? '○' : '●'}
                  </button>
                  <button className="rp-step-btn" aria-label={`Remove ${filterLabel(f, ctx)}`} title="Remove"
                    onClick={() => { setEditing(null); setFilters(filters.filter((_, j) => j !== i)) }}>×</button>
                </>
              )}
            </div>
            {editingFilter === i && (
              <FilterEditor filter={f} input={input} types={typesHere} ctx={ctx} onDone={() => setEditing(null)}
                onChange={(g) => setFilters(filters.map((h, j) => (j === i ? g : h)))} />
            )}
          </React.Fragment>
        )
      })}

      {!readOnly && (
        <div className="rp-level-actions">
        <div className="rp-level-add" ref={wayMenuRef}>
          <button className={`rp-level-add-btn${wayMenu ? ' active' : ''}`} onClick={() => setWayMenu(wayMenu ? null : 'way')}
            aria-label={`Add another way to ${levelLabel(level, ctx)}`}
            title={index === 0 ? 'Elements of another type as roots too' : 'Elements reached another way too'}>+ or</button>
          {wayMenu && (
            <div className="rp-step-menu" role="menu">
              <div className="rp-step-menu-section">or — besides {levelLabel(level, ctx)}</div>
              {wayOptions.length === 0 && <div className="rp-step-menu-empty">No other way leads here.</div>}
              {wayOptions.map((o) => (
                <button key={JSON.stringify(o.way)} className="rp-step-option" role="menuitem" aria-label={`or ${o.label}`}
                  onClick={() => { setWays([...level.ways, o.way]); setWayMenu(null) }}>
                  <span className="rp-step-option-label"><span className="rp-step-kind">or</span> {o.label}</span>
                  <span className="rp-step-option-count">{o.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="rp-level-add" ref={menuRef}>
          <button className={`rp-level-add-btn${menu ? ' active' : ''}`} onClick={() => setMenu(menu ? null : 'filter')}
            aria-label={`Add a filter to ${levelLabel(level, ctx)}`}>+ Filter</button>
          {menu && (
            <div className="rp-step-menu" role="menu">
              <form className="rp-step-menu-text" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { addFilter({ kind: 'text', text: text.trim() }); setText('') } }}>
                <input className="props-input" placeholder="Text in name or description…" value={text} onChange={(e) => setText(e.target.value)} />
              </form>
              {orOptions.length > 0 && <div className="rp-step-menu-section">and — narrow these {shown.length}</div>}
              {andOptions.length === 0 && <div className="rp-step-menu-empty">No filter would narrow these {shown.length} elements.</div>}
              {andOptions.map((o) => (
                <button key={JSON.stringify(o.filter)} className="rp-step-option" role="menuitem" onClick={() => addFilter(o.filter)}>
                  <span className="rp-step-option-label">{o.label}</span>
                  <span className="rp-step-option-count">{o.count}</span>
                </button>
              ))}
              {orOptions.length > 0 && (
                <>
                  <div className="rp-step-menu-section">or — besides {filterLabel(filters[filters.length - 1], ctx)}</div>
                  {orOptions.map((o) => (
                    <button key={'or' + JSON.stringify(o.filter)} className="rp-step-option" role="menuitem"
                      aria-label={`or ${o.label}`} onClick={() => addFilter({ ...o.filter, join: 'or' })}>
                      <span className="rp-step-option-label"><span className="rp-step-kind">or</span> {o.label}</span>
                      <span className="rp-step-option-count">{o.count}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  )
}

/** The view's type: the metamodel's viewpoint it is of, with Detach to
 *  edit the chain on its own, or "Save as viewpoint" to keep its kind and
 *  chain in the metamodel under a name (a viewpoint's name replaces that viewpoint,
 *  and every view of it follows). */
function ViewpointRow({ view, pipeline, ctx }: { view: DiagramView; pipeline: ViewPipeline; ctx: PipelineContext }): React.ReactElement | null {
  const metamodel = useDiagramStore((s) => s.metamodel)
  const setMetamodel = useDiagramStore((s) => s.setMetamodel)
  const applyViewpoint = useDiagramStore((s) => s.applyViewpoint)
  const detachViewpoint = useDiagramStore((s) => s.detachViewpoint)
  const type = viewpointOfView(view, metamodel)
  const kind = view.kind ?? 'static'
  const [naming, setNaming] = useState<string | null>(null)

  if (type) {
    return (
      <div className="rp-viewpoint">
        <span className="rp-viewpoint-label" title={`${type.label}: ${type.description ? `${type.description}\n` : ''}${chainSummary(type.pipeline, ctx)}`}>
          Set by the viewpoint
        </span>
        {/* One of a group's views stays the group's. */}
        {!view.partOf && (
          <button className="rp-step-btn rp-viewpoint-btn" onClick={() => detachViewpoint(view.id)}
            title="Keep this chain, of no viewpoint, to edit it here">Detach</button>
        )}
      </div>
    )
  }
  if (!isViewpointKind(kind) || !(pipeline.levels?.length || pipeline.sort)) return null

  const types = viewpointsOf(metamodel)
  const replaces = naming !== null && types.find((t) => t.label.trim().toLowerCase() === naming.trim().toLowerCase())
  const save = () => {
    const label = naming?.trim()
    if (!label) return
    const saved = saveAsViewpoint(metamodel, label, kind, pipeline)
    setMetamodel(saved.metamodel)
    applyViewpoint(view.id, saved.type.id)
    setNaming(null)
  }
  return (
    <div className="rp-viewpoint">
      {naming === null ? (
        <button className="rp-step-link" onClick={() => setNaming('')}
          title="Keep this view's kind and chain in the metamodel: New view offers it">Save as viewpoint…</button>
      ) : (
        <>
          <input className="props-input rp-viewpoint-name" autoFocus aria-label="Viewpoint name" placeholder="Viewpoint name"
            value={naming} onChange={(e) => setNaming(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); else if (e.key === 'Escape') { e.stopPropagation(); setNaming(null) } }} />
          <button className="rp-step-btn rp-viewpoint-btn" disabled={!naming.trim()} onClick={save}
            title={replaces ? `Replace the viewpoint “${replaces.label}”: its views follow` : 'Add the viewpoint to the metamodel'}>
            {replaces ? 'Replace' : 'Save'}
          </button>
          <button className="rp-step-btn" aria-label="Cancel" title="Cancel" onClick={() => setNaming(null)}>×</button>
        </>
      )}
    </div>
  )
}

export function ViewPipelinePanel({ view, readOnly: readOnlyMode }: { view: DiagramView; readOnly: boolean }): React.ReactElement {
  const nodes = useDiagramStore((s) => s.c4Nodes)
  const relations = useDiagramStore((s) => s.c4Relations)
  const metamodel = useDiagramStore((s) => s.metamodel)
  // A view of a viewpoint has the viewpoint's chain: edited only once detached.
  const readOnly = readOnlyMode || !!viewpointOfView(view, metamodel)
  const setViewPipeline = useDiagramStore((s) => s.setViewPipeline)
  const setViewNodes = useDiagramStore((s) => s.setViewNodes)
  const ctx = useMemo<PipelineContext>(() => ({ nodes, relations, metamodel }), [nodes, relations, metamodel])

  const pipeline: ViewPipeline = pipelineOf(view) ?? NO_PIPELINE
  const levels = pipeline.levels ?? []
  const source = useMemo(() => pipelineSource(view, ctx), [view, ctx])
  const result = useMemo(() => runChain(source, pipeline, ctx), [source, pipeline, ctx])

  const update = useCallback((patch: Partial<ViewPipeline>) => {
    setViewPipeline(view.id, { ...pipeline, ...patch })
  }, [setViewPipeline, view.id, pipeline])

  const [menu, setMenu, menuRef] = useMenu<'level' | 'sort'>()
  const lastShown = levels.length ? result.levels[levels.length - 1]?.shown ?? [] : []
  const levelOptions = useMemo(
    () => (menu !== 'level' ? [] : levels.length ? suggestNextWays(lastShown, source, ctx, [], levelTypes(levels[levels.length - 1], ctx)) : suggestStartWays(source, ctx)),
    [menu, levels, lastShown, source, ctx],
  )
  // The ways level `i` could also take: from what the level above keeps.
  const suggestWaysFor = (i: number) => () =>
    i === 0 ? suggestStartWays(source, ctx, levels[0].ways) : suggestNextWays(result.levels[i - 1]?.shown ?? [], source, ctx, levels[i].ways, levelTypes(levels[i - 1], ctx))
  const wayChoicesFor = (i: number) => (): WayChoices =>
    i === 0 ? { first: true, types: typeChoices(source, ctx, Object.keys(ctx.metamodel?.nodeTypes ?? {})) } : { first: false, vias: viaChoices(result.levels[i - 1]?.shown ?? [], source, ctx, levelTypes(levels[i - 1], ctx)) }
  const sortOptions = useMemo(() => (menu === 'sort' ? suggestSorts(result.nodes, ctx) : []), [menu, result, ctx])

  const addLevel = (way: ChainWay) => { update({ levels: [...levels, { ways: [way] }] }); setMenu(null) }
  const setSort = (s: ViewSort | undefined) => { update({ sort: s }); setMenu(null) }

  return (
    <div className="rp-pipeline" onClick={(e) => e.stopPropagation()}>
      <div className="rp-pipeline-head">
        <span>Filter</span>
        {!readOnly && view.pipeline && (
          <button className="rp-pipeline-reset" onClick={() => setViewPipeline(view.id, {})} title="Remove every step">Reset</button>
        )}
      </div>

      {!readOnlyMode && <ViewpointRow view={view} pipeline={pipeline} ctx={ctx} />}

      <div className="rp-step">
        <span className="rp-step-icon"><IconSource /></span>
        <span className="rp-step-label">
          {viewShowsEveryNode(view) ? 'Every element' : "This view's elements"}
          {/* The view back to every element, as it was before any eye was used. */}
          {!readOnly && !viewShowsEveryNode(view) && (
            <> · <button className="rp-step-link" onClick={() => setViewNodes(view.id, [])}>Show every element</button></>
          )}
        </span>
        <span className="rp-step-count">{source.length}</span>
      </div>

      {levels.map((level, i) => (
        <LevelCard key={i} level={level} index={i} result={result.levels[i]} ctx={ctx} readOnly={readOnly} suggestWays={suggestWaysFor(i)} wayChoices={wayChoicesFor(i)}
          onChange={(next) => update({ levels: levels.map((l, j) => (j === i ? next : l)) })}
          onRemove={() => update({ levels: levels.slice(0, i) })} />
      ))}

      {/* A canvas draws the relations the chain follows, or all between its elements. */}
      {levels.length > 0 && drawsChain(view) && (
        <label className="rp-step rp-step-check">
          <input type="checkbox" checked={pipeline.edges === 'all'} disabled={readOnly}
            onChange={(e) => update({ edges: e.target.checked ? 'all' : undefined })} />
          <span className="rp-step-label">Draw every relation between them</span>
        </label>
      )}

      {pipeline.sort && (
        <div className="rp-step">
          <span className="rp-step-icon"><IconSort /></span>
          <span className="rp-step-label"><span className="rp-step-kind">Sort</span> {sortLabel(pipeline.sort, ctx)}</span>
          {!readOnly && (
            <>
              <button className="rp-step-btn" title={pipeline.sort.desc ? 'Ascending' : 'Descending'}
                aria-label={pipeline.sort.desc ? 'Sort ascending' : 'Sort descending'}
                onClick={() => update({ sort: pipeline.sort!.desc ? { by: pipeline.sort!.by, key: pipeline.sort!.key } : { ...pipeline.sort!, desc: true } })}>
                {pipeline.sort.desc ? '↓' : '↑'}
              </button>
              <button className="rp-step-btn" aria-label="Remove the order" title="Remove" onClick={() => setSort(undefined)}>×</button>
            </>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="rp-step-add" ref={menuRef}>
          <button className={`rp-step-add-btn${menu === 'level' ? ' active' : ''}`} onClick={() => setMenu(menu === 'level' ? null : 'level')}>
            + {levels.length ? 'Level under' : 'Start with'}
          </button>
          <button className={`rp-step-add-btn${menu === 'sort' ? ' active' : ''}`} onClick={() => setMenu(menu === 'sort' ? null : 'sort')}>+ Sort</button>
          {menu && (
            <div className="rp-step-menu" role="menu">
              {menu === 'level' && (
                <>
                  <div className="rp-step-menu-section">{levels.length ? `under ${levelLabel(levels[levels.length - 1], ctx)}` : 'the roots: elements of type'}</div>
                  {levelOptions.length === 0 && <div className="rp-step-menu-empty">Nothing hangs under these elements.</div>}
                  {levelOptions.map((o) => (
                    <button key={JSON.stringify(o.way)} className="rp-step-option" role="menuitem" onClick={() => addLevel(o.way)}>
                      <span className="rp-step-option-label">{o.label}</span>
                      <span className="rp-step-option-count">{o.count}</span>
                    </button>
                  ))}
                </>
              )}
              {menu === 'sort' && sortOptions.map((o) => (
                <button key={JSON.stringify(o.sort)} className="rp-step-option" role="menuitem" onClick={() => setSort(o.sort)}>
                  <span className="rp-step-option-label">{o.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
