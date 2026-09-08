import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useHubStore, type HubConcept, type HubConceptSummary, type TemplateParam, type HubImportRecord } from '../store/hubStore'
import { useDiagramStore } from '../store/diagramStore'
import type { C4Node, C4Relation, C4ElementType, DiagramSequence } from '../types/c4'
import { NODE_SIZES } from '../types/c4'
import { isParentAllowed } from '../types/metamodel'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  /** When provided, the modal shows only these hub concept IDs (from ?hub= URL param). */
  preselectedIds?: string[]
}

// ─── Category helpers ───────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, string> = {
  pattern: '🏗️',
  'fitness-function': '🎯',
  requirement: '📋',
  adr: '📄',
  blueprint: '🔷',
}

const CATEGORY_LABEL: Record<string, string> = {
  pattern: 'Patterns',
  'fitness-function': 'Fitness Fns',
  requirement: 'Requirements',
  adr: 'ADRs',
  blueprint: 'Blueprints',
}

const CATEGORIES = ['pattern', 'fitness-function', 'requirement', 'adr', 'blueprint'] as const

// ─── Styles ─────────────────────────────────────────────────────────────────

const S = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9000,
  },
  modal: {
    position: 'relative' as const,
    background: 'var(--bg-panel)',
    borderRadius: 12,
    width: '96vw',
    maxWidth: '96vw',
    maxHeight: '88vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: 'var(--shadow-lg)',
    color: 'var(--text-primary)',
    overflow: 'hidden',
  },
  templateOverlay: {
    position: 'absolute' as const,
    inset: 0,
    background: 'var(--bg-panel)',
    display: 'flex',
    flexDirection: 'column' as const,
    zIndex: 10,
  },
  templateHeader: {
    padding: '16px 20px 12px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  templateBody: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  templateField: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  templateLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  templateHint: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  templateInput: {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
    background: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontSize: 14,
    outline: 'none',
  },
  templateFooter: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    padding: '12px 20px 16px',
    borderTop: '1px solid var(--border-color)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px 12px',
    borderBottom: '1px solid var(--border-color)',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 20,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 4,
    lineHeight: 1,
  },
  filterBar: {
    display: 'flex',
    gap: 8,
    padding: '12px 20px',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    borderBottom: '1px solid var(--border-color)',
  },
  pill: (active: boolean) => ({
    padding: '5px 12px',
    borderRadius: 16,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    background: active ? 'var(--accent)' : 'var(--input-bg)',
    color: active ? '#fff' : 'var(--text-secondary)',
    transition: 'background 0.15s, color 0.15s',
  }),
  searchInput: {
    flex: 1,
    minWidth: 160,
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid var(--border-color)',
    background: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
  },
  list: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px 20px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  card: {
    background: 'var(--hover-bg)',
    borderRadius: 8,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardName: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  badge: (bg: string) => ({
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 10,
    background: bg,
    color: '#fff',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  }),
  cardDesc: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 1.45,
  },
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 5,
    alignItems: 'center',
  },
  tag: {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 10,
    background: 'var(--input-bg)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
  importBtn: {
    alignSelf: 'flex-end' as const,
    padding: '6px 16px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    color: 'var(--text-muted)',
    fontSize: 14,
  },
  warning: {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 10,
    background: '#92400e',
    color: '#fde68a',
    fontWeight: 500,
    whiteSpace: 'nowrap' as const,
  },
} as const

const CATEGORY_BADGE_COLORS: Record<string, string> = {
  pattern: '#6d28d9',
  'fitness-function': '#5b21b6',
  requirement: '#0e7490',
  adr: '#92400e',
  blueprint: '#1e3a5f',
}

// ─── Template substitution ──────────────────────────────────────────────────

/** Replace all {{KEY}} tokens in a string with values from the provided map. */
function substituteParams(str: string, values: Record<string, string>): string {
  return str.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => values[key] ?? `{{${key}}}`)
}

/** Return a copy of the concept with {{KEY}} tokens substituted in all node string fields. */
function applyTemplate(concept: HubConcept, values: Record<string, string>): HubConcept {
  if (!concept.templateParams?.length) return concept
  const subst = (node: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node)) {
      out[k] = typeof v === 'string' ? substituteParams(v, values) : v
    }
    return out
  }
  return { ...concept, nodes: concept.nodes.map(subst) }
}

/** Apply each templateParam's own default (or hint) — used for concepts
 *  imported as a "related" tag-along rather than the primary import target,
 *  so their {{KEY}} tokens don't land in the model unresolved. */
function withDefaultParams(concept: HubConcept): HubConcept {
  if (!concept.templateParams?.length) return concept
  const values: Record<string, string> = {}
  for (const p of concept.templateParams) values[p.key] = p.defaultValue ?? p.hint ?? ''
  return applyTemplate(concept, values)
}

