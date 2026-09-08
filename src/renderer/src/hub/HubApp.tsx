// ─── Radical Hub — embedded viewer ───────────────────────────────────────────
//
// The catalogue of architecture concepts (hub/index.json + one .radical file
// per concept) rendered by the real
// studio: pick a concept on the left, explore it on the right with the same
// Canvas / Wiki / Table views and the same node components the editor uses.
// The store runs under the 'viewer' runtime profile (see runtime.ts): nothing
// is persisted, and the app mode is pinned to the read-only explore sandbox.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { useDiagramStore } from '../store/diagramStore'
import { useHubStore, type HubConcept, type HubConceptSummary } from '../store/hubStore'
import type { HubRadicalDoc } from './hubFormat'
import { Canvas } from '../components/Canvas'
import { WikiView } from '../components/WikiView'
import { TableView } from '../components/TableView'
import { RightPanel } from '../components/RightPanel'
import { NotificationHost } from '../components/NotificationHost'
import { HUB_CATEGORIES, categoryTheme, type HubCategory } from '../types/hubTheme'
import {
  conceptToDiagramData,
  defaultViewKind,
  kindForViewId,
  viewIdForKind,
  type HubViewKind,
} from './conceptToDiagram'
import { parseHubHash, formatHubHash, studioImportUrl } from './hubRoute'
import { HubLanding } from './HubLanding'
import { SiteNav } from './SiteNav'

const STUDIO_URL = import.meta.env.DEV ? '/' : 'https://studio.radical.tools'
const LS_THEME = 'radical-theme'
const LS_RIGHT = 'radical-hub-rp-collapsed'

// ─── Icons ───────────────────────────────────────────────────────────────────

const TypeIcon = ({ path, size = 14, color }: { path: string; size?: number; color?: string }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} fill={color ?? 'currentColor'} aria-hidden="true">
    <path d={path} />
  </svg>
)

const IconFitAll = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" />
    <rect x="5" y="5" width="6" height="6" rx="1" />
  </svg>
)

const IconSmartLayout = () => (
  <svg className="toolbar-btn-accent-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" />
    <circle cx="8" cy="8" r="2" />
  </svg>
)

const IconPlus = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z" /></svg>
)

const IconCheck = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" /></svg>
)

const IconCopy = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" /><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" /></svg>
)

const IconDownload = () => (
  <svg viewBox="0 0 16 16" fill="currentColor"><path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z" /><path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.97a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 6.779a.75.75 0 1 1 1.06-1.06l1.97 1.97Z" /></svg>
)

const IconStudio = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10" />
    <path d="M9 2h5v5M14 2 7.5 8.5" />
  </svg>
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** The catalogue file as published — what "Download" / "Copy" hand out. */
function conceptJson(doc: HubRadicalDoc): string {
  return JSON.stringify(doc, null, 2)
}

/** Fit once React Flow has measured the nodes, and again after the live
 *  layout's initial settle so the whole diagram ends up in view. */
function scheduleFit(fit: () => void): () => void {
  const timers = [80, 600].map((ms) => setTimeout(fit, ms))
  return () => timers.forEach(clearTimeout)
}

