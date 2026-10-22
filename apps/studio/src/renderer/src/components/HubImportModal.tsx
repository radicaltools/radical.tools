import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useHubStore, type HubConcept, type HubConceptSummary } from '@radical/ui/store/hubStore'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { useDialogFocus } from './dialogKeys'
import { bindProblem, bindSuggestions, CONCERN_GROUPS, isConcernPack, type BindSuggestion } from '@radical/common/concerns'
import { categoryTheme, hubGroupOf } from '@radical/ui/types/hubTheme'
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

// ─── Component ──────────────────────────────────────────────────────────────

export function HubImportModal({ open, onClose, preselectedIds, bindTo }: Props): React.ReactElement | null {
  const {
    loading,
    error,
    activeCategory,
    setCategory,
    searchQuery,
    activeTags,
    fetchConcepts,
    loadConcept,
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
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
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
        <div style={S.filterBar} role="group" aria-label="Concern groups">
          <button type="button" style={S.pill(activeCategory === null)} aria-pressed={activeCategory === null} onClick={() => setCategory(null)}>All</button>
          {CONCERN_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              style={S.pill(activeCategory === g.id)}
              aria-pressed={activeCategory === g.id}
              title={g.description}
              onClick={() => setCategory(activeCategory === g.id ? null : g.id)}
            >
              {g.label}
            </button>
          ))}
          <input
            style={S.searchInput}
            type="text"
            placeholder="Search concern packs…"
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
            const alreadyImported = importedIds.has(c.id)
            const fetching = fetchingIds.has(c.id)
            return (
              <div key={c.id} style={{ ...S.card, opacity: alreadyImported ? 0.55 : 1 }}>
                <div style={S.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h4 style={S.cardName}>{c.name}</h4>
                    <span style={S.badge(categoryTheme(hubGroupOf(c)).color)}>
                      {categoryTheme(hubGroupOf(c)).label}
                    </span>
                    {metamodelMismatch && (
                      <span style={S.warning} title={`Requires metamodel: ${c.requiredMetamodel}`}>
                        ⚠ metamodel
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
                {!!c.templateParams?.some((p) => p.options?.length) && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Asks: {c.templateParams.filter((p) => p.options?.length).map((p) => p.title ?? p.label).join(' · ')}
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

        {/* ── Concern pack: a wizard over the dialog ───────────────────── */}
        {concernConcept && (
          <ConcernWizard
            concept={concernConcept}
            suggestions={concernChoices.suggestions}
            others={concernChoices.others}
            nodes={c4Nodes}
            position={queuePlace >= 0 ? `${queuePlace + 1} of ${queue.length}` : undefined}
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
