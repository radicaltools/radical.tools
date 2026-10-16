import React, { ChangeEvent, useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useDiagramStore } from '../store/diagramStore'
import { useNodeLabels } from '../store/nodeSelectors'
import { type C4Relation, NODE_COLORS, TYPE_LABELS, TYPE_ICON_PATHS, NODE_FG } from '@radical/common/c4'
import { resolveEarsSubject, isReservedPropertyKey, type PropertyDef } from '@radical/common/metamodel'
import { EarsQuickEntry } from './EarsQuickEntry'
import { ViewPipelinePanel } from './ViewPipelinePanel'
import { MarkdownText } from './MarkdownText'
import { isMarkdownField } from '@radical/common/markdown'
import type { HubImportRecord } from '../store/hubStore'
import { MockupWireframe } from './MockupWireframe'
import { RefPicker } from './RefPicker'
import { viewShownNodes } from '@radical/common/viewPipeline'
import { VIEW_KIND_LABELS, viewpointGroups, viewpointOfView, viewpointsOf } from '@radical/common/viewpoints'
import type { ViewpointKind } from '@radical/common/metamodel'
import { useOutsideClick } from '../hooks/useOutsideClick'
import { viewShowsEveryNode, viewFolderTree, viewFolderPaths, normalizeViewFolder, isInViewFolder, wikiDepthOf, WIKI_DEPTH_MIN, WIKI_DEPTH_MAX, type ViewFolder, type DiagramView } from '@radical/common/c4'

// ── AutoResizeTextarea ────────────────────────────────────────────────────────

/** How many elements each view shows (viewShownNodes: its filter's chain,
 *  else its list); undefined for a view that shows the whole model. Running
 *  every view's chain takes tens of milliseconds on a large model, so it
 *  waits until the model has stopped changing for a moment. */
function useViewNodeCounts(views: Record<string, DiagramView>): Record<string, number | undefined> {
  const nodes = useDiagramStore((s) => s.c4Nodes)
  const relations = useDiagramStore((s) => s.c4Relations)
  const count = useCallback(() => {
    const out: Record<string, number | undefined> = {}
    for (const v of Object.values(views)) out[v.id] = viewShownNodes(v, nodes, relations)?.size
    return out
  }, [views, nodes, relations])
  const [counts, setCounts] = useState(count)
  useEffect(() => {
    const t = setTimeout(() => setCounts(count()), 300)
    return () => clearTimeout(t)
  }, [count])
  return counts
}

function viewNodeCount(view: DiagramView, shown: number | undefined): string {
  if (shown === undefined) return viewShowsEveryNode(view) ? 'All nodes' : ''
  return `${shown} ${shown === 1 ? 'node' : 'nodes'}`
}

function AutoResizeTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.8)}px`
  }, [])

  useEffect(() => { resize() }, [props.value, resize])

  return (
    <textarea
      {...props}
      ref={ref}
      className="props-textarea"
      style={{ overflow: 'hidden', ...props.style }}
      onInput={resize}
    />
  )
}

// A node's long field is Markdown (markdown.ts): the wiki and the table render it.
const MARKDOWN_HINT = 'Markdown: **bold**, _italic_, `code`, - lists, [links](https://…)'

// ── Accordion section ────────────────────────────────────────────────────────
// A section of the left panel: its icon, name and count, and folded a line
// that says what is in it. Open, it takes the panel's free height and
// scrolls on its own; the folded ones stay under it.

const SECTION_ICONS: Record<'views' | 'milestones' | 'sequences', string> = {
  views: 'M8 2 L14 5 L8 8 L2 5 Z M2 8 L8 11 L14 8 M2 11 L8 14 L14 11',
  milestones: 'M4 14 V2.5 M4 3 H12 L10.5 5.5 L12 8 H4',
  sequences: 'M2 5 H11 M8.5 2.5 L11 5 L8.5 7.5 M14 11 H5 M7.5 8.5 L5 11 L7.5 13.5',
}

/** Each section's colour: its icon, its count, the cards in it. */
const SECTION_COLORS: Record<keyof typeof SECTION_ICONS, string> = {
  views: '#3b82f6',
  milestones: '#f59e0b',
  sequences: '#8b5cf6',
}

/** Each view type's colour, on its card's icon and type name. */
const VIEW_KIND_COLORS: Record<string, string> = {
  structure: '#3b82f6',
  flow: '#f59e0b',
  hierarchy: '#14b8a6',
  table: '#22c55e',
  matrix: '#a855f7',
  wiki: '#ec4899',
}

function AccordionSection({
  title, icon, preview, defaultOpen = true, children, count, open: openProp, onToggle,
}: {
  title: string
  icon?: keyof typeof SECTION_ICONS
  /** What a folded section shows under its name. */
  preview?: string
  defaultOpen?: boolean
  children: React.ReactNode
  count?: number
  open?: boolean
  onToggle?: () => void
}) {
  const [openState, setOpenState] = useState(defaultOpen)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : openState
  const toggle = controlled ? onToggle! : () => setOpenState((o) => !o)
  return (
    <div className={`lp-section${open ? ' open' : ''}`} style={icon ? { ['--sec-color' as string]: SECTION_COLORS[icon] } : undefined}>
      <button className="lp-section-header" onClick={toggle} aria-expanded={open}>
        {icon && (
          <span className="lp-section-icon" aria-hidden>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={SECTION_ICONS[icon]} /></svg>
          </span>
        )}
        <span className="lp-section-text">
          <span className="lp-section-title">{title}</span>
          {!open && preview && <span className="lp-section-preview">{preview}</span>}
        </span>
        {count != null && count > 0 && <span className="lp-section-count">{count}</span>}
        <svg className={`lp-section-chevron${open ? ' open' : ''}`} viewBox="0 0 16 16" width="10" height="10" aria-hidden>
          <path d="M5 3 L11 8 L5 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {/* A folded section keeps its content (its state, its menus), unseen. */}
      <div className={`lp-section-body${open ? ' open' : ''}`} hidden={!open}>
        <div className="lp-section-body-pad">{children}</div>
      </div>
    </div>
  )
}

// ── Tiny inline icons ─────────────────────────────────────────────────────────
const Icon = {
  Plus: () => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M8 3v10M3 8h10"/>
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5 L6.5 12 L13 4.5"/>
    </svg>
  ),
  Close: () => (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 4 L12 12 M12 4 L4 12"/>
    </svg>
  ),
  Restore: () => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8 a5 5 0 1 0 1.5 -3.5"/>
      <path d="M3 3 v3 h3"/>
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.5 h10 M6 4.5 V3 h4 v1.5 M5 4.5 l.7 8.5 a1 1 0 0 0 1 1 h2.6 a1 1 0 0 0 1 -1 l.7 -8.5"/>
    </svg>
  ),
  Camera: () => (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M2.5 5.5 h2 l1 -1.5 h5 l1 1.5 h2 v7 h-11 z"/>
      <circle cx="8" cy="9" r="2.3"/>
    </svg>
  ),
  Layers: () => (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M8 2 L14 5 L8 8 L2 5 Z"/>
      <path d="M2 8 L8 11 L14 8"/>
      <path d="M2 11 L8 14 L14 11"/>
    </svg>
  ),
  Pencil: () => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 2.5 l2.5 2.5 -7.5 7.5 -3 .5 .5 -3 z"/>
      <path d="M10 3.5 l2.5 2.5"/>
    </svg>
  ),
  Bolt: () => (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
      <path d="M9.5 2 L4 9 h4 L6.5 14 L13 7 H9 Z"/>
    </svg>
  ),
  TreemapGrid: () => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1" y="1" width="9" height="9" rx="1"/>
      <rect x="11" y="1" width="4" height="4" rx="0.5"/>
      <rect x="11" y="6" width="4" height="4" rx="0.5"/>
      <rect x="1" y="11" width="4" height="4" rx="0.5"/>
      <rect x="6" y="11" width="4" height="4" rx="0.5"/>
      <rect x="11" y="11" width="4" height="4" rx="0.5"/>
    </svg>
  ),
  TableGrid: () => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5"/>
      <path d="M1.5 5.5 h13"/>
      <path d="M6 5.5 v9"/>
      <path d="M10.5 5.5 v9"/>
    </svg>
  ),
  MatrixGrid: () => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5"/>
      <path d="M6 1.5 v13"/>
      <path d="M10.5 1.5 v13"/>
      <path d="M1.5 6 h13"/>
      <path d="M1.5 10.5 h13"/>
      <circle cx="8.25" cy="3.75" r="1" fill="currentColor" stroke="none"/>
      <circle cx="3.75" cy="8.25" r="1" fill="currentColor" stroke="none"/>
      <circle cx="12.75" cy="12.75" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
  Wiki: () => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3.5 C6.8 2.6 4.8 2.4 2.8 2.8 V12.6 C4.8 12.2 6.8 12.4 8 13.3"/>
      <path d="M8 3.5 C9.2 2.6 11.2 2.4 13.2 2.8 V12.6 C11.2 12.2 9.2 12.4 8 13.3"/>
      <path d="M8 3.5 V13.3"/>
    </svg>
  ),
  ArrowUp: () => (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 12 V4 M4.5 7.5 L8 4 L11.5 7.5"/>
    </svg>
  ),
  ArrowDown: () => (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4 V12 M4.5 8.5 L8 12 L11.5 8.5"/>
    </svg>
  ),
  Folder: () => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M1.75 4.25 a1 1 0 0 1 1 -1 h3.2 l1.5 1.5 h5.8 a1 1 0 0 1 1 1 v6.5 a1 1 0 0 1 -1 1 h-10.5 a1 1 0 0 1 -1 -1 z"/>
    </svg>
  ),
  // A views folder in the list: filled, in the accent colour (CSS), open
  // while its views show.
  FolderClosed: () => (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h4.1l1.8 1.8h7.1A1.5 1.5 0 0 1 18 7.3v7.2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 14.5z"/>
    </svg>
  ),
  FolderOpen: () => (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h4.1l1.8 1.8h7.1A1.5 1.5 0 0 1 18 7.3V8H6.2a2 2 0 0 0-1.9 1.4L2 15.6z" opacity=".55"/>
      <path d="M4.9 9.6A1.2 1.2 0 0 1 6 8.8h12.3a.8.8 0 0 1 .8 1l-1.6 5.3a1.2 1.2 0 0 1-1.1.9H2.6a.5.5 0 0 1-.5-.6z"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3 L11 8 L5 13"/>
    </svg>
  ),
  Settings: () => (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 4.5 h3 M7 4.5 h7"/>
      <circle cx="5" cy="4.5" r="1.5"/>
      <path d="M2 11.5 h7 M11 11.5 h3"/>
      <circle cx="9.5" cy="11.5" r="1.5"/>
    </svg>
  ),
  Search: () => (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5"/>
      <path d="M13 13 L10.2 10.2"/>
    </svg>
  ),
}

// ── Nodes filter bar (search + type chips + bulk show/hide) ─────────────────
// Filters what the Nodes tree *displays* (client-side, by label/description/
// technology/type). "Show matches" / "Hide matches" additionally write the
// matched set into the active view's nodeIds via the same store actions the
// per-node eye toggle already uses.

/** Format a timestamp as "just now", "5m ago", "3h ago", "2d ago", "MMM d" */
function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.round(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ── Milestone list (left panel) ──────────────────────────────────────────────
// Milestones are saved snapshots of the architecture used to track how the
// model evolves over time. Clicking a milestone does NOT restore — it is
// purely informational (and used for linking to presentation slides).

function SnapshotList({ readOnly = false, onOpenProps }: { readOnly?: boolean; onOpenProps?: (snapId: string) => void }) {
  const snapshots = useDiagramStore((s) => s.snapshots)
  const activeSnapshotId = useDiagramStore((s) => s.activeSnapshotId)
  const createSnapshot = useDiagramStore((s) => s.createSnapshot)
  const viewMilestoneDiff = useDiagramStore((s) => s.selectMilestone)
  const clearMilestoneView = useDiagramStore((s) => s.discardMilestoneChanges)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const confirmCreate = () => {
    const name = newName.trim()
    if (name) createSnapshot(name)
    setCreating(false)
    setNewName('')
  }

  return (
    <div className="lp-snap-list">
      {!readOnly && (
        creating ? (
          <div className="lp-inline-form">
            <input
              className="lp-inline-input"
              autoFocus
              placeholder="Milestone name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmCreate()
                if (e.key === 'Escape') { setCreating(false); setNewName('') }
              }}
            />
            <button className="lp-icon-btn primary" title="Create" onClick={confirmCreate}><Icon.Check /></button>
            <button className="lp-icon-btn" title="Cancel" onClick={() => { setCreating(false); setNewName('') }}><Icon.Close /></button>
          </div>
        ) : (
          <button className="lp-add-btn" onClick={() => { setNewName(`v${snapshots.length + 1}`); setCreating(true) }}>
            <Icon.Plus /> New milestone
          </button>
        )
      )}
      {snapshots.length === 0 && !creating && (
        <div className="lp-empty-state">
          <span className="lp-empty-icon"><Icon.Camera /></span>
          <span>No milestones yet</span>
        </div>
      )}
      {/* Virtual "current live state" entry — always shown at the top of the
          milestone list so the user can quickly return to the working HEAD
          (and visually understand it as the newest, still-unsaved milestone). */}
      <div
        className={`lp-card lp-snap-card lp-snap-current${!activeSnapshotId ? ' active' : ''}`}
        onClick={() => { if (activeSnapshotId) clearMilestoneView() }}
        title="Current working state (live HEAD) — not yet saved as a milestone"
      >
        <div className="lp-snap-badge lp-snap-badge-live">●</div>
        <div className="lp-card-body">
          <div className="lp-card-title">Current (live)</div>
          <div className="lp-card-meta">
            <span>working state</span>
            <span className="lp-meta-dot">·</span>
            <span>newest</span>
          </div>
        </div>
      </div>
      {[...snapshots].reverse().map((snap, idx) => {
        const isActive = activeSnapshotId === snap.id
        const versionNum = snapshots.length - idx
        const nodeCount = Object.keys(snap.nodes).length
        return (
          <div
            key={snap.id}
            className={`lp-card lp-snap-card${isActive ? ' active' : ''}`}
            onClick={() => viewMilestoneDiff(snap.id)}
            title={`${new Date(snap.timestamp).toLocaleString()}\nClick to load this milestone onto the canvas`}
          >
            <div className="lp-snap-badge">v{versionNum}</div>
            <div className="lp-card-body">
              <div className="lp-card-title">{snap.name}</div>
              <div className="lp-card-meta">
                <span>{formatRelative(snap.timestamp)}</span>
                <span className="lp-meta-dot">·</span>
                <span>{nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}</span>
              </div>
            </div>
            {!readOnly && onOpenProps && (
              <div className="lp-card-actions">
                <button
                  className="lp-icon-btn"
                  title="Milestone properties"
                  onClick={(e) => { e.stopPropagation(); onOpenProps(snap.id) }}
                ><Icon.Settings /></button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Sequence list ─────────────────────────────────────────────────────────────

function SequenceList({ readOnly = false, compact = false }: { readOnly?: boolean; compact?: boolean }) {
  const sequences = useDiagramStore((s) => s.sequences)
  const activeSequenceId = useDiagramStore((s) => s.activeSequenceId)
  const setActiveSequence = useDiagramStore((s) => s.setActiveSequence)
  const addSequence = useDiagramStore((s) => s.addSequence)
  const removeFromSequence = useDiagramStore((s) => s.removeFromSequence)
  const reorderSequence = useDiagramStore((s) => s.reorderSequence)
  const clearSequence = useDiagramStore((s) => s.clearSequence)
  const updateStepDescription = useDiagramStore((s) => s.updateStepDescription)
  const c4Nodes = useDiagramStore((s) => s.c4Nodes)
  const c4Relations = useDiagramStore((s) => s.c4Relations)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  const seqList = Object.values(sequences)

  const btnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', padding: '2px 3px', borderRadius: 3,
    display: 'flex', alignItems: 'center', lineHeight: 1,
  }

  return (
    <div className="lp-view-list">
      {seqList.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 4px', textAlign: 'center', opacity: 0.55, fontStyle: 'italic' }}>
          No sequences yet
        </div>
      )}
      {seqList.map((seq) => {
        const isActive = activeSequenceId === seq.id
        const isExpanded = compact ? expandedIds.has(seq.id) : (isActive)
        return (
          <div key={seq.id}>
            <div
              className={`lp-card lp-view-card${isActive ? ' active' : ''}`}
              style={{ ['--kind-color' as string]: SECTION_COLORS.sequences }}
              onClick={() => setActiveSequence(isActive ? null : seq.id)}
            >
              <div className="lp-view-icon">
                <Icon.Bolt />
              </div>
              <div className="lp-card-body">
                <div className="lp-card-title">{seq.name}</div>
                <div className="lp-card-meta">
                  <span>{seq.relationIds.length} {seq.relationIds.length === 1 ? 'step' : 'steps'}</span>
                  {isActive && <span style={{ marginLeft: 4, color: 'var(--accent)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>editing</span>}
                </div>
              </div>
            </div>
            {/* Inline step detail */}
            {((!compact && isActive) || (compact && isExpanded)) && seq.relationIds.length > 0 && (
              <div style={{ padding: '2px 8px 8px', borderLeft: '2px solid var(--accent)', marginLeft: 10 }}>
                <div style={{ display: 'grid', gap: 3, marginBottom: 4, minWidth: 0 }}>
                  {/* Keyed by place too: a relation may be a step more than once,
                      and rows keyed by its id alone kept a removed copy listed
                      (with its index), so a second Remove took another step. */}
                  {seq.relationIds.map((relId, idx) => {
                    const rel = c4Relations[relId]
                    const src = rel ? c4Nodes[rel.sourceId] : null
                    const tgt = rel ? c4Nodes[rel.targetId] : null
                    const stepDesc = seq.stepDescriptions?.[idx]
                    return (
                      <div key={`${relId}-${idx}`} className="seq-step" style={{ display: 'flex', alignItems: 'flex-start', gap: 5, background: 'var(--surface-2,rgba(255,255,255,0.04))', borderRadius: 5, padding: '4px 6px' }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: '50%',
                          background: 'var(--accent)', color: '#fff',
                          fontSize: 10, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginTop: 1,
                        }}>{idx + 1}</span>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 11, lineHeight: 1.35 }}>
                          <div style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {src?.label ?? '?'} → {tgt?.label ?? '?'}
                          </div>
                          {rel?.label && (
                            <div style={{ color: 'var(--text-muted)', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {rel.label}
                            </div>
                          )}
                          {!readOnly && (
                            <input
                              className="props-input"
                              defaultValue={stepDesc ?? ''}
                              placeholder={rel?.label || 'Add step note…'}
                              onBlur={(e) => updateStepDescription(seq.id, idx, e.currentTarget.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                              style={{ marginTop: 3, fontSize: 10, padding: '2px 4px', width: '100%', boxSizing: 'border-box' }}
                            />
                          )}
                          {readOnly && stepDesc && (
                            <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 1, fontStyle: 'italic' }}>
                              {stepDesc}
                            </div>
                          )}
                        </div>
                        {!readOnly && (
                          <div className="seq-step-actions">
                            <button
                              style={{ ...btnStyle, opacity: idx === 0 ? 0.3 : 1 }}
                              disabled={idx === 0}
                              onClick={() => reorderSequence(seq.id, idx, idx - 1)}
                              title="Move up"
                            ><Icon.ArrowUp /></button>
                            <button
                              style={{ ...btnStyle, opacity: idx === seq.relationIds.length - 1 ? 0.3 : 1 }}
                              disabled={idx === seq.relationIds.length - 1}
                              onClick={() => reorderSequence(seq.id, idx, idx + 1)}
                              title="Move down"
                            ><Icon.ArrowDown /></button>
                            <button
                              style={{ ...btnStyle, color: 'var(--danger, #ef4444)' }}
                              onClick={() => removeFromSequence(seq.id, idx)}
                              title="Remove step"
                            ><Icon.Close /></button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {!readOnly && (
                  <button
                    onClick={() => clearSequence(seq.id)}
                    style={{
                      width: '100%',
                      fontSize: 11,
                      padding: '4px 0',
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    Clear all steps
                  </button>
                )}
              </div>
            )}
            {(!compact && isActive && seq.relationIds.length === 0) && (
              <div style={{ padding: '4px 10px 8px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', opacity: 0.6 }}>
                Click relations on canvas to add steps
              </div>
            )}
          </div>
        )
      })}
      {!readOnly && (
        <button className="lp-add-btn" onClick={() => {
          const id = addSequence(`Sequence ${seqList.length + 1}`)
          setActiveSequence(id)
        }}>
          <Icon.Plus /> New sequence
        </button>
      )}
    </div>
  )
}

// ── View properties (left panel pane 2) ─────────────────────────────────────

function ViewPropertiesContent({ viewId, readOnly = false, onClose }: { viewId: string; readOnly?: boolean; onClose: () => void }) {
  const view = useDiagramStore((s) => s.views[viewId])
  const sequences = useDiagramStore((s) => s.sequences)
  const renameView = useDiagramStore((s) => s.renameView)
  const removeView = useDiagramStore((s) => s.removeView)
  const setViewKind = useDiagramStore((s) => s.setViewKind)
  const setViewSequence = useDiagramStore((s) => s.setViewSequence)
  const setViewLayoutMode = useDiagramStore((s) => s.setViewLayoutMode)
  const setWikiDepth = useDiagramStore((s) => s.setWikiDepth)
  const removeLayoutConstraint = useDiagramStore((s) => s.removeLayoutConstraint)
  const setAlignmentOrdered = useDiagramStore((s) => s.setAlignmentOrdered)
  const setGridColumns = useDiagramStore((s) => s.setGridColumns)
  const setActiveView = useDiagramStore((s) => s.setActiveView)
  const labels = useNodeLabels()
  const setViewFolder = useDiagramStore((s) => s.setViewFolder)
  const allViews = useDiagramStore((s) => s.views)
  const folderPaths = useMemo(() => viewFolderPaths(Object.values(allViews)), [allViews])
  const [editingFolder, setEditingFolder] = useState(false)
  const setViewEdgeStyle = useDiagramStore((s) => s.setViewEdgeStyle)
  const defaultEdgeStyle = useDiagramStore((s) => s.defaultEdgeStyle)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState('')
  const seqList = Object.values(sequences)

  const metamodel = useDiagramStore((s) => s.metamodel)
  const applyViewpoint = useDiagramStore((s) => s.applyViewpoint)
  const detachViewpoint = useDiagramStore((s) => s.detachViewpoint)
  const viewpoints = useMemo(() => viewpointsOf(metamodel), [metamodel])

  if (!view) return null
  const ofType = viewpointOfView(view, metamodel)
  const isDynamic = view.kind === 'dynamic'
  const isTreemap = view.kind === 'treemap'
  const isTable   = view.kind === 'table'
  const isMatrix  = view.kind === 'matrix'
  const isWiki    = view.kind === 'wiki'
  const isStatic  = !isDynamic && !isTreemap && !isTable && !isMatrix && !isWiki

  const commitName = () => {
    if (nameVal.trim()) renameView(view.id, nameVal.trim())
    setEditingName(false)
  }

  return (
    <div className="props-content">
      <div className="props-type-badge" style={{ background: isDynamic ? 'var(--accent)' : isTreemap ? '#2a3a5a' : isTable ? '#1e3a2a' : isMatrix ? '#3a1e3a' : isWiki ? '#3a2e1e' : '#334155', color: '#fff' }}>
        {isDynamic ? <Icon.Bolt /> : isTreemap ? <Icon.TreemapGrid /> : isTable ? <Icon.TableGrid /> : isMatrix ? <Icon.MatrixGrid /> : isWiki ? <Icon.Wiki /> : <Icon.Layers />}
        &nbsp;{isDynamic ? 'FLOW VIEW' : isTreemap ? 'HIERARCHY VIEW' : isTable ? 'TABLE VIEW' : isMatrix ? 'MATRIX VIEW' : isWiki ? 'WIKI VIEW' : 'STRUCTURE VIEW'}
        {ofType && <>&nbsp;·&nbsp;{ofType.label.toUpperCase()}</>}
      </div>
      <div>
        <div className="props-section-title">Name</div>
        <div className="props-field">
          {editingName ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <input className="props-input" autoFocus value={nameVal}
                onChange={(e) => setNameVal(e.target.value)} onBlur={commitName}
                onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
                style={{ flex: 1 }} />
              <button className="lp-icon-btn primary" onClick={commitName} title="Save"><Icon.Check /></button>
              <button className="lp-icon-btn" onClick={() => setEditingName(false)} title="Cancel"><Icon.Close /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '3px 0' }}>{view.name}</div>
              {!readOnly && (
                <button className="lp-icon-btn" title="Rename view"
                  onClick={() => { setNameVal(view.name); setEditingName(true) }}><Icon.Pencil /></button>
              )}
            </div>
          )}
        </div>
      </div>
      <div>
        <div className="props-section-title">Folder</div>
        <div className="props-field">
          {editingFolder ? (
            <ViewFolderPicker
              current={normalizeViewFolder(view.folder)}
              folders={folderPaths}
              onPick={(folder) => { setViewFolder(view.id, folder); setEditingFolder(false) }}
              onCancel={() => setEditingFolder(false)}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, fontSize: 12, padding: '3px 0', color: view.folder ? undefined : 'var(--text-muted)' }}>
                {view.folder || 'No folder'}
              </div>
              {!readOnly && (
                <button className="lp-icon-btn" title="Move to folder…"
                  onClick={() => setEditingFolder(true)}><Icon.Folder /></button>
              )}
            </div>
          )}
        </div>
      </div>
      {(!view.kind || view.kind === 'static') && (
        <div>
          <div className="props-section-title">Lines</div>
          <select
            className="props-input"
            aria-label="Lines"
            value={view.edgeStyle ?? ''}
            disabled={readOnly}
            onChange={(e) => setViewEdgeStyle(view.id, (e.target.value || null) as 'curved' | 'orthogonal' | null)}
            title="How this view draws relations; the model's setting is in the Radical menu"
          >
            <option value="">Model's ({defaultEdgeStyle === 'orthogonal' ? 'orthogonal' : 'curved'})</option>
            <option value="curved">Curved</option>
            <option value="orthogonal">Orthogonal</option>
          </select>
        </div>
      )}
      {/* The metamodel's viewpoints: a kind and a filter under a name; the
          view follows its viewpoint. A list, named for what it is. */}
      {!readOnly && viewpoints.length > 0 && (
        <div>
          <div className="props-section-title">Viewpoint <span className="props-section-note">from the metamodel</span></div>
          <select
            className={`props-input viewpoint-select${ofType ? ' set' : ''}`}
            aria-label="Viewpoint"
            value={ofType?.id ?? ''}
            onChange={(e) => (e.target.value ? applyViewpoint(view.id, e.target.value) : detachViewpoint(view.id))}
          >
            <option value="">None — view type and filter of its own</option>
            {viewpointGroups(viewpoints).map(({ group, viewpoints: list }) => (
              <optgroup key={group} label={group}>
                {list.map((t) => <option key={t.id} value={t.id}>{t.label} · {VIEW_KIND_LABELS[t.kind]}</option>)}
              </optgroup>
            ))}
          </select>
          <div className="viewpoint-help">
            {ofType
              ? <>{ofType.description ?? `A ${VIEW_KIND_LABELS[ofType.kind].toLowerCase()} with the viewpoint's filter.`} Its view type and filter follow the viewpoint; another view type detaches the view.</>
              : 'Pick one to give this view its view type and filter, kept in step with the metamodel.'}
          </div>
        </div>
      )}
      {!readOnly && (
        <div>
          <div className="props-section-title">View type</div>
          <div className="view-kind-grid" role="group" aria-label="View type">
            <button className={`view-kind-btn${isStatic ? ' active' : ''}`} aria-pressed={isStatic} onClick={() => setViewKind(view.id, 'static')}>
              <Icon.Layers /> Structure
            </button>
            <button className={`view-kind-btn${isDynamic ? ' active' : ''}`} aria-pressed={isDynamic} onClick={() => setViewKind(view.id, 'dynamic')}>
              <Icon.Bolt /> Flow
            </button>
            <button className={`view-kind-btn${isTreemap ? ' active' : ''}`} aria-pressed={isTreemap} onClick={() => setViewKind(view.id, 'treemap')}>
              <Icon.TreemapGrid /> Hierarchy
            </button>
            <button className={`view-kind-btn${isTable ? ' active' : ''}`} aria-pressed={isTable} onClick={() => setViewKind(view.id, 'table')}>
              <Icon.TableGrid /> Table
            </button>
            <button className={`view-kind-btn${isMatrix ? ' active' : ''}`} aria-pressed={isMatrix} onClick={() => setViewKind(view.id, 'matrix')}>
              <Icon.MatrixGrid /> Matrix
            </button>
            <button className={`view-kind-btn${isWiki ? ' active' : ''}`} aria-pressed={isWiki} onClick={() => setViewKind(view.id, 'wiki')}>
              <Icon.Wiki /> Wiki
            </button>
          </div>
        </div>
      )}
      {isWiki && (
        <div>
          <div className="props-section-title">Depth</div>
          <select
            aria-label="Depth"
            value={wikiDepthOf(view)}
            disabled={readOnly}
            onChange={(e) => setWikiDepth(view.id, Number(e.target.value))}
            className="props-input"
            style={{ cursor: readOnly ? 'default' : 'pointer', width: '100%' }}
            title="Multi page: how many levels of children are written out as chapters before the rest show as preview cards"
          >
            {Array.from({ length: WIKI_DEPTH_MAX - WIKI_DEPTH_MIN + 1 }, (_, i) => WIKI_DEPTH_MIN + i).map((n) => (
              <option key={n} value={n}>{n} level{n === 1 ? '' : 's'}</option>
            ))}
          </select>
        </div>
      )}
      {!readOnly && isStatic && (
        <div>
          <div className="props-section-title">Auto-layout</div>
          <select
            value={view.layoutMode ?? 'auto'}
            onChange={(e) => setViewLayoutMode(view.id, e.target.value as 'auto' | 'tree')}
            className="props-input"
            style={{ cursor: 'pointer', width: '100%' }}
            title="Layout strategy applied when running Smart Layout while this view is active. Use 'Hierarchical tree' for views dominated by domain objects."
          >
            <option value="auto">Auto (Smart Layout)</option>
            <option value="tree">Hierarchical nested tree</option>
          </select>
        </div>
      )}
      {(isStatic || isDynamic) && (view.layoutConstraints?.length ?? 0) > 0 && (
        <div>
          <div className="props-section-title">Layout rules</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {view.layoutConstraints!.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{c.type === 'grid' ? 'Grid' : c.type === 'pin' ? 'Pinned' : c.axis === 'horizontal' ? 'Row' : 'Column'}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}
                  title={c.nodeIds.map((id) => labels.get(id) ?? id).join(c.type === 'grid' || (c.type === 'align' && c.ordered) ? ' → ' : ', ')}>
                  {c.nodeIds.map((id) => labels.get(id) ?? id).join(c.type === 'grid' || (c.type === 'align' && c.ordered) ? ' → ' : ', ')}
                </span>
                {c.type === 'pin' ? null : c.type === 'grid' ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, color: 'var(--text-muted)' }} title="Columns; the cells fill row by row in the order listed">
                    <input
                      type="number"
                      min={1}
                      max={c.nodeIds.length}
                      value={c.columns}
                      disabled={readOnly}
                      onChange={(e) => {
                        const n = Math.round(Number(e.target.value))
                        if (n >= 1 && n <= c.nodeIds.length) setGridColumns(c.id, n, view.id)
                      }}
                      className="props-input"
                      style={{ width: 40, padding: '1px 4px', fontSize: 11 }}
                    />
                    columns
                  </label>
                ) : (
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, color: 'var(--text-muted)', cursor: readOnly ? 'default' : 'pointer' }}
                    title={c.axis === 'horizontal' ? 'Keep them left to right in the order listed (the order they were selected in)' : 'Keep them top to bottom in the order listed (the order they were selected in)'}
                  >
                    <input
                      type="checkbox"
                      checked={!!c.ordered}
                      disabled={readOnly}
                      onChange={(e) => setAlignmentOrdered(c.id, e.target.checked, view.id)}
                      style={{ margin: 0 }}
                    />
                    in order
                  </label>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeLayoutConstraint(c.id, view.id)}
                    title={c.type === 'pin' ? 'Unpin them: the live physics may move them again' : 'Stop keeping these elements aligned'}
                    aria-label={c.type === 'pin' ? 'Unpin all' : 'Remove alignment'}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}
                  >×</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {isDynamic && (
        <div>
          <div className="props-section-title">Sequence</div>
          {readOnly ? (
            <div style={{ fontSize: 11, color: 'var(--text)' }}>
              {view.sequenceId && sequences[view.sequenceId]
                ? sequences[view.sequenceId].name
                : <span style={{ opacity: 0.5, fontStyle: 'italic' }}>none</span>}
            </div>
          ) : (
            <select
              value={view.sequenceId ?? ''}
              onChange={(e) => setViewSequence(view.id, e.target.value || null)}
              className="props-input"
              style={{ cursor: 'pointer' }}
            >
              <option value="">— none —</option>
              {seqList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>
      )}
      {/* What the view shows, step by step: Structure on the right shows the
          result. A flow view plays its sequence instead. */}
      {view.kind !== 'dynamic' && <ViewPipelinePanel view={view} readOnly={readOnly} />}
      {!readOnly && (
        <button className="props-delete" onClick={() => { removeView(view.id); setActiveView(null); onClose() }}>
          🗑 Delete view
        </button>
      )}
    </div>
  )
}

// ── Milestone properties (left panel pane 2) ────────────────────────────────

function MilestonePropertiesContent({ snapId, readOnly = false, onClose }: { snapId: string; readOnly?: boolean; onClose: () => void }) {
  const snapshots = useDiagramStore((s) => s.snapshots)
  const renameSnapshot = useDiagramStore((s) => s.renameSnapshot)
  const removeSnapshot = useDiagramStore((s) => s.removeSnapshot)
  const restoreSnapshot = useDiagramStore((s) => s.restoreSnapshot)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState('')

  const snap = snapshots.find((s) => s.id === snapId)
  if (!snap) return null
  const versionNum = snapshots.indexOf(snap) + 1
  const nodeCount = Object.keys(snap.nodes).length
  const relationCount = Object.keys(snap.relations).length

  const commitName = () => {
    if (nameVal.trim()) renameSnapshot(snap.id, nameVal.trim())
    setEditingName(false)
  }

  return (
    <div className="props-content">
      <div className="props-type-badge" style={{ background: '#334155', color: '#94a3b8' }}>
        <Icon.Camera /> &nbsp;MILESTONE v{versionNum}
      </div>
      <div>
        <div className="props-section-title">Name</div>
        <div className="props-field">
          {editingName ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <input className="props-input" autoFocus value={nameVal}
                onChange={(e) => setNameVal(e.target.value)} onBlur={commitName}
                onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
                style={{ flex: 1 }} />
              <button className="lp-icon-btn primary" onClick={commitName} title="Save"><Icon.Check /></button>
              <button className="lp-icon-btn" onClick={() => setEditingName(false)} title="Cancel"><Icon.Close /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '3px 0' }}>{snap.name}</div>
              {!readOnly && (
                <button className="lp-icon-btn" title="Rename milestone"
                  onClick={() => { setNameVal(snap.name); setEditingName(true) }}><Icon.Pencil /></button>
              )}
            </div>
          )}
        </div>
      </div>
      <div>
        <div className="props-section-title">Saved</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {new Date(snap.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' } as any)}
        </div>
      </div>
      <div>
        <div className="props-section-title">Contents</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {nodeCount} node{nodeCount !== 1 ? 's' : ''} · {relationCount} relation{relationCount !== 1 ? 's' : ''}
        </div>
      </div>
      {!readOnly && (
        <>
          <button
            className="lp-icon-btn"
            style={{ justifyContent: 'center', width: '100%', padding: '6px 0', fontSize: 12, gap: 6, borderRadius: 6, marginTop: 4, display: 'flex', alignItems: 'center' }}
            title="Restore this milestone as the current live state"
            onClick={() => { restoreSnapshot(snap.id); onClose() }}
          >
            <Icon.Restore /> Restore to live
          </button>
          <button className="props-delete" onClick={() => { removeSnapshot(snap.id); onClose() }}>
            🗑 Delete milestone
          </button>
        </>
      )}
    </div>
  )
}