function downloadConcept(doc: HubRadicalDoc): void {
  const blob = new Blob([conceptJson(doc)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${doc.hub.id}.radical`
  a.click()
  URL.revokeObjectURL(url)
}

function metaBadges(concept: HubConceptSummary): Array<{ label: string; value: string }> {
  const node = concept.preview
  const out: Array<{ label: string; value: string }> = []
  const push = (label: string, v: unknown) => { if (v !== undefined && v !== null && v !== '') out.push({ label, value: String(v) }) }
  switch (concept.category) {
    case 'requirement':
      push('EARS', node.ears_type); push('Priority', node.priority); push('Status', node.status); break
    case 'fitness-function':
      push('Category', node.category); push('Trigger', node.trigger); push('Status', node.status); break
    case 'adr':
      push('Status', node.status); break
    case 'pattern':
    case 'blueprint':
      push('Elements', concept.nodeCount); push('Relations', concept.relationCount); break
  }
  return out
}

// ─── Catalogue ───────────────────────────────────────────────────────────────

function ConceptCard({
  concept, active, selected, onOpen, onToggleSelect, onTag,
}: {
  concept: HubConceptSummary
  active: boolean
  selected: boolean
  onOpen: () => void
  onToggleSelect: () => void
  onTag: (tag: string) => void
}) {
  const theme = categoryTheme(concept.category)
  const badges = metaBadges(concept)
  return (
    <article
      className={`hub-card${active ? ' active' : ''}${selected ? ' selected' : ''}`}
      style={{ ['--cat-color' as string]: theme.color }}
      onClick={onOpen}
    >
      <div className="hub-card-head">
        <span className="hub-card-icon"><TypeIcon path={theme.iconPath} size={14} color={theme.fg} /></span>
        <span className="hub-card-name">{concept.name}</span>
        <button
          type="button"
          className={`hub-card-select${selected ? ' on' : ''}`}
          title={selected ? 'Remove from selection' : 'Select for import into Studio'}
          onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
        >
          {selected ? <IconCheck /> : <IconPlus />}
        </button>
      </div>
      <p className="hub-card-desc">{concept.description}</p>
      {(badges.length > 0 || concept.templateParams?.length) ? (
        <div className="hub-card-meta">
          <span className="hub-badge hub-badge-cat">{theme.label}</span>
          {badges.map((b) => (
            <span className="hub-badge" key={b.label}><span className="hub-badge-k">{b.label}</span>{b.value}</span>
          ))}
          {concept.templateParams?.length ? (
            <span className="hub-badge" title={concept.templateParams.map((p) => p.key).join(', ')}>
              <span className="hub-badge-k">params</span>{concept.templateParams.length}
            </span>
          ) : null}
        </div>
      ) : null}
      {concept.tags.length > 0 && (
        <div className="hub-card-tags">
          {concept.tags.map((t) => (
            <button type="button" className="hub-tag" key={t} onClick={(e) => { e.stopPropagation(); onTag(t) }}>{t}</button>
          ))}
        </div>
      )}
    </article>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

function HubAppInner(): React.ReactElement {
  const concepts = useHubStore((s) => s.concepts)
  const loaded = useHubStore((s) => s.loaded)
  const docs = useHubStore((s) => s.docs)
  const loading = useHubStore((s) => s.loading)
  const error = useHubStore((s) => s.error)
  const fetchConcepts = useHubStore((s) => s.fetchConcepts)
  const loadConcept = useHubStore((s) => s.loadConcept)
  const activeCategory = useHubStore((s) => s.activeCategory)
  const activeTag = useHubStore((s) => s.activeTag)
  const searchQuery = useHubStore((s) => s.searchQuery)
  const setCategory = useHubStore((s) => s.setCategory)
  const setTag = useHubStore((s) => s.setTag)
  const setSearch = useHubStore((s) => s.setSearch)
  const filtered = useHubStore((s) => s.filteredConcepts)

  const activeViewId = useDiagramStore((s) => s.activeViewId)
  const isLayoutRunning = useDiagramStore((s) => s.isLayoutRunning)
  const loadDiagram = useDiagramStore((s) => s.loadDiagram)
  const setActiveView = useDiagramStore((s) => s.setActiveView)
  const fitAll = useDiagramStore((s) => s.fitAll)
  const runSmartLayout = useDiagramStore((s) => s.runSmartLayout)
  const pushNotification = useDiagramStore((s) => s.pushNotification)

  const [conceptId, setConceptId] = useState<string | undefined>(() => parseHubHash(window.location.hash).concept)
  // Landing page vs catalogue. Any concept / filter implies the catalogue.
  const [browsing, setBrowsing] = useState<boolean>(() => !!parseHubHash(window.location.hash).browse)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [rightCollapsed, setRightCollapsed] = useState<boolean>(() => localStorage.getItem(LS_RIGHT) === '1')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem(LS_THEME) as 'dark' | 'light') || 'dark')
  // Pending view kind from a deep link, applied once the concept is loaded.
  const pendingView = useRef<HubViewKind | undefined>(parseHubHash(window.location.hash).view)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(LS_THEME, theme)
  }, [theme])

  useEffect(() => { void fetchConcepts() }, [fetchConcepts])

  // Initial filters from the URL.
  useEffect(() => {
    const r = parseHubHash(window.location.hash)
    if (r.category) setCategory(r.category)
    if (r.tag) setTag(r.tag)
  }, [setCategory, setTag])

  const summary = useMemo(() => concepts.find((c) => c.id === conceptId), [concepts, conceptId])
  const concept = conceptId ? loaded[conceptId] : undefined
  const conceptDoc = conceptId ? docs[conceptId] : undefined
  const related = useMemo(
    () => (concept?.hubRefs ?? []).map((id) => concepts.find((c) => c.id === id)).filter((c): c is HubConceptSummary => !!c),
    [concept, concepts],
  )
  const [conceptError, setConceptError] = useState<string | null>(null)
  const viewKind = kindForViewId(activeViewId)

  // Fetch the selected concept's .radical file once the index knows about it.
  useEffect(() => {
    setConceptError(null)
    if (!summary || concept) return
    let cancelled = false
    loadConcept(summary.id).catch((err: unknown) => {
      if (!cancelled) setConceptError(err instanceof Error ? err.message : 'Failed to load concept')
    })
    return () => { cancelled = true }
  }, [summary, concept, loadConcept])

  // Load the selected concept into the (sandboxed) diagram store.
  useEffect(() => {
    if (!concept) return
    loadDiagram(conceptToDiagramData(concept))
    const kind = pendingView.current ?? defaultViewKind(concept)
    pendingView.current = undefined
    setActiveView(viewIdForKind(kind))
    if (kind === 'canvas') return scheduleFit(fitAll)
  }, [concept, loadDiagram, setActiveView, fitAll])

  // Keep the active card visible when the concept comes from a deep link.
  useEffect(() => {
    if (!conceptId) return
    const el = document.querySelector('.hub-card.active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [conceptId, concepts])

  // Mirror state → URL. Landing ↔ catalogue transitions push a history entry
  // so the browser Back button returns to the landing page.
  const prevBrowsing = useRef(browsing)
  useEffect(() => {
    const hash = formatHubHash({
      browse: browsing,
      concept: concept?.id,
      view: concept ? viewKind : undefined,
      category: activeCategory ?? undefined,
      tag: activeTag ?? undefined,
    })
    const changed = prevBrowsing.current !== browsing
    prevBrowsing.current = browsing
    if (window.location.hash === hash) return
    const url = hash || window.location.pathname
    if (changed) history.pushState(null, '', url)
    else history.replaceState(null, '', url)
  }, [browsing, concept, viewKind, activeCategory, activeTag])

  // URL → state (back/forward, pasted links).
  useEffect(() => {
    const onHash = () => {
      const r = parseHubHash(window.location.hash)
      setBrowsing(!!r.browse)
      if (r.concept !== conceptId) { pendingView.current = r.view; setConceptId(r.concept) }
      else if (r.view && r.view !== viewKind) setActiveView(viewIdForKind(r.view))
      setCategory(r.category ?? null)
      setTag(r.tag ?? null)
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [conceptId, viewKind, setActiveView, setCategory, setTag])

  const switchView = useCallback((kind: HubViewKind) => {
    setActiveView(viewIdForKind(kind))
    if (kind === 'canvas') scheduleFit(fitAll)
  }, [setActiveView, fitAll])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const openInStudio = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    window.open(studioImportUrl(STUDIO_URL, ids), '_blank', 'noopener')
  }, [])

  const copyJson = useCallback(async (c: HubConcept, d: HubRadicalDoc) => {
    try {
      await navigator.clipboard.writeText(conceptJson(d))
      pushNotification(`Copied "${c.name}" as JSON`, 'info')
    } catch {
      pushNotification('Clipboard unavailable — use Download instead', 'error')
    }
  }, [pushNotification])

  const toggleRight = useCallback(() => {
    setRightCollapsed((c) => { localStorage.setItem(LS_RIGHT, c ? '0' : '1'); return !c })
  }, [])

  const openConcept = useCallback((id: string) => {
    pendingView.current = undefined
    setConceptId(id)
    setBrowsing(true)
  }, [])

  const goHome = useCallback(() => {
    setConceptId(undefined)
    setCategory(null)
    setTag(null)
    setSearch('')
    setBrowsing(false)
  }, [setCategory, setTag, setSearch])

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of concepts) m.set(c.category, (m.get(c.category) ?? 0) + 1)
    return m
  }, [concepts])

  if (!browsing) {
    return (
      <>
        <HubLanding
          concepts={concepts}
          loading={loading}
          studioUrl={STUDIO_URL}
          theme={theme}
          onToggleTheme={toggleTheme}
          onBrowse={() => setBrowsing(true)}
          onSearch={(q) => { setSearch(q); setBrowsing(true) }}
          onCategory={(cat) => { setCategory(cat); setBrowsing(true) }}
          onOpenConcept={openConcept}
        />
        <NotificationHost />
      </>
    )
  }

  const list = filtered()
  const conceptTheme = concept ? categoryTheme(concept.category) : null

  return (
    <div className="hub-shell">
    <SiteNav wide studioUrl={STUDIO_URL} theme={theme} onToggleTheme={toggleTheme} onHub={goHome} />
    <div className={`hub-layout${rightCollapsed ? ' rp-collapsed' : ''}`}>
      {/* ── Catalogue ────────────────────────────────────────────────────────────── */}
      <aside className="hub-catalog">
        <div className="hub-search">
          <input
            type="search"
            placeholder="Search concepts…"
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="hub-filters">
          <button
            type="button"
            className={`hub-chip${activeCategory === null ? ' active' : ''}`}
            onClick={() => setCategory(null)}
          >
            All <span className="hub-chip-count">{concepts.length}</span>
          </button>
          {HUB_CATEGORIES.map((cat: HubCategory) => {
            const t = categoryTheme(cat)
            const n = counts.get(cat) ?? 0
            if (n === 0) return null
            return (
              <button
                type="button"
                key={cat}
                className={`hub-chip${activeCategory === cat ? ' active' : ''}`}
                style={{ ['--chip-color' as string]: t.color }}
                onClick={() => setCategory(activeCategory === cat ? null : cat)}
              >
                <TypeIcon path={t.iconPath} size={12} /> {t.plural} <span className="hub-chip-count">{n}</span>
              </button>
            )
          })}
        </div>

        {activeTag && (
          <div className="hub-active-tag">
            <span>Tag:</span> <span className="hub-tag on">{activeTag}</span>
            <button type="button" className="hub-link" onClick={() => setTag(null)}>clear</button>
          </div>
        )}

        <div className="hub-list">
          {loading && <div className="hub-list-msg">Loading concepts…</div>}
          {error && <div className="hub-list-msg hub-list-err">⚠ {error}</div>}
          {!loading && !error && list.length === 0 && <div className="hub-list-msg">No concepts match your filters.</div>}
          {list.map((c) => (
            <ConceptCard
              key={c.id}
              concept={c}
              active={c.id === conceptId}
              selected={selectedIds.has(c.id)}
              onOpen={() => openConcept(c.id)}
              onToggleSelect={() => toggleSelect(c.id)}
              onTag={(t) => setTag(activeTag === t ? null : t)}
            />
          ))}
        </div>

        {selectedIds.size > 0 && (
          <div className="hub-basket">
            <span>{selectedIds.size} selected</span>
            <button type="button" className="hub-link" onClick={() => setSelectedIds(new Set())}>clear</button>
            <button type="button" className="toolbar-btn active" onClick={() => openInStudio([...selectedIds])}>
              <IconStudio /> Add to Studio
            </button>
          </div>
        )}
      </aside>

      {/* ── Viewer toolbar ────────────────────────────────────────────── */}
      <div className="toolbar hub-toolbar">
        {concept && conceptTheme ? (
          <>
            <span className="hub-toolbar-cat" style={{ background: conceptTheme.color, color: conceptTheme.fg }}>
              <TypeIcon path={conceptTheme.iconPath} size={12} color={conceptTheme.fg} /> {conceptTheme.label}
            </span>
            <span className="hub-toolbar-title" title={concept.name}>{concept.name}</span>
            <div className="toolbar-sep" />
            <div className="toolbar-mode-switch">
              {(['canvas', 'wiki', 'table'] as HubViewKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`toolbar-mode-btn${viewKind === k ? ' active' : ''}`}
                  onClick={() => switchView(k)}
                >
                  {k === 'canvas' ? 'Canvas' : k === 'wiki' ? 'Wiki' : 'Table'}
                </button>
              ))}
            </div>
            {viewKind === 'canvas' && (
              <>
                <button type="button" className="toolbar-btn" onClick={fitAll} title="Fit all nodes to viewport"><IconFitAll /> Fit</button>
                <button
                  type="button"
                  className="toolbar-btn toolbar-btn-accent"
                  onClick={() => { void runSmartLayout() }}
                  disabled={isLayoutRunning}
                  title="Smart Layout (exploration only — nothing is saved)"
                >
                  <IconSmartLayout /> Smart Layout
                </button>
              </>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" className="toolbar-btn" disabled={!conceptDoc} onClick={() => conceptDoc && void copyJson(concept, conceptDoc)} title="Copy as .radical JSON"><IconCopy /> Copy JSON</button>
            <button type="button" className="toolbar-btn" disabled={!conceptDoc} onClick={() => conceptDoc && downloadConcept(conceptDoc)} title="Download as .radical file (opens in Radical Studio)"><IconDownload /> Download</button>
            <button type="button" className="toolbar-btn active" onClick={() => openInStudio([concept.id])} title="Open Radical Studio with this concept ready to import">
              <IconStudio /> Add to Studio
            </button>
          </>
        ) : (
          <>
            <span className="hub-toolbar-title muted">Pick a concept to explore it</span>
            <div style={{ flex: 1 }} />
          </>
        )}
      </div>

      {/* ── Viewer ────────────────────────────────────────────────────── */}
      {!concept ? (
        <div className="canvas-area hub-empty">
          <div className="hub-empty-inner">
            {conceptError ? (
              <p className="hub-list-err">⚠ {conceptError}</p>
            ) : summary ? (
              <p className="muted">Loading “{summary.name}”…</p>
            ) : (
              <>
                <h2>Radical Hub</h2>
                <p>Curated requirements, ADRs, fitness functions, patterns and blueprints — rendered exactly as they will appear in your model.</p>
                <p className="muted">Select a concept on the left to explore it as a diagram, a wiki page or a table. Use <em>Add to Studio</em> to import it into your own model.</p>
              </>
            )}
          </div>
        </div>
      ) : viewKind === 'wiki' ? (
        <WikiView />
      ) : viewKind === 'table' ? (
        <TableView />
      ) : (
        <Canvas />
      )}

      {concept && related.length > 0 && (
        <div className="hub-related" role="navigation" aria-label="Related concepts">
          <span className="hub-related-label">Related</span>
          {related.map((r) => {
            const t = categoryTheme(r.category)
            return (
              <button
                type="button"
                key={r.id}
                className="hub-related-chip"
                style={{ ['--cat-color' as string]: t.color }}
                title={`${t.label}: ${r.description}`}
                onClick={() => openConcept(r.id)}
              >
                <TypeIcon path={t.iconPath} size={11} /> {r.name}
              </button>
            )
          })}
        </div>
      )}

      <RightPanel readOnly collapsed={rightCollapsed} onToggleCollapsed={toggleRight} />
      <NotificationHost />
    </div>
    </div>
  )
}

export default function HubApp(): React.ReactElement {
  return (
    <ReactFlowProvider>
      <HubAppInner />
    </ReactFlowProvider>
  )
}
