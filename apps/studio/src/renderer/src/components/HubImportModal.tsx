import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useHubStore, type HubConcept, type HubConceptSummary } from '@radical/ui/store/hubStore'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { useDialogFocus } from './dialogKeys'
import { bindProblem, bindSuggestions, CONCERN_GROUPS, isConcernPack, metamodelProblem, type BindSuggestion } from '@radical/common/concerns'
import { categoryTheme, hubGroupOf } from '@radical/ui/types/hubTheme'
import { NODE_COLORS, NODE_FG, TYPE_ICON_PATHS } from '@radical/common/c4'
import { ConcernWizard } from './ConcernWizard'
import { importConcernPackIntoDiagram } from '../hub/importConcept'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  /** When provided, the modal shows only these hub concept IDs (from ?hub= URL param). */
  preselectedIds?: string[]
  /** The element a concern pack is bound to by default (the Inspector's
   *  concern finding opens the modal with it). */
  bindTo?: string
}

// ─── Component ──────────────────────────────────────────────────────────────

export function HubImportModal({ open, onClose, preselectedIds, bindTo }: Props): React.ReactElement | null {
  const {
    loading,
    error,
    activeCategory,
    setCategory,
    searchQuery,
    fetchConcepts,
    loadConcept,
    setSearch,
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
  }, [open, loading, filteredConcepts, activeCategory, searchQuery, preselectedIds])

  // How many packs each group holds for the search typed (the side list's
  // counts): the store's search, every group.
  const groupCounts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const idSet = preselectedIds?.length ? new Set(preselectedIds) : null
    const counts: Record<string, number> = { all: 0 }
    for (const c of useHubStore.getState().concepts) {
      if (idSet && !idSet.has(c.id)) continue
      if (q && !`${c.name} ${c.description} ${c.tags.join(' ')}`.toLowerCase().includes(q)) continue
      counts.all++
      const g = hubGroupOf(c)
      counts[g] = (counts[g] ?? 0) + 1
    }
    return counts
  }, [open, loading, searchQuery, preselectedIds])

  // A concern pack being answered (ConcernWizard).
  const [concernConcept, setConcernConcept] = useState<HubConcept | null>(null)

  // Track which concepts have already been imported in this session.
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

  // Reset importedIds when the modal is opened fresh.
  useEffect(() => {
    if (open) setImportedIds(new Set())
  }, [open])

  // Reset any in-flight picker/dialog state when the modal is opened fresh —
  // otherwise closing mid-flow (Esc, backdrop click) and reopening for an
  // unrelated concept resurrects the stale overlay for whatever was pending.
  useEffect(() => {
    if (!open) return
    setConcernConcept(null)
  }, [open])

  // The catalogue's summaries: the Inspector opens the dialog on one by id.
  const allConcepts = useHubStore((s) => s.concepts)

  // Concept ids whose .radical file is being fetched ("Add to Model" in flight).
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set())

  const activeMetamodelId = useDiagramStore((s) => s.metamodel?.id)
  const metamodel       = useDiagramStore((s) => s.metamodel)
  const selectedNodeId  = useDiagramStore((s) => s.selectedNodeId)
  const c4Nodes         = useDiagramStore((s) => s.c4Nodes)

  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef, open)

  // Clicking "Add to Model": fetch the pack's file and open its wizard.
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
      if (isConcernPack(concept)) setConcernConcept(concept)
    },
    [loadConcept],
  )

  // Opened for concern packs (a Hub link of the user's selection, or the
  // Inspector's concern finding with its element): straight to the first
  // one's wizard once the catalogue is in, then each next one's after an
  // import (the queue, in the link's order).
  const autoOpened = useRef(false)
  useEffect(() => { if (!open) autoOpened.current = false }, [open])
  const queue = useMemo(
    () => (preselectedIds ?? []).map((id) => allConcepts.find((c) => c.id === id)).filter((c): c is HubConceptSummary => !!c && isConcernPack(c)),
    [preselectedIds, allConcepts],
  )
  useEffect(() => {
    if (!open || !queue.length || autoOpened.current) return
    autoOpened.current = true
    void handleImportClick(queue[0])
  }, [open, queue, handleImportClick])
  const queuePlace = concernConcept && queue.length > 1 ? queue.findIndex((c) => c.id === concernConcept.id) : -1

  // Where a concern pack can be bound, best first (bindSuggestions), with
  // the selected element after them when it is none of them.
  const c4Relations = useDiagramStore((s) => s.c4Relations)
  const concernChoices = useMemo((): { suggestions: BindSuggestion[]; others: string[] } => {
    if (!concernConcept || !isConcernPack(concernConcept)) return { suggestions: [], others: [] }
    const suggestions = bindSuggestions(concernConcept, c4Nodes, c4Relations, metamodel)
    // Every other element the pack can be bound to, the selected one first.
    const offered = new Set(suggestions.map((c) => c.id))
    const others = Object.values(c4Nodes)
      .filter((n) => !offered.has(n.id) && !bindProblem(n, metamodel))
      .sort((a, b) => Number(b.id === selectedNodeId) - Number(a.id === selectedNodeId) || a.label.localeCompare(b.label))
      .map((n) => n.id)
    return { suggestions, others }
  }, [concernConcept, c4Nodes, c4Relations, metamodel, selectedNodeId])

  if (!open) return null

  const group = CONCERN_GROUPS.find((g) => g.id === activeCategory)
  const preselected = !!preselectedIds?.length
  const addedCount = concepts.filter((c) => importedIds.has(c.id)).length

  return createPortal(
    <div
      className="nw-backdrop hi-backdrop"
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
        className="nw hi"
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Import from Hub"
      >
        <aside className="nw-side">
          <div className="nw-type">
            <span className="nw-type-icon" style={{ background: NODE_COLORS.adr, width: 36, height: 36 }} aria-hidden="true">
              <svg viewBox="0 0 16 16" width={18} height={18} fill={NODE_FG.adr}><path d={TYPE_ICON_PATHS.adr} /></svg>
            </span>
            <div className="nw-type-text">
              <div className="nw-type-label">Import from Hub</div>
              <div className="nw-title">Concern packs</div>
            </div>
          </div>

          <div className="hi-groups" role="group" aria-label="Concern groups">
            <button type="button" className="hi-group" aria-pressed={activeCategory === null} onClick={() => setCategory(null)}>
              <span className="hi-dot all" aria-hidden="true" />
              <span className="hi-group-label">All</span>
              <span className="hi-group-count">{groupCounts.all}</span>
            </button>
            {CONCERN_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                className="hi-group"
                aria-pressed={activeCategory === g.id}
                title={g.description}
                onClick={() => setCategory(activeCategory === g.id ? null : g.id)}
              >
                <span className="hi-dot" style={{ background: categoryTheme(g.id).color }} aria-hidden="true" />
                <span className="hi-group-label">{g.label}</span>
                <span className="hi-group-count">{groupCounts[g.id] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="nw-keys" aria-hidden="true">
            <span><kbd>Esc</kbd> close</span>
          </div>
        </aside>

        <section className="nw-main">
          <header className="nw-head">
            <div className="nw-eyebrow">
              {preselected
                ? `From the Hub link · ${addedCount} of ${concepts.length} added`
                : `${concepts.length} concern pack${concepts.length === 1 ? '' : 's'}`}
            </div>
            <h2 className="nw-heading">{group ? group.label : 'All concern packs'}</h2>
            <p className="nw-help">
              {group ? group.description : 'Each pack asks a few questions, then adds a decision with the requirements, scenarios and fitness functions that hold it.'}
            </p>
            <button type="button" className="nw-close" aria-label="Close" title="Close (Esc)" onClick={onClose}>
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <div className="nw-search hi-search">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              <input
                className="nw-input"
                type="text"
                placeholder="Search concern packs…"
                value={searchQuery}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </header>

          <div className="nw-body hi-body">
            {loading && <div className="nw-empty">Loading the Hub…</div>}
            {error && <div className="nw-empty hi-error">{error}</div>}
            {!loading && !error && concepts.length === 0 && (
              <div className="nw-empty">No concern pack matches{searchQuery.trim() ? ` “${searchQuery.trim()}”` : ''}{group ? ` in ${group.label}` : ''}.</div>
            )}

            {concepts.length > 0 && (
              <ul className="hi-list">
                {concepts.map((c) => {
                  const metamodelMismatch =
                    c.requiredMetamodel && activeMetamodelId && c.requiredMetamodel !== activeMetamodelId
                  const alreadyImported = importedIds.has(c.id)
                  const fetching = fetchingIds.has(c.id)
                  const theme = categoryTheme(hubGroupOf(c))
                  const asks = (c.templateParams ?? []).filter((p) => p.options?.length).map((p) => p.title ?? p.label)
                  return (
                    <li key={c.id} className={`hi-pack${alreadyImported ? ' done' : ''}`}>
                      <div className="hi-pack-text">
                        <h4 className="hi-pack-name">{c.name}</h4>
                        <p className="hi-pack-desc">{c.description}</p>
                        <div className="hi-pack-meta">
                          <span className="hi-pack-group" style={{ color: theme.color }}>
                            <span className="hi-dot" style={{ background: theme.color }} aria-hidden="true" />
                            {theme.label}
                          </span>
                          {asks.length > 0 && <span title={asks.join(' · ')}>Asks: {asks.join(' · ')}</span>}
                          {metamodelMismatch && (
                            <span className="hi-warn" title={`Made for the metamodel ${c.requiredMetamodel}`}>Other metamodel</span>
                          )}
                        </div>
                      </div>
                      {alreadyImported
                        ? <span className="hi-added">
                            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            Added
                          </span>
                        : <button
                            type="button"
                            className="nw-btn hi-add"
                            disabled={fetching}
                            onClick={() => void handleImportClick(c)}
                          >
                            {fetching ? 'Loading…' : 'Add to Model'}
                          </button>
                      }
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ── Concern pack: a wizard over the dialog ───────────────────── */}
        {concernConcept && (
          <ConcernWizard
            concept={concernConcept}
            suggestions={concernChoices.suggestions}
            others={concernChoices.others}
            nodes={c4Nodes}
            position={queuePlace >= 0 ? `${queuePlace + 1} of ${queue.length}` : undefined}
            problem={metamodelProblem(concernConcept, metamodel)}
            onCancel={() => {
              // Opened from the Inspector for this pack: back there, not to a list of one.
              if (bindTo) onClose()
              else setConcernConcept(null)
            }}
            onImport={(answers, elementIds) => {
              // Viewer shows a model that is never saved; elsewhere (the
              // Inspector, which opened it) the user stays to see the
              // concern settled.
              if (useDiagramStore.getState().appMode === 'viewer') useDiagramStore.getState().setAppMode('designer')
              try {
                importConcernPackIntoDiagram(concernConcept, answers, elementIds)
              } catch (error) {
                useDiagramStore.getState().pushNotification((error as Error).message, 'error')
                return
              }
              // The next pack of the queue not imported yet, or done.
              const imported = new Set(importedIds).add(concernConcept.id)
              setImportedIds(imported)
              setConcernConcept(null)
              const next = queue.find((c) => !imported.has(c.id))
              if (next && !bindTo) void handleImportClick(next)
              else onClose()
            }}
          />
        )}

      </div>
    </div>,
    document.body,
  )
}
