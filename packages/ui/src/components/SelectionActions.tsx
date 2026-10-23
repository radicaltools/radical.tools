import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { activeLayoutConstraints, childrenInView, hideRefusal, shownExploration, useDiagramStore } from '../store/diagramStore'
import { standingOrder } from '@radical/layout/constraints'
import { loadStudioSettings, saveStudioSettings } from '../studioSettings'
import { isParentAllowed, isPlacementAllowed, isRelationAllowed, relationTypeName } from '@radical/common/metamodel'
import { defaultGridColumns, type C4Node } from '@radical/common/c4'
import { checkPatchRelation, nestRefusal, relationTypeOnMove } from '@radical/common/model'
import { useMenuKeys } from '../hooks/menuKeys'
import { useOutsideClick } from '../hooks/useOutsideClick'

// ─── What is done to selected elements and relations ────────────────────────
//
// Wrap into…, Move to…, Unwrap, Align…, Hide from view and Delete, and a
// relation's Change source…, Change destination… and Hide from view. One
// element's or one relation's are a section of its properties card (rows,
// their menus opening in the card); several elements' are a bar over the top
// of the canvas, as flat as the canvas controls. Explore from here is on the
// card's head, and Delete of one element or relation its last section.

type Variant = 'bar' | 'card'

/** Whether the shown view is a canvas: alignments and Hide from view are its. */
function onCanvas(s: { activeViewId: string | null; views: Record<string, { kind?: string }> }): boolean {
  if (!s.activeViewId) return false
  const kind = s.views[s.activeViewId]?.kind
  return !kind || kind === 'static' || kind === 'explore'
}

const Chevron = () => (
  <svg className="sel-chevron" viewBox="0 0 10 10" width="9" height="9" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 4l3 3 3-3" />
  </svg>
)

const Icons = {
  Wrap: () => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M5 7h6M5 10h4" />
    </svg>
  ),
  Move: () => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  ),
  Unwrap: () => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 4h12M2 8h12M2 12h12" strokeDasharray="2 2" />
      <path d="M5 2l-3 2 3 2M11 10l3 2-3 2" />
    </svg>
  ),
  Align: () => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="1.5" y="5" width="3.5" height="6" rx="0.8" />
      <rect x="10.5" y="4" width="4" height="8" rx="0.8" />
      <path d="M5 8h5.5" strokeDasharray="1.5 1.5" />
    </svg>
  ),
  Hide: () => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" />
      <path d="M2 2l12 12" />
    </svg>
  ),
  Delete: () => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 4h10M6 4V2.5h4V4M5 4l1 9h4l1-9" />
    </svg>
  ),
  Source: () => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="4" cy="8" r="2" />
      <path d="M6 8h7M10 5l3 3-3 3" />
    </svg>
  ),
  Destination: () => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8h7M7 5l3 3-3 3" />
      <circle cx="13" cy="8" r="2" />
    </svg>
  ),
}

/** One action: a button on the bar, a row in the card. */
function ActionButton({ variant, icon, label, title, danger = false, onClick }: {
  variant: Variant; icon: React.ReactNode; label: string; title: string; danger?: boolean; onClick: () => void
}) {
  const className = variant === 'bar' ? `sel-bar-btn${danger ? ' sel-bar-btn-danger' : ''}` : 'pp-action'
  return <button type="button" className={className} title={title} onClick={onClick}>{icon}<span>{label}</span></button>
}

/** An action with a menu: it drops from the bar's button, or opens in the
 *  card under its row, where the card scrolls rather than covers it. */