/** One checkbox row for a referenced hub concept — shared by the blueprint
 *  picker's "Referenced Hub Concepts" section and the related-concepts
 *  picker, so the two stay visually identical instead of drifting apart. */
function RefCheckboxRow({ concept, checked, onToggle }: {
  concept: HubConceptSummary
  checked: boolean
  onToggle: () => void
}): React.ReactElement {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 4, background: checked ? 'rgba(59,124,201,0.12)' : 'transparent' }}>
      <input
        type="checkbox"
        checked={checked}
        style={{ marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }}
        onChange={onToggle}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12 }}>{CATEGORY_ICON[concept.category] ?? '📦'}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
            {concept.name}
          </span>
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: CATEGORY_BADGE_COLORS[concept.category] ?? '#555', color: '#fff', flexShrink: 0 }}>
            {CATEGORY_LABEL[concept.category] ?? concept.category}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
          {concept.description}
        </div>
      </div>
    </label>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function HubImportModal({ open, onClose, preselectedIds }: Props): React.ReactElement | null {
  const {
    loading,
    error,
    activeCategory,
    searchQuery,
    activeTags,
    fetchConcepts,
    loadConcept,
    loadConcepts,
    setCategory,
    setSearch,
    setTags,
    resetFilters,
    filteredConcepts,
  } = useHubStore()

  // Fetch on open (respects cache).
  useEffect(() => {
    if (open) fetchConcepts()
  }, [open, fetchConcepts])

  // Esc to close.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Reset filters when opening.
  useEffect(() => {
    if (open) resetFilters()
  }, [open, resetFilters])

  const concepts = useMemo(() => {
    if (!open) return []
    const all = filteredConcepts()
    if (!preselectedIds || preselectedIds.length === 0) return all
    const idSet = new Set(preselectedIds)
    return all.filter((c) => idSet.has(c.id))
  }, [open, loading, filteredConcepts, activeCategory, searchQuery, activeTags, preselectedIds])

  // Template parameter fill state: set when user clicks "Add to Model" on a
  // concept that has templateParams.
  const [pendingConcept, setPendingConcept] = useState<HubConcept | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, string>>({})

  // Track which concepts have already been imported in this session.
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

  // Reset importedIds when the modal is opened fresh.
  useEffect(() => {
    if (open) setImportedIds(new Set())
  }, [open])

  // Blueprint picker state: set when user clicks "Add to Model" on a blueprint.
  const [blueprintConcept, setBlueprintConcept] = useState<HubConcept | null>(null)
  const [blueprintSelected, setBlueprintSelected] = useState<Set<string>>(new Set())
  const [blueprintSelectedRefs, setBlueprintSelectedRefs] = useState<Set<string>>(new Set())

  // Related-concepts picker state: set when user clicks "Add to Model" on any
  // non-blueprint concept that has hubRefs — offers to import those alongside it.
  const [relatedPickerConcept, setRelatedPickerConcept] = useState<HubConcept | null>(null)
  const [relatedSelectedRefs, setRelatedSelectedRefs] = useState<Set<string>>(new Set())

  // Reset any in-flight picker/dialog state when the modal is opened fresh —
  // otherwise closing mid-flow (Esc, backdrop click) and reopening for an
  // unrelated concept resurrects the stale overlay for whatever was pending.
  useEffect(() => {
    if (!open) return
    setPendingConcept(null)
    setBlueprintConcept(null)
    setBlueprintSelected(new Set())
    setBlueprintSelectedRefs(new Set())
    setRelatedPickerConcept(null)
    setRelatedSelectedRefs(new Set())
  }, [open])

  // All concept summaries indexed by id — used to list hubRefs in the blueprint picker.
  const allConcepts = useHubStore((s) => s.concepts)

  // Concept ids whose .radical file is being fetched ("Add to Model" in flight).
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set())

  // Initialise default values whenever a new concept is pending.
  useEffect(() => {
    if (!pendingConcept?.templateParams) return
    const defaults: Record<string, string> = {}
    for (const p of pendingConcept.templateParams) {
      defaults[p.key] = p.defaultValue ?? ''
    }
    setParamValues(defaults)
  }, [pendingConcept])

  const activeMetamodelId = useDiagramStore((s) => s.metamodel?.id)
  const metamodel       = useDiagramStore((s) => s.metamodel)
  const selectedNodeId  = useDiagramStore((s) => s.selectedNodeId)
  const c4Nodes         = useDiagramStore((s) => s.c4Nodes)

  // If a node is selected, check whether a concept's root nodes can all be
  // placed inside it. Returns 'ok' | 'incompatible' | null (no selection).
  const getDropTarget = useCallback((concept: HubConceptSummary): 'ok' | 'incompatible' | null => {
    if (!selectedNodeId) return null
    const parentNode = c4Nodes[selectedNodeId]
    if (!parentNode) return null
    const allAllowed = concept.rootTypes.every((t) => isParentAllowed(metamodel, t, parentNode.type))
    return allAllowed ? 'ok' : 'incompatible'
  }, [selectedNodeId, c4Nodes, metamodel])

  const handleImport = useCallback(
    (
      concept: HubConcept,
      templateData?: { originalConcept: HubConcept; paramValues: Record<string, string> },
      opts?: { suppressClose?: boolean; placementOffset?: { x: number; y: number } },
    ) => {
      const store = useDiagramStore.getState()

      // Map old concept node IDs → new store IDs.
      const idMap = new Map<string, string>()

      // If a compatible node is selected, we'll import root nodes as its children.
      const dropParentId = store.selectedNodeId ?? null
      const dropParent   = dropParentId ? store.c4Nodes[dropParentId] ?? null : null
      const useDropParent =
        dropParent !== null &&
        concept.nodes
          .filter((n) => !n.parentId)
          .every((n) => isParentAllowed(store.metamodel, (n.type as string) ?? 'component', dropParent.type))

      // Determine the viewport center in canvas coordinates.
      const getViewport = (window as any).__rfGetViewport as
        | (() => { x: number; y: number; zoom: number })
        | undefined
      const vp = getViewport?.() ?? { x: 0, y: 0, zoom: 1 }
      // A batch import (main concept + related concepts, all centered on the
      // same viewport) staggers each subsequent one via placementOffset —
      // otherwise every cluster lands exactly on top of the last.
      const centerX = (-vp.x + window.innerWidth / 2) / vp.zoom + (opts?.placementOffset?.x ?? 0)
      const centerY = (-vp.y + window.innerHeight / 2) / vp.zoom + (opts?.placementOffset?.y ?? 0)

      // Pre-generate IDs for all nodes so parent references resolve
      // regardless of ordering in hub-data.json.
      for (const raw of concept.nodes) {
        idMap.set(raw.id as string, crypto.randomUUID())
      }

      // Compute the bounding-box of root nodes (no parentId) using the raw
      // positions stored in hub-data. Child-node positions are already
      // relative to their parent in hub-data, so they must NOT be shifted.
      const rootNodes = concept.nodes.filter((n) => !n.parentId)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const n of rootNodes) {
        const rx = (n.x as number) ?? 0
        const ry = (n.y as number) ?? 0
        const rw = (n.width as number) ?? 200
        const rh = (n.height as number) ?? 120
        if (rx < minX) minX = rx
        if (ry < minY) minY = ry
        if (rx + rw > maxX) maxX = rx + rw
        if (ry + rh > maxY) maxY = ry + rh
      }
      // Offset that shifts the root-node cluster to land on the viewport center.
      const clusterW = maxX - minX
      const clusterH = maxY - minY
      const offsetX = isFinite(minX) ? centerX - minX - clusterW / 2 : centerX
      const offsetY = isFinite(minY) ? centerY - minY - clusterH / 2 : centerY

      // Build node objects with remapped IDs.
      const newNodes: Record<string, C4Node> = {}
      for (const raw of concept.nodes) {
        const oldId = raw.id as string
        const newId = idMap.get(oldId)!
        const type = (raw.type as C4ElementType) ?? 'component'
        const defaults = NODE_SIZES[type as keyof typeof NODE_SIZES] ?? { width: 200, height: 120 }
        const isChild = !!raw.parentId

        const node: C4Node = {
          // Spread all raw fields first so metamodel-specific fields (ears_type, action,
          // rationale, precondition, trigger, unwanted_condition, feature, status, priority,
          // etc.) are preserved. Structural fields below override any raw values.
          ...(raw as Record<string, unknown>),
          id: newId,
          type,
          label: (raw.label as string) ?? concept.name,
          description: (raw.description as string) ?? undefined,
          technology: (raw.technology as string) ?? undefined,
          collapsed: (raw.collapsed as boolean) ?? false,
          // templateParams is hub metadata — strip it from the C4Node.
          templateParams: undefined,
          // parentId is intentionally omitted here — handled below after ID remapping.
          parentId: undefined,
          // Children: keep hub-data relative coords as-is (they're relative to their concept-parent).
          // Roots dropped into a selected parent: use hub-data positions as relative coords inside the new parent.
          // Roots without a drop target: apply the viewport centering offset.
          x: isChild ? ((raw.x as number) ?? 20)
            : useDropParent ? ((raw.x as number) ?? 20)
            : ((raw.x as number) ?? 0) + offsetX,
          y: isChild ? ((raw.y as number) ?? 20)
            : useDropParent ? ((raw.y as number) ?? 20)
            : ((raw.y as number) ?? 0) + offsetY,
          width: (raw.width as number) ?? defaults.width,
          height: (raw.height as number) ?? defaults.height,
        } as C4Node

        if (raw.parentId && idMap.has(raw.parentId as string)) {
          node.parentId = idMap.get(raw.parentId as string)
        } else if (!raw.parentId && useDropParent && dropParentId) {
          // Root node → reparent under the selected canvas node.
          node.parentId = dropParentId
        }

        newNodes[newId] = node
      }

      // Build relation objects with remapped IDs.
      const newRelations: Record<string, C4Relation> = {}
      const relIdMap = new Map<string, string>()
      if (concept.relations) {
        for (const raw of concept.relations) {
          const srcId = idMap.get(raw.sourceId as string)
          const dstId = idMap.get(raw.targetId as string)
          if (!srcId || !dstId) continue
          const relId = crypto.randomUUID()
          if (typeof raw.id === 'string') relIdMap.set(raw.id, relId)
          newRelations[relId] = {
            id: relId,
            sourceId: srcId,
            targetId: dstId,
            label: (raw.label as string) ?? undefined,
            technology: (raw.technology as string) ?? undefined,
            relationType: (raw.relationType as string) ?? undefined,
          }
        }
      }

      // Sequences (dynamic flows) survive only if every step's relation was imported.
      const newSequences: Record<string, DiagramSequence> = {}
      for (const raw of concept.sequences ?? []) {
        const ids = (raw.relationIds as string[] | undefined) ?? []
        const mapped = ids.map((id) => relIdMap.get(id))
        if (ids.length === 0 || mapped.some((id) => !id)) continue
        const seqId = crypto.randomUUID()
        newSequences[seqId] = {
          id: seqId,
          name: (raw.name as string) || concept.name,
          relationIds: mapped as string[],
          stepDescriptions: raw.stepDescriptions as (string | undefined)[] | undefined,
        }
      }

      // Single undo + bulk insert — bypasses per-node metamodel validation
      // so curated hub concepts always import cleanly.
      store._pushUndo()
      store._markMilestoneEdit()
      useDiagramStore.setState((state) => {
        Object.assign(state.c4Nodes, newNodes)
        Object.assign(state.c4Relations, newRelations)
        Object.assign(state.sequences, newSequences)
        if (state.activeViewId && state.views[state.activeViewId]) {
          state.views[state.activeViewId].nodeIds.push(...Object.keys(newNodes))
        }
      })

      // Resize all parent nodes bottom-up so that any parent (including the
      // drop-target and any concept-internal parents) visually contains its
      // newly added children without needing an auto-layout run.
      {
        const storeAfter = useDiagramStore.getState()
        const view = storeAfter.activeViewId ? storeAfter.views[storeAfter.activeViewId] : undefined
        const vf = view ? new Set(view.nodeIds) : undefined
        storeAfter._resizeParentsBottomUp(vf)
      }

      store._sync()

      // Persist hub template record so values can be reconfigured later.
      if (templateData && concept.templateParams?.length) {
        const importId = crypto.randomUUID()
        const originalNodesMap: Record<string, Record<string, unknown>> = {}
        const nodeParamsMap: Record<string, TemplateParam[]> = {}
        for (const origNode of templateData.originalConcept.nodes) {
          const newId = idMap.get(origNode.id as string)
          if (newId) {
            originalNodesMap[newId] = origNode as Record<string, unknown>
            const perNodeParams = origNode.templateParams as TemplateParam[] | undefined
            if (perNodeParams?.length) nodeParamsMap[newId] = perNodeParams
          }
        }
        const record: HubImportRecord = {
          conceptId: concept.id,
          conceptName: concept.name,
          templateParams: concept.templateParams,
          paramValues: { ...templateData.paramValues },
          nodeIds: Object.keys(newNodes),
          originalNodes: originalNodesMap,
          nodeParams: Object.keys(nodeParamsMap).length ? nodeParamsMap : undefined,
        }
        store.upsertHubTemplate(importId, record)
      }

      store.pushNotification(
        useDropParent
          ? `Imported "${concept.name}" into "${dropParent!.label}"`
          : `Imported "${concept.name}"`,
        'info',
      )
      // In preselected (hub import) mode: mark as done and close only when all imported.
      if (preselectedIds && preselectedIds.length > 0) {
        setImportedIds((prev) => {
          const next = new Set(prev)
          next.add(concept.id)
          return next
        })
      } else if (!opts?.suppressClose) {
        onClose()
      }
    },
    [onClose, preselectedIds],
  )

  // Loads and imports a set of "related" hub concepts (each with its own
  // template defaults applied, since there's no per-ref params dialog).
  const importRelated = useCallback(
    (ids: Set<string>) => {
      if (ids.size === 0) return
      loadConcepts([...ids]).then(
        (refConcepts) => {
          // Never let a related concept's import close the modal — it's a
          // tag-along, not the user's primary action; the main concept
          // (direct import, or the params dialog's own Import click) is
          // what decides when the flow is actually done. Stagger each one
          // sideways too, or every cluster lands on the same viewport
          // center and they'd all stack exactly on top of each other.
          // Spacing is sized per concept (a pattern's root cluster can be
          // ~2000px wide, not just a single ~260px requirement card). Start
          // with headroom for the main concept's own cluster, which could
          // itself be a wide pattern.
          const GAP = 200
          let cursorX = 500
          for (const rc of refConcepts) {
            const rootNodes = rc.nodes.filter((n) => !n.parentId)
            const xs = rootNodes.map((n) => (n.x as number) ?? 0)
            const rights = rootNodes.map((n) => ((n.x as number) ?? 0) + ((n.width as number) ?? 200))
            const width = rootNodes.length ? Math.max(...rights) - Math.min(...xs) : 260
            cursorX += width / 2 + GAP
            handleImport(withDefaultParams(rc), undefined, {
              suppressClose: true,
              placementOffset: { x: cursorX, y: 0 },
            })
            cursorX += width / 2
          }
        },
        (err: unknown) => useDiagramStore.getState().pushNotification(
          `Failed to load related concepts: ${err instanceof Error ? err.message : 'network error'}`,
          'error',
        ),
      )
    },
    [handleImport, loadConcepts],
  )

  // Clicking "Add to Model": fetch the concept file, then show the blueprint
  // picker for blueprints, the related-concepts picker for anything else with
  // hubRefs, the template fill form for parameterised concepts, otherwise
  // import immediately.
  const handleImportClick = useCallback(
    async (summary: HubConceptSummary) => {
      setFetchingIds((prev) => new Set(prev).add(summary.id))
      let concept: HubConcept
      try {
        concept = await loadConcept(summary.id)
      } catch (err) {
        useDiagramStore.getState().pushNotification(
          `Failed to load "${summary.name}": ${err instanceof Error ? err.message : 'network error'}`,
          'error',
        )
        return
      } finally {
        setFetchingIds((prev) => { const next = new Set(prev); next.delete(summary.id); return next })
      }
      // Only offer refs that actually resolve to a concept the lightweight
      // "related" flow can handle — a blueprint ref needs its own picker
      // (inline elements + nested refs), not a flat one-node import.
      const resolvableRefs = (concept.hubRefs ?? []).filter((id) => {
        const ref = allConcepts.find((c) => c.id === id)
        return ref && ref.category !== 'blueprint'
      })

      if (concept.category === 'blueprint') {
        // Pre-select all non-blueprint-type nodes (the blueprint root is not imported as a node).
        setBlueprintSelected(new Set(concept.nodes.filter((n) => n.type !== 'blueprint').map((n) => n.id as string)))
        setBlueprintSelectedRefs(new Set(concept.hubRefs ?? []))
        setBlueprintConcept(concept)
      } else if (resolvableRefs.length > 0) {
        setRelatedSelectedRefs(new Set(resolvableRefs))
        setRelatedPickerConcept(concept)
      } else if (concept.templateParams?.length) {
        setPendingConcept(concept)
      } else {
        handleImport(concept)
      }
    },
    [handleImport, loadConcept, allConcepts],
  )

  if (!open) return null

  return createPortal(
    <div
      style={S.backdrop}
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return
        const start = e.currentTarget
        const onUp = (ev: MouseEvent): void => {
          window.removeEventListener('mouseup', onUp, true)
          if (ev.target === start) onClose()
        }
        window.addEventListener('mouseup', onUp, true)
      }}
    >
      <div
        style={S.modal}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Import from Hub"
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={S.header}>
          <h3 style={S.title}>Import from Hub</h3>
          <button
            type="button"
            style={S.closeBtn}
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* ── Pre-selection banner ───────────────────────────────────── */}
        {preselectedIds && preselectedIds.length > 0 && (() => {
          const allDone = concepts.length > 0 && concepts.every((c) => importedIds.has(c.id))
          // Count only against the preselected set — importedIds can also
          // contain related concepts tagged along via the related-concepts
          // picker, which must not inflate this "X/Y" progress count.
          const preselectedDoneCount = concepts.filter((c) => importedIds.has(c.id)).length
          return (
            <div style={{
              padding: '8px 20px',
              background: allDone ? 'rgba(5,150,105,.08)' : 'var(--accent-dim)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: allDone ? '#059669' : 'var(--accent)',
            }}>
              <span>{allDone ? '✅' : '🔗'}</span>
              <span style={{ flex: 1 }}>
                {allDone
                  ? <><strong>All {concepts.length} concept{concepts.length !== 1 ? 's' : ''} imported!</strong></>
                  : <>Showing <strong>{concepts.length}</strong> concept{concepts.length !== 1 ? 's' : ''} selected from Hub — <strong>{preselectedDoneCount}/{concepts.length}</strong> imported.</>}
              </span>
              {allDone && (
                <button
                  type="button"
                  onClick={onClose}
                  style={{ ...S.importBtn, padding: '4px 14px', fontSize: 12 }}
                >
                  Close
                </button>
              )}
            </div>
          )
        })()}

        {/* ── Filter bar ─────────────────────────────────────────────── */}
        <div style={S.filterBar}>
          <button
            style={S.pill(activeCategory === null)}
            onClick={() => setCategory(null)}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              style={S.pill(activeCategory === cat)}
              onClick={() => setCategory(cat)}
            >
              {CATEGORY_ICON[cat]} {CATEGORY_LABEL[cat]}
            </button>
          ))}
          <input
            style={S.searchInput}
            type="text"
            placeholder="Search concepts…"
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* ── Active tag filter indicator ─────────────────────────────── */}
        {activeTags.size > 0 && (
          <div style={{ padding: '6px 20px 0', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>Tag{activeTags.size > 1 ? 's' : ''}:</span>
            {[...activeTags].map((t) => (
              <span key={t} style={{ ...S.tag, background: 'var(--accent)', color: '#fff' }}>{t}</span>
            ))}
            <button
              type="button"
              style={{ ...S.closeBtn, fontSize: 14, padding: '0 4px' }}
              onClick={() => setTags(new Set())}
              title="Clear tag filter"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Content ────────────────────────────────────────────────── */}
        <div style={S.list}>
          {loading && <div style={S.center}>Loading hub data…</div>}
          {error && <div style={{ ...S.center, color: 'var(--danger)' }}>⚠ {error}</div>}
          {!loading && !error && concepts.length === 0 && (
            <div style={S.center}>No concepts match your filters.</div>
          )}

          {concepts.map((c) => {
            const metamodelMismatch =
              c.requiredMetamodel && activeMetamodelId && c.requiredMetamodel !== activeMetamodelId
            const dropTarget = getDropTarget(c)
            const selectedNodeLabel = selectedNodeId ? c4Nodes[selectedNodeId]?.label : null
            const alreadyImported = importedIds.has(c.id)
            const fetching = fetchingIds.has(c.id)
            return (
              <div key={c.id} style={{ ...S.card, opacity: alreadyImported ? 0.55 : 1 }}>
                <div style={S.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h4 style={S.cardName}>
                      {CATEGORY_ICON[c.category]} {c.name}
                    </h4>
                    <span style={S.badge(CATEGORY_BADGE_COLORS[c.category] ?? '#555')}>
                      {CATEGORY_LABEL[c.category] ?? c.category}
                    </span>
                    {metamodelMismatch && (
                      <span style={S.warning} title={`Requires metamodel: ${c.requiredMetamodel}`}>
                        ⚠ metamodel
                      </span>
                    )}
                    {dropTarget === 'ok' && selectedNodeLabel && (
                      <span style={{ ...S.badge('#065f46'), maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}
                        title={`Will be added inside "${selectedNodeLabel}"`}>
                        ↳ {selectedNodeLabel}
                      </span>
                    )}
                  </div>
                  {alreadyImported
                    ? <span style={{ ...S.importBtn, background: '#059669', borderColor: '#059669', cursor: 'default', opacity: 0.85 }}>✓ Imported</span>
                    : <button
                        type="button"
                        style={{ ...S.importBtn, opacity: fetching ? 0.6 : 1 }}
                        disabled={fetching}
                        onClick={() => void handleImportClick(c)}
                      >
                        {fetching ? 'Loading…' : 'Add to Model'}
                      </button>
                  }
                </div>
                <p style={S.cardDesc}>{c.description}</p>
                {c.templateParams && c.templateParams.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 2 }}>params:</span>
                    {c.templateParams.map((p) => (
                      <span
                        key={p.key}
                        title={p.hint ? `${p.label} (default: ${p.hint})` : p.label}
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: 'rgba(99,102,241,0.15)',
                          color: 'var(--accent)',
                          fontFamily: 'monospace',
                          whiteSpace: 'nowrap' as const,
                        }}
                      >
                        {p.key}
                      </span>
                    ))}
                  </div>
                )}
                {c.tags.length > 0 && (
                  <div style={S.tagRow}>
                    {c.tags.map((t) => (
                      <span
                        key={t}
                        style={{
                          ...S.tag,
                          ...(activeTags.has(t) ? { background: 'var(--accent)', color: '#fff' } : {}),
                        }}
                        onClick={() => setTags(activeTags.has(t) ? new Set() : new Set([t]))}
                        role="button"
                        tabIndex={0}
                        title={`Filter by tag "${t}"`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Blueprint element picker overlay ────────────────────────── */}
        {blueprintConcept && (
          <div style={S.templateOverlay}>
            <div style={S.templateHeader}>
              <div>
                <h3 style={S.title}>🔷 {blueprintConcept.name}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Select which elements to import into your model.
                </p>
              </div>
              <button type="button" style={S.closeBtn} onClick={() => setBlueprintConcept(null)} aria-label="Cancel">✕</button>
            </div>

            <div style={S.templateBody}>
              {/* ── Inline elements section ── */}
              {(() => {
                const grouped: Record<string, Array<Record<string, unknown>>> = {}
                for (const n of blueprintConcept.nodes) {
                  const t = (n.type as string) ?? 'component'
                  if (!grouped[t]) grouped[t] = []
                  grouped[t].push(n)
                }
                const TYPE_LABELS_LOCAL: Record<string, string> = {
                  blueprint: 'Blueprint root', system: 'Systems', container: 'Containers',
                  component: 'Components', database: 'Databases', webapp: 'Web Apps',
                  queue: 'Queues', domain: 'Domains', group: 'Groups',
                  adr: 'ADRs', 'fitness-fn': 'Fitness Functions', requirement: 'Requirements',
                }
                return Object.entries(grouped).filter(([type]) => type !== 'blueprint').map(([type, nodes]) => (
                  <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>
                      {TYPE_LABELS_LOCAL[type] ?? type} ({nodes.length})
                    </div>
                    {nodes.map((n) => {
                      const nodeId = n.id as string
                      const checked = blueprintSelected.has(nodeId)
                      return (
                        <label key={nodeId} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 4, background: checked ? 'rgba(59,124,201,0.12)' : 'transparent' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            style={{ marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }}
                            onChange={() => {
                              setBlueprintSelected((prev) => {
                                const next = new Set(prev)
                                if (next.has(nodeId)) next.delete(nodeId)
                                else next.add(nodeId)
                                return next
                              })
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                              {(n.label as string) || nodeId}
                            </div>
                            {typeof n.description === 'string' && n.description && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                {n.description}
                              </div>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ))
              })()}

              {/* ── Referenced hub concepts section ── */}
              {blueprintConcept.hubRefs && blueprintConcept.hubRefs.length > 0 && (() => {
                const refs = blueprintConcept.hubRefs
                  .map((id) => allConcepts.find((c) => c.id === id))
                  .filter((c): c is HubConceptSummary => !!c)
                if (refs.length === 0) return null
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 8, borderTop: '1px solid var(--border-color)', marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>
                      Referenced Hub Concepts ({refs.length})
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Standalone hub items recommended by this blueprint. Each will be imported as a separate concept.
                    </div>
                    {refs.map((ref) => (
                      <RefCheckboxRow
                        key={ref.id}
                        concept={ref}
                        checked={blueprintSelectedRefs.has(ref.id)}
                        onToggle={() => {
                          setBlueprintSelectedRefs((prev) => {
                            const next = new Set(prev)
                            if (next.has(ref.id)) next.delete(ref.id)
                            else next.add(ref.id)
                            return next
                          })
                        }}
                      />
                    ))}
                  </div>
                )
              })()}
            </div>

            <div style={S.templateFooter}>
              <button
                type="button"
                style={{ ...S.importBtn, background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                onClick={() => {
                  const allNodeIds = new Set(blueprintConcept.nodes.map((n) => n.id as string))
                  const allRefIds = new Set(blueprintConcept.hubRefs ?? [])
                  const allSelected = blueprintSelected.size === allNodeIds.size && blueprintSelectedRefs.size === allRefIds.size
                  if (allSelected) {
                    setBlueprintSelected(new Set())
                    setBlueprintSelectedRefs(new Set())
                  } else {
                    setBlueprintSelected(allNodeIds)
                    setBlueprintSelectedRefs(allRefIds)
                  }
                }}
              >
                {blueprintSelected.size === blueprintConcept.nodes.length && blueprintSelectedRefs.size === (blueprintConcept.hubRefs?.length ?? 0)
                  ? 'Deselect all' : 'Select all'}
              </button>
              <button type="button" style={{ ...S.importBtn, background: 'var(--input-bg)', color: 'var(--text-secondary)' }} onClick={() => setBlueprintConcept(null)}>
                Cancel
              </button>
              <button
                type="button"
                style={{ ...S.importBtn, opacity: blueprintSelected.size === 0 && blueprintSelectedRefs.size === 0 ? 0.5 : 1 }}
                disabled={blueprintSelected.size === 0 && blueprintSelectedRefs.size === 0}
                onClick={() => {
                  const concept = blueprintConcept
                  const selectedRefs = blueprintSelectedRefs
                  setBlueprintConcept(null)
                  // Import inline elements (filtered by selection)
                  if (blueprintSelected.size > 0) {
                    const filteredNodes = concept.nodes.filter((n) => blueprintSelected.has(n.id as string))
                    const filteredRelations = (concept.relations ?? []).filter(
                      (r) => blueprintSelected.has(r.sourceId as string) && blueprintSelected.has(r.targetId as string)
                    )
                    // Collect templateParams from selected nodes (deduplicate by key).
                    const seenKeys = new Set<string>()
                    const collectedParams: TemplateParam[] = []
                    for (const n of filteredNodes) {
                      const nodePs = n.templateParams as TemplateParam[] | undefined
                      if (nodePs) {
                        for (const p of nodePs) {
                          if (!seenKeys.has(p.key)) { seenKeys.add(p.key); collectedParams.push(p) }
                        }
                      }
                    }
                    const filteredConcept = { ...concept, nodes: filteredNodes, relations: filteredRelations, templateParams: collectedParams.length ? collectedParams : undefined }
                    if (filteredConcept.templateParams?.length) {
                      setPendingConcept(filteredConcept)
                    } else {
                      handleImport(filteredConcept)
                    }
                  }
                  // Import each selected referenced hub concept individually
                  importRelated(selectedRefs)
                }}
              >
                Import ({blueprintSelected.size} inline{blueprintSelectedRefs.size > 0 ? ` + ${blueprintSelectedRefs.size} refs` : ''})
              </button>
            </div>
          </div>
        )}

        {/* ── Related-concepts picker overlay (non-blueprint concepts with hubRefs) ── */}
        {relatedPickerConcept && (() => {
          const refs = (relatedPickerConcept.hubRefs ?? [])
            .map((id) => allConcepts.find((c) => c.id === id))
            .filter((c): c is HubConceptSummary => !!c && c.category !== 'blueprint')
          const allSelected = relatedSelectedRefs.size === refs.length
          const proceedWithMain = (concept: HubConcept): void => {
            if (concept.templateParams?.length) setPendingConcept(concept)
            else handleImport(concept)
          }
          return (
            <div style={S.templateOverlay}>
              <div style={S.templateHeader}>
                <div>
                  <h3 style={S.title}>{CATEGORY_ICON[relatedPickerConcept.category] ?? '📦'} {relatedPickerConcept.name}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    Also import related hub concepts?
                  </p>
                </div>
                <button type="button" style={S.closeBtn} onClick={() => setRelatedPickerConcept(null)} aria-label="Cancel">✕</button>
              </div>

              <div style={S.templateBody}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {refs.map((ref) => (
                    <RefCheckboxRow
                      key={ref.id}
                      concept={ref}
                      checked={relatedSelectedRefs.has(ref.id)}
                      onToggle={() => {
                        setRelatedSelectedRefs((prev) => {
                          const next = new Set(prev)
                          if (next.has(ref.id)) next.delete(ref.id)
                          else next.add(ref.id)
                          return next
                        })
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={S.templateFooter}>
                <button
                  type="button"
                  style={{ ...S.importBtn, background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                  onClick={() => setRelatedSelectedRefs(allSelected ? new Set() : new Set(refs.map((r) => r.id)))}
                >
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
                <button
                  type="button"
                  style={{ ...S.importBtn, background: 'var(--input-bg)', color: 'var(--text-secondary)' }}
                  onClick={() => {
                    const concept = relatedPickerConcept
                    setRelatedPickerConcept(null)
                    setRelatedSelectedRefs(new Set())
                    proceedWithMain(concept)
                  }}
                >
                  Skip
                </button>
                <button
                  type="button"
                  style={S.importBtn}
                  onClick={() => {
                    const concept = relatedPickerConcept
                    const refsToImport = relatedSelectedRefs
                    setRelatedPickerConcept(null)
                    setRelatedSelectedRefs(new Set())
                    importRelated(refsToImport)
                    proceedWithMain(concept)
                  }}
                >
                  Import ({1 + relatedSelectedRefs.size})
                </button>
              </div>
            </div>
          )
        })()}

        {/* ── Template parameter fill overlay ─────────────────────────── */}
        {pendingConcept && (
          <div style={S.templateOverlay}>
            <div style={S.templateHeader}>
              <div>
                <h3 style={S.title}>Configure: {pendingConcept.name}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Fill in the template parameters before importing.
                </p>
              </div>
              <button
                type="button"
                style={S.closeBtn}
                onClick={() => setPendingConcept(null)}
                aria-label="Cancel template"
              >
                ✕
              </button>
            </div>

            <div style={S.templateBody}>
              {(pendingConcept.templateParams ?? []).map((p: TemplateParam) => (
                <div key={p.key} style={S.templateField}>
                  <label style={S.templateLabel}>{p.label}</label>
                  <input
                    style={S.templateInput}
                    type={p.type === 'number' ? 'number' : 'text'}
                    placeholder={p.hint ?? ''}
                    value={paramValues[p.key] ?? ''}
                    onChange={(e) =>
                      setParamValues((prev) => ({ ...prev, [p.key]: e.target.value }))
                    }
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {p.hint && <span style={S.templateHint}>e.g. {p.hint}</span>}
                </div>
              ))}
            </div>

            <div style={S.templateFooter}>
              <button
                type="button"
                style={{ ...S.importBtn, background: 'var(--input-bg)', color: 'var(--text-secondary)' }}
                onClick={() => setPendingConcept(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={S.importBtn}
                onClick={() => {
                  const originalConcept = pendingConcept
                  const resolved = applyTemplate(pendingConcept, paramValues)
                  setPendingConcept(null)
                  handleImport(resolved, { originalConcept, paramValues: { ...paramValues } })
                }}
              >
                Import
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