// ── View list (left panel) ────────────────────────────────────────────────────

const VIEW_BADGE_STYLE: React.CSSProperties = { marginLeft: 4, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }

/** Properties of a folder of the list of views: its name (renaming moves
 *  every view in it and below it along), where it sits, and its views. */
function FolderPropertiesContent({ path, readOnly = false, onRenamed }: {
  path: string
  readOnly?: boolean
  onRenamed: (path: string) => void
}) {
  const views = useDiagramStore((s) => s.views)
  const activeViewId = useDiagramStore((s) => s.activeViewId)
  const setActiveView = useDiagramStore((s) => s.setActiveView)
  const renameViewFolder = useDiagramStore((s) => s.renameViewFolder)
  const moveViewFolder = useDiagramStore((s) => s.moveViewFolder)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const inside = Object.values(views).filter((v) => isInViewFolder(v, path))
  const cut = path.lastIndexOf('/')
  const name = path.slice(cut + 1)
  const parent = cut < 0 ? '' : path.slice(0, cut)
  // Where the folder stands among the folders beside it.
  const siblings = useMemo(() => {
    let folder: ViewFolder | undefined = viewFolderTree(Object.values(views))
    for (const part of parent ? parent.split('/') : []) folder = folder?.folders.find((f) => f.name === part)
    return folder?.folders.map((f) => f.path) ?? []
  }, [views, parent])
  const place = siblings.indexOf(path)

  const commitName = () => {
    const next = nameVal.trim()
    if (!next || next === name) { setEditingName(false); setNameError(null); return }
    if (next.includes('/')) { setNameError('A folder name holds no "/".'); return }
    const to = renameViewFolder(path, next)
    if (to === null) { setNameError('This folder cannot be renamed.'); return }
    setEditingName(false)
    setNameError(null)
    onRenamed(to)
  }

  if (inside.length === 0) {
    return <div className="props-content"><div className="lp-empty-state">No view is in this folder any more.</div></div>
  }
  return (
    <div className="props-content">
      <div className="props-type-badge" style={{ background: '#334155', color: '#fff' }}>
        <Icon.Folder />&nbsp;FOLDER
      </div>
      <div>
        <div className="props-section-title">Name</div>
        <div className="props-field">
          {editingName ? (
            <>
              <div style={{ display: 'flex', gap: 4 }}>
                <input className="props-input" autoFocus value={nameVal} aria-label="Folder name"
                  onChange={(e) => { setNameVal(e.target.value); setNameError(null) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setEditingName(false); setNameError(null) } }}
                  style={{ flex: 1 }} />
                <button className="lp-icon-btn primary" onClick={commitName} title="Save"><Icon.Check /></button>
                <button className="lp-icon-btn" onClick={() => { setEditingName(false); setNameError(null) }} title="Cancel"><Icon.Close /></button>
              </div>
              {nameError && <div className="lp-folder-error" role="alert">{nameError}</div>}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '3px 0' }}>{name}</div>
              {!readOnly && (
                <button className="lp-icon-btn" title="Rename folder"
                  onClick={() => { setNameVal(name); setEditingName(true) }}><Icon.Pencil /></button>
              )}
            </div>
          )}
        </div>
      </div>
      <div>
        <div className="props-section-title">In</div>
        <div style={{ fontSize: 12, color: parent ? undefined : 'var(--text-muted)' }}>{parent || 'Top of the list'}</div>
      </div>
      {!readOnly && siblings.length > 1 && (
        <div>
          <div className="props-section-title">Order · {place + 1} of {siblings.length}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <button className="lp-order-btn" disabled={place <= 0} onClick={() => moveViewFolder(path, -1)}>
              <Icon.ArrowUp /> Move up
            </button>
            <button className="lp-order-btn" disabled={place < 0 || place >= siblings.length - 1} onClick={() => moveViewFolder(path, 1)}>
              <Icon.ArrowDown /> Move down
            </button>
          </div>
        </div>
      )}
      <div>
        <div className="props-section-title">Views · {inside.length}</div>
        <div className="lp-folder-views">
          {inside.map((v) => {
            const sub = normalizeViewFolder(v.folder).slice(path.length + 1)
            return (
              <button key={v.id} className={`lp-folder-choice${activeViewId === v.id ? ' active' : ''}`}
                onClick={() => setActiveView(v.id)} title={`Open ${v.name}`}>
                <span>{sub ? `${sub} / ` : ''}{v.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Picks a folder for a view: one in use (the list narrows as you type),
 *  or a new path typed as "C4/Components". */
function ViewFolderPicker({ current, folders, onPick, onCancel }: {
  current: string
  folders: string[]
  onPick: (folder: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(current)
  const pick = () => onPick(normalizeViewFolder(value))
  const typed = normalizeViewFolder(value).toLowerCase()
  const shown = folders.filter((f) => f !== current && (!typed || typed === current.toLowerCase() || f.toLowerCase().includes(typed)))
  return (
    <div className="lp-folder-picker" onClick={(e) => e.stopPropagation()}>
      <div className="lp-inline-form">
        <input className="lp-inline-input" autoFocus value={value}
          placeholder="Folder, e.g. C4/Components" aria-label="Folder"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') pick(); if (e.key === 'Escape') onCancel() }} />
        <button className="lp-icon-btn primary" onClick={pick} title="Move"><Icon.Check /></button>
        <button className="lp-icon-btn" onClick={onCancel} title="Cancel"><Icon.Close /></button>
      </div>
      {(shown.length > 0 || current) && (
        <div className="lp-folder-choices">
          {current && (
            <button className="lp-folder-choice" onClick={() => onPick('')}><span>No folder</span></button>
          )}
          {shown.map((f) => (
            <button key={f} className="lp-folder-choice" title={`Move to ${f}`} onClick={() => onPick(f)}>
              <Icon.Folder /><span>{f}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Groups in two columns of about the same height, each group kept whole
 *  and in order within its column: each goes to the shorter column. */
function balancedColumns<T extends { viewpoints: unknown[] }>(groups: T[]): T[][] {
  const columns: T[][] = [[], []]
  const height = [0, 0]
  for (const g of groups) {
    const c = height[1] < height[0] ? 1 : 0
    columns[c].push(g)
    height[c] += g.viewpoints.length + 1
  }
  return columns.filter((c) => c.length)
}

/** The icon of each view type a viewpoint can have, as the view type buttons show it. */
const VIEW_KIND_ICONS: Record<ViewpointKind, () => React.ReactElement> = {
  static: Icon.Layers, table: Icon.TableGrid, treemap: Icon.TreemapGrid, matrix: Icon.MatrixGrid, wiki: Icon.Wiki,
}

function ViewList({ readOnly = false, onOpenProps, onOpenFolder }: {
  readOnly?: boolean
  onOpenProps?: (viewId: string) => void
  onOpenFolder?: (path: string) => void
}) {
  const views = useDiagramStore((s) => s.views)
  const activeViewId = useDiagramStore((s) => s.activeViewId)
  const setActiveView = useDiagramStore((s) => s.setActiveView)
  const addView = useDiagramStore((s) => s.addView)
  const addViewOfViewpoint = useDiagramStore((s) => s.addViewOfViewpoint)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const viewpoints = useMemo(() => viewpointsOf(metamodel), [metamodel])
  // New view offers a blank view and the metamodel's viewpoints.
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const newMenuRef = useRef<HTMLDivElement>(null)
  const newMenuPopRef = useRef<HTMLDivElement>(null)
  useOutsideClick([newMenuRef, newMenuPopRef], newMenuOpen, useCallback(() => setNewMenuOpen(false), []))
  // The menu is wider than the panel, which clips what overflows it: it
  // opens over the app, by the button, as wide as two columns need.
  const [newMenuAt, setNewMenuAt] = useState<React.CSSProperties>({})
  const placeNewMenu = useCallback(() => {
    const r = newMenuRef.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.max(r.width, Math.min(620, window.innerWidth - r.left - 16))
    // Above the button when there is more room there (a long list of
    // views), else below it (a new model, the button near the top).
    const above = r.top > window.innerHeight - r.bottom
    setNewMenuAt(above
      ? { left: r.left, width, bottom: window.innerHeight - r.top + 6, maxHeight: r.top - 16 }
      : { left: r.left, width, top: r.bottom + 6, maxHeight: window.innerHeight - r.bottom - 16 })
  }, [])
  // Before the menu is painted: it would show unplaced, as tall as all of it, for a frame.
  useLayoutEffect(() => {
    if (!newMenuOpen) return
    placeNewMenu()
    window.addEventListener('resize', placeNewMenu)
    return () => window.removeEventListener('resize', placeNewMenu)
  }, [newMenuOpen, placeNewMenu])
  useEffect(() => {
    if (!newMenuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNewMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newMenuOpen])
  const openNew = (id: string | null) => {
    setNewMenuOpen(false)
    if (!id) return
    setActiveView(id)
    if (onOpenProps) onOpenProps(id)
  }
  const totalNodes = useDiagramStore((s) => Object.keys(s.c4Nodes).length)
  const counts = useViewNodeCounts(views)
  const viewList = Object.values(views)
  const tree = useMemo(() => viewFolderTree(viewList), [views])
  // Folders start open; the one holding the active view opens again.
  const [closed, setClosed] = useState<Set<string>>(() => new Set())
  const activeFolder = activeViewId ? normalizeViewFolder(views[activeViewId]?.folder) : ''
  useEffect(() => {
    if (!activeFolder) return
    setClosed((prev) => {
      const ancestors = activeFolder.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/'))
      if (!ancestors.some((p) => prev.has(p))) return prev
      const next = new Set(prev)
      ancestors.forEach((p) => next.delete(p))
      return next
    })
  }, [activeFolder])
  const toggleFolder = (path: string) => setClosed((prev) => {
    const next = new Set(prev)
    if (next.has(path)) next.delete(path); else next.add(path)
    return next
  })

  const renderView = (v: DiagramView) => {
    const isActive = activeViewId === v.id
    const isDynamic = v.kind === 'dynamic'
    const isTreemap = v.kind === 'treemap'
    const isTable   = v.kind === 'table'
    const isMatrix  = v.kind === 'matrix'
    const isWiki    = v.kind === 'wiki'
    const badge = isDynamic ? 'flow' : isTreemap ? 'hierarchy' : isTable ? 'table' : isMatrix ? 'matrix' : isWiki ? 'wiki' : 'structure'
    // A view of a viewpoint names it too, after its view type.
    const viewpoint = viewpointOfView(v, metamodel)
    return (
      <div key={v.id}>
        <div
          className={`lp-card lp-view-card${isActive ? ' active' : ''}`}
          style={{ ['--kind-color' as string]: VIEW_KIND_COLORS[badge] }}
          onClick={() => setActiveView(v.id)}
        >
          <div className="lp-view-icon">
            {isDynamic ? <Icon.Bolt /> : isTreemap ? <Icon.TreemapGrid /> : isTable ? <Icon.TableGrid /> : isMatrix ? <Icon.MatrixGrid /> : isWiki ? <Icon.Wiki /> : <Icon.Layers />}
          </div>
          <div className="lp-card-body">
            <div className="lp-card-title">{v.name}</div>
            <div className="lp-card-meta">
              <span>{viewNodeCount(v, counts[v.id])}</span>
              <span className="lp-view-kind" style={VIEW_BADGE_STYLE}>{badge}</span>
            </div>
            {viewpoint && (
              <div className="lp-card-viewpoint" title={viewpoint.description ?? `Viewpoint ${viewpoint.label}`}>
                <span className="lp-card-viewpoint-kind">Viewpoint</span> {viewpoint.label}
              </div>
            )}
          </div>
          {!readOnly && onOpenProps && (
            <div className="lp-card-actions">
              <button
                className="lp-icon-btn"
                onClick={(e) => { e.stopPropagation(); onOpenProps(v.id) }}
                title="View properties"
              ><Icon.Settings /></button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderFolder = (folder: ViewFolder): React.ReactNode => {
    const open = !closed.has(folder.path)
    return (
      <div key={`folder:${folder.path}`} className="lp-folder">
        <div className={`lp-folder-row${open ? ' open' : ''}`}>
          <button
            className="lp-folder-toggle"
            onClick={() => toggleFolder(folder.path)}
            aria-expanded={open}
            title={folder.path}
          >
            <span className="lp-folder-chevron"><Icon.ChevronRight /></span>
            <span className="lp-folder-icon">{open ? <Icon.FolderOpen /> : <Icon.FolderClosed />}</span>
            <span className="lp-folder-name">{folder.name}</span>
            <span className="lp-folder-count">{folder.count}</span>
          </button>
          {!readOnly && onOpenFolder && (
            <button
              className="lp-icon-btn lp-folder-props"
              onClick={() => onOpenFolder(folder.path)}
              title="Folder properties"
            ><Icon.Settings /></button>
          )}
        </div>
        {open && (
          <div className="lp-folder-body">
            {folder.entries.map((entry) => ('folder' in entry ? renderFolder(entry.folder) : renderView(entry.view)))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="lp-view-list">
      {/* All elements: the whole model as a table, always first and never
          deleted. A canvas of the whole model is a structure view that
          lists no elements. */}
      <div
        className={`lp-card lp-view-card${activeViewId === null ? ' active' : ''}`}
        style={{ ['--kind-color' as string]: VIEW_KIND_COLORS.table }}
        onClick={() => setActiveView(null)}
      >
        <div className="lp-view-icon"><Icon.TableGrid /></div>
        <div className="lp-card-body">
          <div className="lp-card-title">All elements</div>
          <div className="lp-card-meta">
            <span>{totalNodes} {totalNodes === 1 ? 'node' : 'nodes'}</span>
            <span className="lp-view-kind" style={VIEW_BADGE_STYLE}>table</span>
          </div>
        </div>
      </div>
      {tree.entries.map((entry) => ('folder' in entry ? renderFolder(entry.folder) : renderView(entry.view)))}
      {!readOnly && (
        <div className="lp-add-view" ref={newMenuRef}>
          <button className="lp-add-btn" aria-expanded={viewpoints.length ? newMenuOpen : undefined} onClick={() => {
            if (viewpoints.length) setNewMenuOpen((o) => !o)
            else openNew(addView(`View ${viewList.length + 1}`, 'table'))
          }}>
            <Icon.Plus /> New view
          </button>
          {newMenuOpen && createPortal(
            <div className="lp-add-view-menu" role="menu" aria-label="New view" ref={newMenuPopRef} style={newMenuAt}>
              <div className="lp-add-view-head">New view</div>
              <button className="lp-add-view-option" role="menuitem" onClick={() => openNew(addView(`View ${viewList.length + 1}`, 'table'))}>
                <span className="lp-add-view-icon"><Icon.Plus /></span>
                <span className="lp-add-view-text">
                  <span className="lp-add-view-name">Blank view</span>
                  <span className="lp-add-view-desc">A table of every element; pick its view type and filter in its properties.</span>
                </span>
              </button>
              <div className="lp-add-view-section">Viewpoints <span>from the metamodel</span></div>
              <div className="lp-add-view-groups">
                {balancedColumns(viewpointGroups(viewpoints)).map((column, c) => (
                  <div key={c} className="lp-add-view-column">
                {column.map(({ group, viewpoints: list }) => (
                  <div key={group} className="lp-add-view-group" role="group" aria-label={group}>
                    <div className="lp-add-view-group-name">{group}</div>
                    {list.map((t) => {
                      const KindIcon = VIEW_KIND_ICONS[t.kind]
                      return (
                        <button key={t.id} className="lp-add-view-option" role="menuitem" title={t.description}
                          onClick={() => openNew(addViewOfViewpoint(t.id))}>
                          <span className="lp-add-view-icon"><KindIcon /></span>
                          <span className="lp-add-view-text">
                            <span className="lp-add-view-name">{t.label}<span className="lp-add-view-kind">{VIEW_KIND_LABELS[t.kind]}</span></span>
                            {t.description && <span className="lp-add-view-desc">{t.description}</span>}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ))}
                  </div>
                ))}
              </div>
            </div>,
            document.body,
          )}
        </div>
      )}
    </div>
  )
}

// ── LeftPanel (accordion) ────────────────────────────────────────────────────

// ── Left panel width (drag handle on its inner edge) ────────────────────────

const LEFT_PANEL_WIDTH_KEY = 'radical.leftPanelWidth'
const LEFT_PANEL_MIN = 200
const LEFT_PANEL_MAX = 560

function clampLeftPanelWidth(width: number): number {
  return Math.round(Math.min(LEFT_PANEL_MAX, Math.max(LEFT_PANEL_MIN, width)))
}

/** Sets the left panel's width on the layout grid (`--left-panel-w`); null
 *  goes back to the stylesheet's default. */
function applyLeftPanelWidth(layout: HTMLElement | null, width: number | null): void {
  if (!layout) return
  if (width === null) layout.style.removeProperty('--left-panel-w')
  else layout.style.setProperty('--left-panel-w', `${width}px`)
}

/** Drag handle on the left panel's inner edge: drag to widen or narrow the
 *  panel, double-click for its default width. The width is kept in this
 *  browser. */
function LeftPanelResizer() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let saved: number | null = null
    try {
      const raw = localStorage.getItem(LEFT_PANEL_WIDTH_KEY)
      if (raw && Number.isFinite(Number(raw))) saved = clampLeftPanelWidth(Number(raw))
    } catch { /* storage unavailable */ }
    if (saved !== null) applyLeftPanelWidth(ref.current?.closest('.app-layout') ?? null, saved)
  }, [])
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const panel = ref.current?.parentElement
    const layout = ref.current?.closest<HTMLElement>('.app-layout') ?? null
    if (!panel || !layout) return
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startWidth = panel.getBoundingClientRect().width
    let width = startWidth
    layout.classList.add('lp-resizing')
    const move = (ev: PointerEvent) => {
      width = clampLeftPanelWidth(startWidth + ev.clientX - startX)
      applyLeftPanelWidth(layout, width)
    }
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      layout.classList.remove('lp-resizing')
      try { localStorage.setItem(LEFT_PANEL_WIDTH_KEY, String(width)) } catch { /* storage unavailable */ }
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }
  const onDoubleClick = () => {
    applyLeftPanelWidth(ref.current?.closest<HTMLElement>('.app-layout') ?? null, null)
    try { localStorage.removeItem(LEFT_PANEL_WIDTH_KEY) } catch { /* storage unavailable */ }
  }
  return (
    <div ref={ref} className="panel-resize" role="separator" aria-orientation="vertical"
      aria-label="Resize panel" title="Drag to resize · double-click for the default width"
      onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} />
  )
}

// ── Panel collapse toggle (chevron tab on inner edge) ────────────────────────

function PanelToggle({ side, collapsed, onToggle }: {
  side: 'left' | 'right'
  collapsed: boolean
  onToggle: () => void
}) {
  // Chevron points "outward" when collapsed (to expand), "inward" when expanded
  const pointsLeft = (side === 'left' && collapsed) || (side === 'right' && !collapsed)
    ? false
    : true
  return (
    <button
      className={`panel-toggle panel-toggle-${side}${collapsed ? ' collapsed' : ''}`}
      onClick={onToggle}
      title={collapsed ? 'Expand panel' : 'Collapse panel'}
      aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
    >
      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {pointsLeft ? <path d="M10 4 L6 8 L10 12" /> : <path d="M6 4 L10 8 L6 12" />}
      </svg>
    </button>
  )
}

export function LeftPanel({ mode = 'designer', readOnly = false, collapsed = false, onToggleCollapsed }: {
  mode?: 'designer' | 'viewer' | 'presenter'
  readOnly?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
}) {
  const isReadOnly = readOnly || mode !== 'designer'
  const viewsCount = useDiagramStore((s) => Object.keys(s.views).length)
  const snapshotsCount = useDiagramStore((s) => s.snapshots.length)
  const sequencesCount = useDiagramStore((s) => Object.keys(s.sequences).length)
  // What each folded section says it holds.
  const activeViewName = useDiagramStore((s) => (s.activeViewId ? s.views[s.activeViewId]?.name : undefined))
  const latestMilestone = useDiagramStore((s) => s.snapshots[s.snapshots.length - 1]?.name)
  const sequenceNames = useDiagramStore(useCallback((s: { sequences: Record<string, { name: string }> }) =>
    Object.values(s.sequences).map((q) => q.name).join(', '), []))
  // The element types are in the palette on the canvas (ElementPalette).
  // One section open at a time; a click on the open one folds it.
  const [openSection, setOpenSection] = useState<'views' | 'milestones' | 'sequences' | null>('views')
  type PaneContent = { kind: 'view'; id: string } | { kind: 'milestone'; id: string } | { kind: 'folder'; id: string }
  const [paneContent, setPaneContent] = useState<PaneContent | null>(null)
  const hasPaneContent = !!paneContent

  const toggle = onToggleCollapsed && (
    <PanelToggle side="left" collapsed={collapsed} onToggle={onToggleCollapsed} />
  )

  return (
    <div className={`left-panel${collapsed ? ' collapsed' : ''}`}>
      <div className="panel-content">
        <div className={`rp-slider${hasPaneContent ? ' show-props' : ''}`}>

          {/* Pane 1 — accordion */}
          <div className="rp-pane lp-sections">
            <AccordionSection title="Views" icon="views" count={viewsCount} preview={`Open: ${activeViewName ?? 'All elements'}`}
              open={openSection === 'views'} onToggle={() => setOpenSection((o) => (o === 'views' ? null : 'views'))}>
              <ViewList
                readOnly={isReadOnly}
                onOpenProps={!isReadOnly ? (id) => { setPaneContent({ kind: 'view', id }); setOpenSection('views') } : undefined}
                onOpenFolder={!isReadOnly ? (path) => { setPaneContent({ kind: 'folder', id: path }); setOpenSection('views') } : undefined}
              />
            </AccordionSection>
            <AccordionSection title="Milestones" icon="milestones" count={snapshotsCount}
              preview={latestMilestone ? `Latest: ${latestMilestone}` : 'None saved yet'}
              open={openSection === 'milestones'} onToggle={() => setOpenSection((o) => (o === 'milestones' ? null : 'milestones'))}>
              <SnapshotList readOnly={isReadOnly} onOpenProps={!isReadOnly ? (id) => { setPaneContent({ kind: 'milestone', id }); setOpenSection('milestones') } : undefined} />
            </AccordionSection>
            <AccordionSection title="Sequences" icon="sequences" count={sequencesCount}
              preview={sequenceNames || 'None yet'}
              open={openSection === 'sequences'} onToggle={() => setOpenSection((o) => (o === 'sequences' ? null : 'sequences'))}>
              <SequenceList readOnly={isReadOnly} compact={true} />
            </AccordionSection>
          </div>

          {/* Pane 2 — view / milestone properties */}
          <div className="rp-pane">
            <button className="rp-back-btn" onClick={() => setPaneContent(null)}>◀ Back</button>
            {paneContent?.kind === 'view' && (
              <ViewPropertiesContent
                viewId={paneContent.id}
                readOnly={isReadOnly}
                onClose={() => setPaneContent(null)}
              />
            )}
            {paneContent?.kind === 'folder' && (
              <FolderPropertiesContent
                path={paneContent.id}
                readOnly={isReadOnly}
                onRenamed={(path) => setPaneContent({ kind: 'folder', id: path })}
              />
            )}
            {paneContent?.kind === 'milestone' && (
              <MilestonePropertiesContent
                snapId={paneContent.id}
                readOnly={isReadOnly}
                onClose={() => setPaneContent(null)}
              />
            )}
          </div>

        </div>
      </div>
      {!collapsed && <LeftPanelResizer />}
      {toggle}
    </div>
  )
}

// ── RightPanel (tree + properties accordion) ──────────────────────────────────

function SequencePropertiesContent({ sequenceId, readOnly = false }: { sequenceId: string; readOnly?: boolean }) {
  const seq = useDiagramStore((s) => s.sequences[sequenceId])
  const c4Nodes = useDiagramStore((s) => s.c4Nodes)
  const c4Relations = useDiagramStore((s) => s.c4Relations)
  const renameSequence = useDiagramStore((s) => s.renameSequence)
  const removeSequence = useDiagramStore((s) => s.removeSequence)
  const removeFromSequence = useDiagramStore((s) => s.removeFromSequence)
  const reorderSequence = useDiagramStore((s) => s.reorderSequence)
  const clearSequence = useDiagramStore((s) => s.clearSequence)
  const updateStepDescription = useDiagramStore((s) => s.updateStepDescription)
  const setActiveSequence = useDiagramStore((s) => s.setActiveSequence)
  const addViewFromSequence = useDiagramStore((s) => s.addViewFromSequence)
  const views = useDiagramStore((s) => s.views)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState('')

  if (!seq) return null

  const commitName = () => {
    if (nameVal.trim()) renameSequence(seq.id, nameVal.trim())
    setEditingName(false)
  }

  const btnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', padding: '2px 3px', borderRadius: 3,
    display: 'flex', alignItems: 'center', lineHeight: 1,
  }

  return (
    <div className="props-content">
      <div className="props-type-badge" style={{ background: 'var(--accent)', color: '#fff' }}>
        <Icon.Bolt /> &nbsp;SEQUENCE
      </div>
      <div>
        <div className="props-section-title">Name</div>
        <div className="props-field">
          {editingName ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                className="props-input"
                autoFocus
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
                style={{ flex: 1 }}
              />
              <button className="lp-icon-btn primary" onClick={commitName} title="Save"><Icon.Check /></button>
              <button className="lp-icon-btn" onClick={() => setEditingName(false)} title="Cancel"><Icon.Close /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, padding: '3px 0' }}>{seq.name}</div>
              {!readOnly && (
                <button className="lp-icon-btn" title="Rename sequence"
                  onClick={() => { setNameVal(seq.name); setEditingName(true) }}><Icon.Pencil /></button>
              )}
            </div>
          )}
        </div>
      </div>
      <div>
        <div className="props-section-title" style={{ marginTop: 10 }}>
          Steps
          <span style={{ marginLeft: 6, opacity: 0.5, fontWeight: 400 }}>({seq.relationIds.length})</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.4 }}>
          Click relations on canvas to add steps
        </div>
        {seq.relationIds.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 4px', textAlign: 'center', opacity: 0.55, fontStyle: 'italic' }}>
            No steps yet
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
            {seq.relationIds.map((relId, idx) => {
              const rel = c4Relations[relId]
              const src = rel ? c4Nodes[rel.sourceId] : null
              const tgt = rel ? c4Nodes[rel.targetId] : null
              const stepDesc = seq.stepDescriptions?.[idx]
              return (
                <div key={`${relId}-${idx}`} className="seq-step" style={{ display: 'flex', alignItems: 'flex-start', gap: 5, background: 'var(--surface-2,rgba(255,255,255,0.04))', borderRadius: 5, padding: '5px 7px' }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--accent)', color: '#fff',
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1,
                  }}>{idx + 1}</span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 11, lineHeight: 1.35 }}>
                    <div style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {src?.label ?? '?'} → {tgt?.label ?? '?'}
                    </div>
                    {rel?.label && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {rel.label}
                      </div>
                    )}
                    {!readOnly && (
                      <input
                        className="props-input"
                        defaultValue={stepDesc ?? ''}
                        placeholder={rel?.label || 'Add step note…'}
                        onBlur={(e) => updateStepDescription(seq.id, idx, e.currentTarget.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                        style={{ marginTop: 4, fontSize: 11, padding: '3px 6px', width: '100%', boxSizing: 'border-box' }}
                      />
                    )}
                    {readOnly && stepDesc && (
                      <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 1, fontStyle: 'italic' }}>
                        {stepDesc}
                      </div>
                    )}
                  </div>
                  {!readOnly && (
                    <div className="seq-step-actions">
                      <button style={{ ...btnStyle, opacity: idx === 0 ? 0.3 : 1 }} disabled={idx === 0}
                        onClick={() => reorderSequence(seq.id, idx, idx - 1)} title="Move up"><Icon.ArrowUp /></button>
                      <button style={{ ...btnStyle, opacity: idx === seq.relationIds.length - 1 ? 0.3 : 1 }}
                        disabled={idx === seq.relationIds.length - 1}
                        onClick={() => reorderSequence(seq.id, idx, idx + 1)} title="Move down"><Icon.ArrowDown /></button>
                      <button
                        style={{ ...btnStyle, color: 'var(--danger, #ef4444)' }}
                        onClick={() => removeFromSequence(seq.id, idx)}
                        title="Remove step"
                      ><Icon.Close /></button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {!readOnly && seq.relationIds.length > 0 && (
          <button
            onClick={() => clearSequence(seq.id)}
            style={{
              marginTop: 8, width: '100%', fontSize: 11, padding: '4px 0',
              background: 'none', border: '1px solid var(--border)', borderRadius: 4,
              color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            Clear all steps
          </button>
        )}
      </div>
      {!readOnly && (
        <>
          {seq.relationIds.length > 0 && (() => {
            const existingView = Object.values(views).find((v) => v.sequenceId === seq.id)
            return existingView ? (
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon.Layers />
                <span>View: <strong style={{ color: 'var(--text)' }}>{existingView.name}</strong></span>
              </div>
            ) : (
              <button
                onClick={() => addViewFromSequence(seq.id)}
                style={{
                  marginTop: 12, width: '100%', fontSize: 11, padding: '6px 0',
                  background: 'rgba(var(--accent-rgb),0.10)',
                  border: '1px solid rgba(var(--accent-rgb),0.30)',
                  borderRadius: 6, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
                title="Create a Flow view showing only nodes and relations from this sequence"
              >
                <Icon.Plus /> Create Flow view from sequence
              </button>
            )
          })()}
          <button className="props-delete" onClick={() => { removeSequence(seq.id); setActiveSequence(null) }}>
            🗑 Delete sequence
          </button>
        </>
      )}
    </div>
  )
}

// EARS inline sentence editor for right panel (compact)
const EARS_SENTENCE_FIELDS = ['trigger', 'precondition', 'unwanted_condition', 'feature', 'action'] as const

function EarsSentencePreview({ node, nodeId, subject: subjectProp, readOnly, updateNode }: { node: Record<string, unknown>; nodeId: string; subject?: string; readOnly: boolean; updateNode: (id: string, patch: Record<string, unknown>) => void }) {
  const earsType = String(node.ears_type ?? 'ubiquitous')
  const subject = subjectProp || 'the system'

  const Slot = ({ fieldKey, placeholder }: { fieldKey: string; placeholder: string }) => {
    const val = String(node[fieldKey] ?? '')
    const [editing, setEditing] = React.useState(false)
    const [draft, setDraft] = React.useState(val)
    const inputRef = React.useRef<HTMLInputElement>(null)
    React.useEffect(() => { setDraft(val) }, [val])
    React.useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

    if (!editing) {
      return (
        <span
          className={`ears-slot-sm ${val ? 'ears-slot-filled' : 'ears-slot-empty'}`}
          onClick={() => !readOnly && setEditing(true)}
        >
          {val || placeholder}
        </span>
      )
    }
    return (
      <input
        ref={inputRef}
        className="ears-slot-input-sm"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft !== val) updateNode(nodeId, { [fieldKey]: draft || undefined }) }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(val); setEditing(false) } }}
      />
    )
  }

  const shall = (<><span className="ears-subject-sm">{subject}</span><span className="ears-fixed-sm"> shall </span><Slot fieldKey="action" placeholder="‹action›" /><span className="ears-fixed-sm">.</span></>)

  let content: React.ReactNode
  switch (earsType) {
    case 'event-driven':
      content = (<><span className="ears-fixed-sm">When </span><Slot fieldKey="trigger" placeholder="‹trigger›" /><span className="ears-fixed-sm">, </span>{shall}</>); break
    case 'state-driven':
      content = (<><span className="ears-fixed-sm">While </span><Slot fieldKey="precondition" placeholder="‹precondition›" /><span className="ears-fixed-sm">, </span>{shall}</>); break
    case 'unwanted-behaviour':
      content = (<><span className="ears-fixed-sm">If </span><Slot fieldKey="unwanted_condition" placeholder="‹condition›" /><span className="ears-fixed-sm">, then </span>{shall}</>); break
    case 'optional':
      content = (<><span className="ears-fixed-sm">Where </span><Slot fieldKey="feature" placeholder="‹feature›" /><span className="ears-fixed-sm">, </span>{shall}</>); break
    case 'complex':
      content = (<><span className="ears-fixed-sm">While </span><Slot fieldKey="precondition" placeholder="‹precondition›" /><span className="ears-fixed-sm">, when </span><Slot fieldKey="trigger" placeholder="‹trigger›" /><span className="ears-fixed-sm">, </span>{shall}</>); break
    default:
      content = (<><span className="ears-subject-sm">{subject.charAt(0).toUpperCase() + subject.slice(1)}</span><span className="ears-fixed-sm"> shall </span><Slot fieldKey="action" placeholder="‹action›" /><span className="ears-fixed-sm">.</span></>)
  }

  return (
    <div className="ears-sentence-sm">
      {content}
    </div>
  )
}

// ── Hub Template Reconfigure ──────────────────────────────────────────────────

function HubTemplateSection({
  record,
  importId,
  nodeId,
  readOnly,
  updateNode,
}: {
  record: HubImportRecord
  importId: string
  nodeId: string
  readOnly: boolean
  updateNode: (id: string, updates: Record<string, unknown>) => void
}) {
  const applyHubTemplate = useDiagramStore((s) => s.applyHubTemplate)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>(record.paramValues)

  // If nodeParams map exists, use only this node's params (undefined = node has none).
  // Fall back to record.templateParams only when no per-node map was built (legacy records).
  const nodeSpecificParams = record.nodeParams
    ? record.nodeParams[nodeId]
    : record.templateParams
  // If this node has no params, render nothing.
  if (!nodeSpecificParams?.length) return null

  // Sync draft when record changes externally (e.g. after save/load)
  useEffect(() => { setDraft({ ...record.paramValues }) }, [importId, JSON.stringify(record.paramValues)]) // eslint-disable-line

  if (!editing) {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span className="props-section-title" style={{ margin: 0 }}>Hub Template</span>
          {!readOnly && (
            <button
              className="props-delete"
              style={{ padding: '3px 10px', fontSize: 11, background: 'var(--accent)', color: '#fff', marginTop: 0 }}
              onClick={() => { setDraft({ ...record.paramValues }); setEditing(true) }}
            >
              ✏ Edit
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {nodeSpecificParams.map(p => (
            <div key={p.key} className="props-field" style={{ marginBottom: 0 }}>
              <label className="props-label">{p.label}</label>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '4px 0' }}>
                {record.paramValues[p.key] ?? '—'}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="props-section-title">Hub Template</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {nodeSpecificParams.map(p => (
          <div key={p.key} className="props-field">
            <label className="props-label">{p.label}</label>
            {p.hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.hint}</span>}
            <input
              className="props-input"
              type={p.type === 'number' ? 'number' : 'text'}
              value={draft[p.key] ?? ''}
              onChange={e => setDraft(d => ({ ...d, [p.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button
          className="props-delete"
          style={{ flex: 1, background: 'var(--accent)', color: '#fff', padding: '5px 0', marginTop: 0 }}
          onClick={() => {
            // One step; only the fields that hold a parameter change.
            applyHubTemplate(importId, draft)
            setEditing(false)
          }}
        >
          Apply
        </button>
        <button
          className="props-delete"
          style={{ padding: '5px 12px', marginTop: 0 }}
          onClick={() => { setDraft({ ...record.paramValues }); setEditing(false) }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Properties panel ─────────────────────────────────────────────────────────
// The attributes of what is selected (an element, a relation, a sequence) in a
// card over the right side of the canvas: it slides in on a selection and out
// when nothing is selected, and never resizes the canvas under it. Each
// attribute is a row, its name on the left and its value on the right; a
// value reads as text, outlines on hover and edits in place. A long
// (Markdown) field is shown rendered under its name, and a click edits it.

/** The value a field shows: what is set, else its default. */
function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
}

/** One attribute row. `missing` marks a required one with no value. */
function AttrRow({ label, missing = false, children }: { label: string; missing?: boolean; children: React.ReactNode }) {
  return (
    <div className="pp-row">
      <div className="pp-label" title={label}>
        <span>{label}</span>
        {missing && <span className="pp-missing" title="Required, not set" aria-label="required, not set" />}
      </div>
      <div className="pp-value">{children}</div>
    </div>
  )
}

/** A long field: rendered Markdown that a click turns into its editor; the
 *  editor goes back to the text when it loses focus or on Escape. */
function MarkdownField({ label, value, readOnly, loading = false, onChange }: {
  label: string; value: string; readOnly: boolean; loading?: boolean; onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  if (loading) return <div className="pp-md empty">Loading…</div>
  if (editing && !readOnly) {
    return (
      <AutoResizeTextarea autoFocus aria-label={label} value={value} placeholder={MARKDOWN_HINT}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => { const t = e.currentTarget; t.setSelectionRange(t.value.length, t.value.length) }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); e.currentTarget.blur() } }} />
    )
  }
  const edit = () => { if (!readOnly && !window.getSelection()?.toString()) setEditing(true) }
  return (
    <div className={`pp-md${readOnly ? '' : ' editable'}${value ? '' : ' empty'}`}
      role={readOnly ? undefined : 'button'} tabIndex={readOnly ? undefined : 0}
      aria-label={readOnly ? undefined : `Edit ${label}`}
      title={readOnly ? undefined : 'Click to edit'}
      onClick={edit}
      onKeyDown={(e) => { if (!readOnly && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setEditing(true) } }}>
      {value ? <MarkdownText text={value} /> : <span className="pp-placeholder">{readOnly ? '—' : `Add ${label.toLowerCase()}…`}</span>}
    </div>
  )
}

/** The control for one short attribute: text, number, choice, yes/no or a
 *  reference to other elements. */
function AttrValue({ def, value, readOnly, onChange }: {
  def: Pick<PropertyDef, 'key' | 'label' | 'type' | 'options' | 'default' | 'refType' | 'multiple'>
  value: unknown
  readOnly: boolean
  onChange: (v: unknown) => void
}) {
  const shown = value ?? def.default
  if (def.type === 'ref') {
    return <RefPicker def={def as PropertyDef} value={value} readOnly={readOnly} className="pp-input pp-select" onChange={(v) => !readOnly && onChange(v)} />
  }
  if (def.type === 'boolean') {
    return (
      <label className="pp-check">
        <input type="checkbox" aria-label={def.label} checked={Boolean(shown)} disabled={readOnly}
          onChange={(e) => !readOnly && onChange(e.target.checked)} />
      </label>
    )
  }
  if (def.type === 'enum' && def.options) {
    return (
      <select className="pp-input pp-select" aria-label={def.label} value={String(shown ?? '')} disabled={readOnly}
        onChange={(e) => !readOnly && onChange(e.target.value || undefined)}>
        {/* Without a value the select showed its first option as if
            set: picking that one changed nothing, so it could not be
            chosen and a required property stayed "missing". */}
        {isEmptyValue(shown) && <option value="">—</option>}
        {def.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    )
  }
  return (
    <input className="pp-input" aria-label={def.label} placeholder="—"
      type={def.type === 'number' ? 'number' : undefined}
      value={String(shown ?? '')} readOnly={readOnly}
      onChange={(e) => {
        if (readOnly) return
        // An emptied number clears the value (Number('') saved 0).
        onChange(def.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)
      }} />
  )
}

type PanelMenuItem = { label: string; danger?: boolean; onClick: () => void }

/** The card's head: the type, the name (edited in place), where it sits,
 *  the wizard when its type has one, a ⋯ menu with what is done to it
 *  rather than written in it, and ✕. */
function PanelHeader({ typeLabel, color, iconPath, title, titlePlaceholder, readOnly, onTitle, context, onWizard, menu, onClose }: {
  typeLabel: string
  color: string
  iconPath?: string
  title: string
  titlePlaceholder: string
  readOnly: boolean
  onTitle?: (v: string) => void
  context?: React.ReactNode
  /** Opens the type's wizard, when it has one. */
  onWizard?: () => void
  menu: PanelMenuItem[]
  onClose: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useOutsideClick([menuRef], menuOpen, useCallback(() => setMenuOpen(false), []))
  return (
    <div className="pp-head">
      <div className="pp-head-bar">
        <span className="pp-type" style={{ ['--type-color' as string]: color }}>
          {iconPath
            ? <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden><path d={iconPath} /></svg>
            : <span className="pp-type-dot" aria-hidden />}
          {typeLabel}
        </span>
        <span className="pp-head-actions">
          {onWizard && (
            <button type="button" className="pp-wizard-btn" title="Fill in with the wizard" onClick={onWizard}>
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2.5 13.5 L10 6" /><path d="M9 4.5 L11.5 7" /><path d="M12 1.5v2M11 2.5h2M14 5.5v1.6M13.2 6.3h1.6M6 1.8v1.4M5.3 2.5h1.4" />
              </svg>
              Wizard
            </button>
          )}
          {menu.length > 0 && (
            <div className="pp-menu-wrap" ref={menuRef}>
              <button type="button" className="pp-icon-btn" aria-label="More actions" aria-expanded={menuOpen}
                title="More actions" onClick={() => setMenuOpen((o) => !o)}>⋯</button>
              {menuOpen && (
                <div className="pp-menu" role="menu">
                  {menu.map((m) => (
                    <button type="button" role="menuitem" key={m.label} className={`pp-menu-item${m.danger ? ' danger' : ''}`}
                      onClick={() => { setMenuOpen(false); m.onClick() }}>{m.label}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button type="button" className="pp-icon-btn" aria-label="Close properties" title="Close" onClick={onClose}>✕</button>
        </span>
      </div>
      {(title || titlePlaceholder) && (onTitle && !readOnly
        ? <input className="pp-title" aria-label="Name" value={title} placeholder={titlePlaceholder}
            onChange={(e) => onTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }} />
        : <div className={`pp-title${title ? '' : ' empty'}`}>{title || titlePlaceholder}</div>)}
      {context && <div className="pp-context">{context}</div>}
    </div>
  )
}

/** A link to another element in the head (a parent, a relation's end). */
function NodeLink({ id, label }: { id: string; label: string }) {
  const selectNode = useDiagramStore((s) => s.selectNode)
  return <button type="button" className="pp-link" onClick={() => selectNode(id)}>{label}</button>
}

function PropertiesContent({ readOnly = false, onClose }: { readOnly?: boolean; onClose: () => void }) {
  const selectedNodeId = useDiagramStore((s) => s.selectedNodeId)
  const selectedEdgeId = useDiagramStore((s) => s.selectedEdgeId)
  const c4Nodes = useDiagramStore((s) => s.c4Nodes)
  const c4Relations = useDiagramStore((s) => s.c4Relations)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const updateNode = useDiagramStore((s) => s.updateNode)
  const reparentNodes = useDiagramStore((s) => s.reparentNodes)
  const removeNode = useDiagramStore((s) => s.removeNode)
  const updateRelation = useDiagramStore((s) => s.updateRelation)
  const removeRelation = useDiagramStore((s) => s.removeRelation)
  const selectNode = useDiagramStore((s) => s.selectNode)
  const selectEdge = useDiagramStore((s) => s.selectEdge)
  const hubTemplates = useDiagramStore((s) => s.hubTemplates)
  const pendingBodyNodeIds = useDiagramStore((s) => s.pendingBodyNodeIds)
  const hydrateNode = useDiagramStore((s) => s.hydrateNode)
  const openNodeWizard = useDiagramStore((s) => s.openNodeWizard)

  // Lazily-loaded md-folder docs don't have the description in memory until
  // the node is opened — fetch it now.
  useEffect(() => {
    if (selectedNodeId) hydrateNode(selectedNodeId)
  }, [selectedNodeId, hydrateNode])

  // ── Node ──────────────────────────────────────────────────────────────────
  if (selectedNodeId && c4Nodes[selectedNodeId]) {
    const node = c4Nodes[selectedNodeId]
    const record = node as unknown as Record<string, unknown>
    const descriptionPending = !!pendingBodyNodeIds[node.id]
    const set = (key: string, v: unknown) => {
      if (!readOnly) updateNode(node.id, { [key]: v } as Parameters<typeof updateNode>[1])
    }

    const nodeTypeDef = metamodel?.nodeTypes[node.type]
    // For requirements, EARS content fields are edited via the inline sentence editor
    const earsSentenceFields = new Set(['trigger', 'precondition', 'unwanted_condition', 'feature', 'action'])
    const isCodeType = node.type === 'container' || node.type === 'component' || node.type === 'database' || node.type === 'webapp' || node.type === 'queue'
    // The type's attributes; built-in ones when there is no metamodel.
    const defs: PropertyDef[] = nodeTypeDef
      ? (nodeTypeDef.properties ?? []).filter((p) => {
          if (p.key === 'label') return false
          // A property is a plain field of the element: one keyed `type` or
          // `parentId` would edit the element itself.
          if (isReservedPropertyKey(p.key, 'node')) return false
          if (node.type === 'requirement' && earsSentenceFields.has(p.key)) return false
          if (p.visibleWhen) return p.visibleWhen.values.includes(String(record[p.visibleWhen.key] ?? ''))
          return true
        })
      : [
          { key: 'description', label: 'Description', type: 'textarea' },
          ...(isCodeType ? [{ key: 'technology', label: 'Technology', type: 'text' } as PropertyDef] : []),
          { key: 'external', label: 'External', type: 'boolean' },
        ]
    const short = defs.filter((p) => !isMarkdownField(p.key, p))
    const long = defs.filter((p) => isMarkdownField(p.key, p))
    const missing = (p: PropertyDef) => !!p.required && isEmptyValue(record[p.key] ?? p.default)

    // Parent selector — driven by metamodel allowedParents when available.
    const allowedParentTypes = nodeTypeDef?.allowedParents ?? (
      isCodeType
        ? ({ container: ['system'], component: ['container'], database: ['system'], webapp: ['system'], queue: ['system'] } as Record<string, string[]>)[node.type]
        : undefined
    )
    const parents: { id: string; label: string }[] = []
    for (let p = node.parentId ? c4Nodes[node.parentId] : undefined; p && parents.length < 8; p = p.parentId ? c4Nodes[p.parentId] : undefined) {
      parents.unshift({ id: p.id, label: p.label })
    }

    const typeLabel = nodeTypeDef?.label ?? TYPE_LABELS[node.type] ?? node.type
    const menu: PanelMenuItem[] = readOnly ? [] : [
      { label: 'Delete element (and what it contains)', danger: true, onClick: () => { removeNode(node.id); selectNode(null) } },
    ]
    const hubEntry = Object.entries(hubTemplates as Record<string, HubImportRecord>).find(([, rec]) => rec.nodeIds.includes(node.id))

    return (
      <div className="props-content" key={node.id}>
        <PanelHeader
          typeLabel={typeLabel}
          color={nodeTypeDef?.color ?? NODE_COLORS[node.type] ?? '#64748b'}
          iconPath={nodeTypeDef?.iconPath ?? TYPE_ICON_PATHS[node.type]}
          title={node.label}
          titlePlaceholder="Unnamed"
          readOnly={readOnly}
          onTitle={(v) => set('label', v)}
          context={parents.length > 0 && (
            <>in {parents.map((p, i) => (
              <React.Fragment key={p.id}>{i > 0 && <span className="pp-sep"> › </span>}<NodeLink id={p.id} label={p.label} /></React.Fragment>
            ))}</>
          )}
          onWizard={!readOnly && nodeTypeDef?.wizard ? () => openNodeWizard(node.id) : undefined}
          menu={menu}
          onClose={onClose}
        />
        {node.type === 'requirement' && (
          <section className="pp-section">
            <div className="pp-section-title">Sentence</div>
            <div className="props-ears-sentence">
              <EarsSentencePreview node={record} nodeId={node.id} subject={resolveEarsSubject(node.id, c4Relations, c4Nodes)} readOnly={readOnly} updateNode={(id, patch) => updateNode(id, patch as Parameters<typeof updateNode>[1])} />
              <EarsQuickEntry nodeId={node.id} readOnly={readOnly} updateNode={(id, patch) => updateNode(id, patch as Parameters<typeof updateNode>[1])} compact />
            </div>
          </section>
        )}
        {(short.length > 0 || (allowedParentTypes && allowedParentTypes.length > 0)) && (
          <section className="pp-section pp-grid" aria-label="Attributes">
            {short.map((p) => (
              <AttrRow key={p.key} label={p.label} missing={missing(p)}>
                <AttrValue def={p} value={record[p.key]} readOnly={readOnly} onChange={(v) => set(p.key, v)} />
              </AttrRow>
            ))}
            {allowedParentTypes && allowedParentTypes.length > 0 && (
              <AttrRow label="Parent">
                <select className="pp-input pp-select" aria-label="Parent" value={node.parentId ?? ''} disabled={readOnly}
                  onChange={(e) => !readOnly && reparentNodes([node.id], e.target.value || null)}>
                  <option value="">—</option>
                  {Object.values(c4Nodes)
                    .filter((n) => n.id !== node.id && allowedParentTypes.includes(n.type))
                    .map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                </select>
              </AttrRow>
            )}
          </section>
        )}
        {long.map((p) => (
          <section className="pp-section" key={p.key}>
            <div className="pp-section-title">
              {p.label}
              {missing(p) && <span className="pp-missing" title="Required, not set" aria-label="required, not set" />}
            </div>
            <MarkdownField label={p.label} value={String(record[p.key] ?? p.default ?? '')} readOnly={readOnly}
              loading={p.key === 'description' && descriptionPending} onChange={(v) => set(p.key, v)} />
          </section>
        ))}
        {node.type === 'mockup' && (
          <section className="pp-section">
            <div className="pp-section-title">Wireframe</div>
            <MockupWireframe nodeId={node.id} readOnly={readOnly} />
          </section>
        )}
        {hubEntry && (
          <section className="pp-section">
            <HubTemplateSection
              record={hubEntry[1]}
              importId={hubEntry[0]}
              nodeId={node.id}
              readOnly={readOnly}
              updateNode={(id, patch) => updateNode(id, patch as Parameters<typeof updateNode>[1])}
            />
          </section>
        )}
      </div>
    )
  }

  // ── Edge ──────────────────────────────────────────────────────────────────
  if (selectedEdgeId) {
    const relId = selectedEdgeId.startsWith('virtual-') ? null : selectedEdgeId
    const rel = relId ? c4Relations[relId] : null

    if (rel) {
      const record = rel as unknown as Record<string, unknown>
      const relTypeDef = metamodel?.relationTypes[rel.relationType ?? '']
      const set = (key: string, v: unknown) => {
        if (!readOnly) updateRelation(rel.id, { [key]: v } as Parameters<typeof updateRelation>[1])
      }
      // Metamodel-driven properties; Technology only for relations with no type def.
      const defs: PropertyDef[] = relTypeDef
        ? (relTypeDef.properties ?? []).filter((p) => !isReservedPropertyKey(p.key, 'relation') && p.key !== 'label')
        : [{ key: 'technology', label: 'Technology', type: 'text' }]
      const short = defs.filter((p) => !isMarkdownField(p.key, p))
      const long = defs.filter((p) => isMarkdownField(p.key, p))

      // Selectable relation types for this source→target pair.
      const srcNode = c4Nodes[rel.sourceId]
      const dstNode = c4Nodes[rel.targetId]
      const compatibleTypes = metamodel
        ? Object.values(metamodel.relationTypes).filter(rt =>
            rt.allowedPairs.length === 0 ||
            rt.allowedPairs.some(p => p.from === srcNode?.type && p.to === dstNode?.type)
          )
        : []

      return (
        <div className="props-content" key={rel.id}>
          <PanelHeader
            typeLabel={relTypeDef?.label ?? 'Relation'}
            color={relTypeDef?.color ?? '#64748b'}
            title={String(rel.label ?? '')}
            titlePlaceholder="No label"
            readOnly={readOnly}
            onTitle={(v) => set('label', v)}
            context={(
              <>
                {srcNode ? <NodeLink id={srcNode.id} label={srcNode.label} /> : '?'}
                <span className="pp-sep"> → </span>
                {dstNode ? <NodeLink id={dstNode.id} label={dstNode.label} /> : '?'}
              </>
            )}
            menu={readOnly ? [] : [{ label: 'Delete relation', danger: true, onClick: () => { removeRelation(rel.id); selectEdge(null) } }]}
            onClose={onClose}
          />
          {(short.length > 0 || compatibleTypes.length > 1) && (
            <section className="pp-section pp-grid" aria-label="Attributes">
              {compatibleTypes.length > 1 && (
                <AttrRow label="Type">
                  <select className="pp-input pp-select" aria-label="Type" value={rel.relationType ?? ''} disabled={readOnly}
                    onChange={(e) => set('relationType', e.target.value || undefined)}>
                    <option value="">(generic)</option>
                    {compatibleTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.label}</option>)}
                  </select>
                </AttrRow>
              )}
              {short.map((p) => (
                <AttrRow key={p.key} label={p.label} missing={!!p.required && isEmptyValue(record[p.key] ?? p.default)}>
                  <AttrValue def={p} value={record[p.key]} readOnly={readOnly} onChange={(v) => set(p.key, v)} />
                </AttrRow>
              ))}
            </section>
          )}
          {long.map((p) => (
            <section className="pp-section" key={p.key}>
              <div className="pp-section-title">{p.label}</div>
              <MarkdownField label={p.label} value={String(record[p.key] ?? p.default ?? '')} readOnly={readOnly}
                onChange={(v) => set(p.key, v)} />
            </section>
          ))}
        </div>
      )
    }

    return (
      <div className="props-content">
        <PanelHeader typeLabel="Relation" color="#64748b" title="" titlePlaceholder="Virtual relation"
          readOnly menu={[]} onClose={onClose} />
        <div className="props-empty">
          It stands for relations between elements inside collapsed ones.<br />
          Expand them to edit each relation.
        </div>
      </div>
    )
  }

  return null
}

const PANEL_W_KEY = 'radical-props-width'
const PANEL_W_DEFAULT = 340
const PANEL_W_MIN = 280
const PANEL_W_MAX = 640

function clampPanelWidth(w: number): number {
  return Math.round(Math.max(PANEL_W_MIN, Math.min(PANEL_W_MAX, w)))
}

export function RightPanel({ readOnly = false }: { readOnly?: boolean }) {
  const selectedNodeId = useDiagramStore((s) => s.selectedNodeId)
  const selectedEdgeId = useDiagramStore((s) => s.selectedEdgeId)
  const activeSequenceId = useDiagramStore((s) => s.activeSequenceId)
  const setActiveSequence = useDiagramStore((s) => s.setActiveSequence)
  // Several elements selected: the selection bar acts on them, and the card,
  // which would show one of them, stays out of the way of the next pick.
  const several = useDiagramStore((s) => s.selectedNodeIds.length > 1)

  // What the card is about; ✕ hides it until something else is selected.
  const subject = several ? null
    : selectedNodeId ? `node:${selectedNodeId}`
    : selectedEdgeId ? `edge:${selectedEdgeId}`
    : activeSequenceId ? `sequence:${activeSequenceId}`
    : null
  const [dismissed, setDismissed] = useState<string | null>(null)
  const open = !!subject && dismissed !== subject
  const close = useCallback(() => setDismissed(subject), [subject])

  // An explicit "show its properties" (Quick Search, a table row's button)
  // brings back a card that ✕ hid.
  useEffect(() => {
    const w = window as unknown as { __radicalExpandRightPanel?: () => void }
    const reopen = () => setDismissed(null)
    w.__radicalExpandRightPanel = reopen
    return () => { if (w.__radicalExpandRightPanel === reopen) delete w.__radicalExpandRightPanel }
  }, [])

  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(PANEL_W_KEY))
      return saved ? clampPanelWidth(saved) : PANEL_W_DEFAULT
    } catch { return PANEL_W_DEFAULT }
  })
  const saveWidth = (w: number) => {
    setWidth(w)
    try { localStorage.setItem(PANEL_W_KEY, String(w)) } catch { /* private window */ }
  }
  const [resizing, setResizing] = useState(false)
  const onResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    setResizing(true)
    let last = startW
    const move = (ev: PointerEvent) => { last = clampPanelWidth(startW + (startX - ev.clientX)); setWidth(last) }
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      setResizing(false)
      saveWidth(last)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }

  const content = selectedNodeId || selectedEdgeId
    ? <PropertiesContent readOnly={readOnly} onClose={close} />
    : activeSequenceId
      ? (
        <div className="props-content">
          <PanelHeader typeLabel="Sequence" color="var(--accent)" title="" titlePlaceholder="" readOnly
            menu={[]} onClose={() => { close(); setActiveSequence(null) }} />
          <SequencePropertiesContent sequenceId={activeSequenceId} readOnly={readOnly} />
        </div>
      )
      : null

  return (
    <aside className={`right-panel${open ? ' open' : ''}${resizing ? ' resizing' : ''}`}
      aria-label="Properties" aria-hidden={!open} style={{ width }}>
      <div className="pp-resize" title="Drag to resize · double-click for the default width"
        onPointerDown={onResizeStart} onDoubleClick={() => saveWidth(PANEL_W_DEFAULT)} />
      <div className="pp-scroll">{content}</div>
    </aside>
  )
}