function ActionMenu({ variant, icon, label, title, wide = false, disabled = false, children }: {
  variant: Variant; icon: React.ReactNode; label: string; title: string; wide?: boolean; disabled?: boolean
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const close = useCallback(() => setOpen(false), [])
  useMenuKeys(ref, open, close)
  useOutsideClick([ref], open, close)
  const bar = variant === 'bar'
  return (
    <div className={bar ? 'sel-bar-wrap' : 'pp-action-wrap'} ref={ref}>
      <button type="button" className={bar ? 'sel-bar-btn' : 'pp-action'} aria-haspopup="menu" aria-expanded={open}
        title={title} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        {icon}<span>{label}</span><Chevron />
      </button>
      {open && (
        <div className={bar ? `sel-bar-menu${wide ? ' sel-bar-menu-wide' : ''}` : 'pp-action-menu'} role="menu">
          {children(close)}
        </div>
      )}
    </div>
  )
}

function MenuItem({ label, reason, onClick }: { label: string; reason?: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="sel-bar-menu-item" onClick={onClick}>
      <span>{label}</span>
      {reason && <span className="sel-bar-menu-reason">{reason}</span>}
    </button>
  )
}

/** Where `id` sits: its containers' names and its own, "Bookstore / API". */
function pathOf(c4Nodes: Record<string, C4Node>, id: string | null): string {
  if (!id) return 'Canvas root'
  const segs: string[] = []
  const seen = new Set<string>()
  for (let cur: C4Node | undefined = c4Nodes[id]; cur && !seen.has(cur.id); cur = cur.parentId ? c4Nodes[cur.parentId] : undefined) {
    seen.add(cur.id)
    segs.unshift(cur.label || cur.type)
  }
  return segs.join(' / ')
}

/** The actions of the elements `ids`: the bar's (several) or the card's (one). */
function NodeActionItems({ ids, variant }: { ids: string[]; variant: Variant }): React.ReactElement | null {
  const c4Nodes = useDiagramStore((s) => s.c4Nodes)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const wrap = useDiagramStore((s) => s.wrapSelectionInNewParent)
  const unwrapNode = useDiagramStore((s) => s.unwrapNode)
  const reparentNodes = useDiagramStore((s) => s.reparentNodes)
  const setSelectedNodeIds = useDiagramStore((s) => s.setSelectedNodeIds)
  const activeViewId = useDiagramStore((s) => s.activeViewId)
  const removeNodeFromView = useDiagramStore((s) => s.removeNodeFromView)
  const canvas = useDiagramStore(onCanvas)
  // A view per element shows what its element holds, a view that lists
  // nothing what its filter gives: nothing is hidden from them.
  const canHide = useDiagramStore((s) => !!s.activeViewId && !hideRefusal(s, s.activeViewId))
  const constraints = useDiagramStore(activeLayoutConstraints)
  const addAlignment = useDiagramStore((s) => s.addAlignment)
  const addGrid = useDiagramStore((s) => s.addGrid)
  const removeLayoutConstraint = useDiagramStore((s) => s.removeLayoutConstraint)
  // An exploration (the temporary one, or a view of type Explore) draws
  // what it lists, level by level: no alignments, no Hide (its − does that).
  const exploring = useDiagramStore((s) => !!shownExploration(s))

  const [keepOrder, setKeepOrder] = useState(() => loadStudioSettings().alignKeepsOrder)
  // Grid columns offered for the current selection: about square until changed.
  const [gridColumns, setGridColumns] = useState<{ count: number; columns: number } | null>(null)
  // What Align… works on: the elements, or one container's children in this
  // view (ordered as they stand, or last stood while it is collapsed).
  const childCount = useDiagramStore((s) => (ids.length === 1 ? childrenInView(s, ids[0]).boxes.length : 0))
  const childrenDrawn = useDiagramStore((s) => (ids.length === 1 ? childrenInView(s, ids[0]).drawn : false))
  const ofChildren = ids.length === 1 && childCount >= 2
  const alignCount = ofChildren ? childCount : ids.length
  const alignIds = (layout: 'horizontal' | 'vertical' | 'grid'): string[] => (ofChildren
    ? standingOrder(childrenInView(useDiagramStore.getState(), ids[0]).boxes, layout)
    : [...ids])
  const orderHint = ofChildren ? (childrenDrawn ? 'as they stand now' : 'as they last stood') : 'in selection order'
  const columns = gridColumns?.count === alignCount ? gridColumns.columns : defaultGridColumns(alignCount)

  // The types the elements can be wrapped into: siblings only, into a type
  // that may stand where they are and hold each of them.
  const wrappers = useMemo(() => {
    const nodes = ids.map((id) => c4Nodes[id]).filter(Boolean)
    if (nodes.length === 0 || !metamodel) return [] as { id: string; label: string }[]
    const parentId = nodes[0].parentId ?? null
    if (!nodes.every((n) => (n.parentId ?? null) === parentId)) return []
    const parent = parentId ? c4Nodes[parentId] : undefined
    return Object.values(metamodel.nodeTypes)
      .filter((def) => !(nodes.length === 1 && nodes[0].type === def.id)
        && isPlacementAllowed(metamodel, def.id, parent, c4Nodes)
        && nodes.every((n) => isParentAllowed(metamodel, n.type, def.id)))
      .map((def) => ({ id: def.id, label: def.label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [ids, c4Nodes, metamodel])

  // Where the elements can move: siblings only, not into themselves or what
  // they hold, nor where they are, and only where the metamodel lets each.
  const moveTargets = useMemo(() => {
    const nodes = ids.map((id) => c4Nodes[id]).filter(Boolean)
    if (nodes.length === 0 || !metamodel) return [] as { id: string | null; label: string; path: string }[]
    const parentId = nodes[0].parentId ?? null
    if (!nodes.every((n) => (n.parentId ?? null) === parentId)) return []
    const forbidden = new Set<string>(ids)
    const collect = (id: string): void => {
      for (const n of Object.values(c4Nodes)) {
        if (n.parentId === id && !forbidden.has(n.id)) { forbidden.add(n.id); collect(n.id) }
      }
    }
    for (const id of ids) collect(id)
    // The card's Parent rule (nestRefusal): not into an external element,
    // nor where the move would then be refused (it listed both).
    const modelState = { c4Nodes, c4Relations: {}, views: {}, activeViewId: null, metamodel }
    const allowedIn = (target: C4Node | undefined): boolean => nodes.every((n) => isPlacementAllowed(metamodel, n.type, target, c4Nodes))
      && nestRefusal(modelState, ids, target?.id ?? null) === null
    const out: { id: string | null; label: string; path: string }[] = []
    if (parentId !== null && allowedIn(undefined)) out.push({ id: null, label: 'Canvas root', path: 'Canvas root' })
    for (const cand of Object.values(c4Nodes)) {
      if (forbidden.has(cand.id) || cand.id === parentId || !allowedIn(cand)) continue
      out.push({ id: cand.id, label: `${cand.label || cand.type} (${metamodel.nodeTypes[cand.type]?.label ?? cand.type})`, path: pathOf(c4Nodes, cand.id) })
    }
    return out.sort((a, b) => a.path.localeCompare(b.path))
  }, [ids, c4Nodes, metamodel])

  // Unwrap: one element that holds others (else it is Delete, or nothing).
  const only = ids.length === 1 ? c4Nodes[ids[0]] : undefined
  const canUnwrap = !!only && Object.values(c4Nodes).some((n) => n.parentId === only.id)
  const canAlign = canvas && alignCount >= 2 && !exploring
  const hides = canvas && !!activeViewId && canHide && !exploring
  if (!wrappers.length && !moveTargets.length && !canUnwrap && !canAlign && !hides && variant === 'card') return null

  const aligning = new Set(ofChildren ? childrenInView(useDiagramStore.getState(), ids[0]).boxes.map((c) => c.id) : ids)
  const alignedHere = constraints.filter((c) => c.nodeIds.every((id) => aligning.has(id)))
  const several = ids.length > 1
  const divider = variant === 'bar' ? <div className="sel-bar-divider" /> : null

  const items = (
    <>
      {wrappers.length > 0 && (<>
        <ActionMenu variant={variant} icon={<Icons.Wrap />} label="Wrap into…" title="Wrap into a new container">
          {(close) => wrappers.map((w) => <MenuItem key={w.id} label={w.label} onClick={() => { close(); wrap(w.id) }} />)}
        </ActionMenu>
        {divider}
      </>)}
      {moveTargets.length > 0 && (<>
        <ActionMenu variant={variant} icon={<Icons.Move />} label="Move to…"
          title={several ? 'Move the selected elements into another parent' : 'Move the element into another parent'}>
          {(close) => moveTargets.map((t) => (
            <MenuItem key={t.id ?? '__root__'} label={t.label} reason={t.id !== null ? t.path : undefined}
              onClick={() => { close(); reparentNodes([...ids], t.id) }} />
          ))}
        </ActionMenu>
        {divider}
      </>)}
      {canUnwrap && (<>
        <ActionButton variant={variant} icon={<Icons.Unwrap />} label="Unwrap"
          title="Remove this container but keep its direct children and their relations" onClick={() => unwrapNode(only!.id)} />
        {divider}
      </>)}
      {canAlign && (<>
        <ActionMenu variant={variant} icon={<Icons.Align />} label={ofChildren ? 'Align children…' : 'Align…'} wide
          title={ofChildren ? 'Keep the children of this element in a row, a column or a grid on this canvas' : 'Keep the selected elements in a row, a column or a grid on this canvas'}>
          {(close) => (<>
            {ofChildren && !childrenDrawn && <div className="sel-bar-menu-note">Collapsed: its children line up when you expand it.</div>}
            <MenuItem label="Keep in a row" reason={`Centres on one horizontal line${keepOrder ? `, left to right ${orderHint}` : ''}`}
              onClick={() => { close(); addAlignment('horizontal', alignIds('horizontal'), { ordered: keepOrder }) }} />
            <MenuItem label="Keep in a column" reason={`Centres on one vertical line${keepOrder ? `, top to bottom ${orderHint}` : ''}`}
              onClick={() => { close(); addAlignment('vertical', alignIds('vertical'), { ordered: keepOrder }) }} />
            {alignCount >= 3 && (
              <div className="sel-bar-menu-grid">
                <MenuItem label="Keep in a grid" reason={`${columns} ${columns === 1 ? 'column' : 'columns'}, row by row ${orderHint}`}
                  onClick={() => { close(); addGrid(alignIds('grid'), columns) }} />
                <div className="sel-bar-stepper" role="group" aria-label="Grid columns">
                  <button type="button" aria-label="Fewer columns" disabled={columns <= 1}
                    onClick={() => setGridColumns({ count: alignCount, columns: columns - 1 })}>−</button>
                  <span>{columns}</span>
                  <button type="button" aria-label="More columns" disabled={columns >= alignCount}
                    onClick={() => setGridColumns({ count: alignCount, columns: columns + 1 })}>+</button>
                </div>
              </div>
            )}
            <button type="button" role="menuitemcheckbox" aria-checked={keepOrder} className="sel-bar-menu-item sel-bar-menu-check"
              onClick={() => {
                const next = !keepOrder
                setKeepOrder(next)
                saveStudioSettings({ ...loadStudioSettings(), alignKeepsOrder: next })
              }}>
              <span>
                <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="0.7" y="0.7" width="10.6" height="10.6" rx="2" />
                  {keepOrder && <path d="M3 6.2l2 2 4-4.4" />}
                </svg>
                Keep their order
              </span>
              <span className="sel-bar-menu-reason">{ofChildren ? 'The order they stand in now' : 'The order you selected them in'}; no layout may swap them</span>
            </button>
            {alignedHere.length > 0 && (
              <MenuItem label="Stop keeping aligned"
                reason={`${alignedHere.length === 1 ? '1 alignment' : `${alignedHere.length} alignments`} ${ofChildren ? 'of these children' : 'in this selection'}`}
                onClick={() => { close(); removeLayoutConstraint(alignedHere.map((c) => c.id)) }} />
            )}
          </>)}
        </ActionMenu>
        {divider}
      </>)}
      {hides && (<>
        <ActionButton variant={variant} icon={<Icons.Hide />} label="Hide from view"
          title={several ? 'Hide the selected elements from this view (the model is not changed)' : 'Hide the element from this view (the model is not changed)'}
          onClick={() => { const hidden = [...ids]; setSelectedNodeIds([]); removeNodeFromView(activeViewId!, hidden) }} />
        {divider}
      </>)}
    </>
  )
  return variant === 'card' ? <CardActions>{items}</CardActions> : items
}

/**
 * The bar over the top of the canvas while several elements are selected in
 * Designer: how many, then what is done to them all. One element's actions
 * are in its properties card.
 */
export function SelectionActionBar(): React.ReactElement | null {
  const selectedNodeIds = useDiagramStore((s) => s.selectedNodeIds)
  const appMode = useDiagramStore((s) => s.appMode)
  const removeNodes = useDiagramStore((s) => s.removeNodes)
  const setSelectedNodeIds = useDiagramStore((s) => s.setSelectedNodeIds)
  if (appMode !== 'designer' || selectedNodeIds.length < 2) return null
  return (
    <div className="sel-bar" role="toolbar" aria-label="Selection actions">
      <div className="sel-bar-count">
        <span className="sel-bar-badge">{selectedNodeIds.length}</span>
        <span className="sel-bar-label">selected</span>
      </div>
      <div className="sel-bar-divider" />
      <NodeActionItems ids={selectedNodeIds} variant="bar" />
      <ActionButton variant="bar" icon={<Icons.Delete />} label="Delete" danger title="Delete the selected elements from the model"
        onClick={() => {
          // One undo step for all of them (one per element took several Undos).
          const ids = [...selectedNodeIds]
          setSelectedNodeIds([])
          removeNodes(ids)
        }} />
    </div>
  )
}

/** The Actions section of one element's properties card, when it has any. */
export function NodeActions({ nodeId }: { nodeId: string }): React.ReactElement | null {
  const ids = useMemo(() => [nodeId], [nodeId])
  return <NodeActionItems ids={ids} variant="card" />
}

/** A card's Actions section: one row per action. */
function CardActions({ children }: { children: React.ReactNode }) {
  return (
    <section className="pp-section" aria-label="Actions">
      <div className="pp-section-title">Actions</div>
      <div className="pp-actions">{children}</div>
    </section>
  )
}

/** The elements an end of a relation may move to; picked one where the
 *  type the relation has does not fit and several do, the types to choose
 *  from, as on a relation drawn (it was left with none, unasked). */
function RelationEndItems({ relationId, end, candidates, close }: {
  relationId: string
  end: 'sourceId' | 'targetId'
  candidates: { id: string; label: string; path: string }[]
  close: () => void
}): React.ReactElement {
  const updateRelation = useDiagramStore((s) => s.updateRelation)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const [asking, setAsking] = useState<{ nodeId: string; title: string; types: string[]; ends?: { from: string; to: string } } | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => { if (asking) listRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus() }, [asking])
  const pick = (nodeId: string): void => {
    const s = useDiagramStore.getState()
    const rel = s.c4Relations[relationId]
    const fit = relationTypeOnMove(s, relationId, { [end]: nodeId })
    // A refused move is said so by updateRelation, not asked about.
    if (rel && fit.ask && !checkPatchRelation(s, relationId, { [end]: nodeId })) {
      const ends = { sourceId: rel.sourceId, targetId: rel.targetId, [end]: nodeId }
      const name = (id: string) => s.c4Nodes[id]?.label || id
      setAsking({ nodeId, title: `${name(ends.sourceId)} → ${name(ends.targetId)}: which relation?`, types: fit.ask, ends: s.c4Nodes[ends.sourceId] && s.c4Nodes[ends.targetId] ? { from: s.c4Nodes[ends.sourceId].type, to: s.c4Nodes[ends.targetId].type } : undefined })
      return
    }
    close()
    updateRelation(relationId, { [end]: nodeId, ...(fit.type ? { relationType: fit.type } : {}) })
  }
  if (asking) {
    return (
      <div ref={listRef}>
        <div className="relation-type-menu-title">{asking.title}</div>
        {asking.types.map((t) => (
          <MenuItem key={t} label={relationTypeName(metamodel, t, false, asking.ends)}
            onClick={() => { close(); updateRelation(relationId, { [end]: asking.nodeId, relationType: t }) }} />
        ))}
      </div>
    )
  }
  return <>{candidates.map((c) => <MenuItem key={c.id} label={c.label} reason={c.path} onClick={() => pick(c.id)} />)}</>
}

/** The Actions section of one relation's properties card: its ends moved to
 *  other elements the metamodel lets it join, and Hide from view. */
export function RelationActions({ relationId }: { relationId: string }): React.ReactElement | null {
  const rel = useDiagramStore((s) => s.c4Relations[relationId])
  const c4Nodes = useDiagramStore((s) => s.c4Nodes)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const selectEdge = useDiagramStore((s) => s.selectEdge)
  const activeViewId = useDiagramStore((s) => s.activeViewId)
  const canvas = useDiagramStore(onCanvas)
  const hideRelationFromView = useDiagramStore((s) => s.hideRelationFromView)
  const source = rel ? c4Nodes[rel.sourceId] : undefined
  const target = rel ? c4Nodes[rel.targetId] : undefined

  // Every element but its two ends that the metamodel lets it start from
  // (to its target), or end at (from its source).
  const candidates = useCallback((end: 'source' | 'target') => {
    if (!rel || !source || !target) return [] as { id: string; label: string; path: string }[]
    return Object.values(c4Nodes)
      .filter((n) => n.id !== rel.sourceId && n.id !== rel.targetId
        && (end === 'source' ? isRelationAllowed(metamodel, n.type, target.type) : isRelationAllowed(metamodel, source.type, n.type)))
      .map((n) => ({ id: n.id, label: `${n.label || n.type} (${metamodel?.nodeTypes[n.type]?.label ?? n.type})`, path: pathOf(c4Nodes, n.id) }))
      .sort((a, b) => a.path.localeCompare(b.path))
  }, [rel, source, target, c4Nodes, metamodel])
  const sources = useMemo(() => candidates('source'), [candidates])
  const targets = useMemo(() => candidates('target'), [candidates])
  if (!rel || !source || !target) return null

  return (
    <CardActions>
      <ActionMenu variant="card" icon={<Icons.Source />} label="Change source…" title="Re-route this relation from another element" disabled={sources.length === 0}>
        {(close) => <RelationEndItems relationId={rel.id} end="sourceId" candidates={sources} close={close} />}
      </ActionMenu>
      <ActionMenu variant="card" icon={<Icons.Destination />} label="Change destination…" title="Re-route this relation to another element" disabled={targets.length === 0}>
        {(close) => <RelationEndItems relationId={rel.id} end="targetId" candidates={targets} close={close} />}
      </ActionMenu>
      {canvas && activeViewId && (
        <ActionButton variant="card" icon={<Icons.Hide />} label="Hide from view" title="Hide this relation from this view (the model is not changed)"
          onClick={() => { selectEdge(null); hideRelationFromView(activeViewId, rel.id) }} />
      )}
    </CardActions>
  )
}
