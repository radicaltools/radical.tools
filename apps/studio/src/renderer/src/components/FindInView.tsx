import React, { useEffect, useMemo, useRef } from 'react'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { searchModel } from '@radical/common/search'
import { viewShownNodes } from '@radical/common/viewPipeline'
import { showOnPage } from '../navigation'
import { keysTakenByDialog } from './dialogKeys'
import { useRegisterCommands } from '../commands'

/** Opens find in the view, holding `query` (the last one when omitted). On
 *  a wiki it goes to the wiki's own search box instead, which searches its
 *  pages. `only`: a table shows only the rows found. */
export function openFindInView(query?: string, only = false): void {
  const s = useDiagramStore.getState()
  const view = s.activeViewId ? s.views[s.activeViewId] : undefined
  if (view?.kind === 'wiki' && query === undefined) {
    const box = document.querySelector<HTMLInputElement>('.wiki-nav-search')
    if (box) { box.focus(); box.select(); return }
  }
  s.setFindInView({ query: query ?? s.findInView?.query ?? '', hits: [], index: -1, only })
  window.dispatchEvent(new CustomEvent(FOCUS_FIND))
}

/** Asks the bar, open or about to be, to take the keyboard. */
const FOCUS_FIND = 'radical:focus-find'

/**
 * Find in the view (⌘/Ctrl+F): a bar over the view shown that finds its
 * elements by the words typed, the way Quick Search does (its prefixes
 * too, type: and a property's value). The canvas dims what it does not
 * find, a table its other rows; Enter and Shift+Enter step from one hit to
 * the next, opening the containers it is in and bringing it into sight.
 * Escape closes it and leaves the hit selected.
 */
export function FindInView(): React.ReactElement | null {
  const find = useDiagramStore((s) => s.findInView)
  const setFind = useDiagramStore((s) => s.setFindInView)
  const nodes = useDiagramStore((s) => s.c4Nodes)
  const relations = useDiagramStore((s) => s.c4Relations)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const activeViewId = useDiagramStore((s) => s.activeViewId)
  const view = useDiagramStore((s) => (s.activeViewId ? s.views[s.activeViewId] : undefined))
  const rfNodes = useDiagramStore((s) => s.rfNodes)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const s = useDiagramStore.getState()
      if (s.presentationActive || !(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'f') return
      if (['metamodel', 'inspector'].includes(s.appMode)) return
      if (keysTakenByDialog(e.target)) return
      e.preventDefault()
      openFindInView()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useRegisterCommands('find', () => [
    { id: 'find.view', title: 'Find in the view', group: 'View', keys: '⌘F', run: () => openFindInView() },
  ], [])
  // The keyboard goes to the bar as it opens, and when asked again.
  const isOpen = find !== null
  useEffect(() => {
    const take = (): void => { inputRef.current?.focus(); inputRef.current?.select() }
    if (isOpen) take()
    window.addEventListener(FOCUS_FIND, take)
    return () => window.removeEventListener(FOCUS_FIND, take)
  }, [isOpen])
  // Gone (a presentation started, the Inspector opened): nothing stays dimmed.
  useEffect(() => () => { useDiagramStore.getState().setFindInView(null) }, [])

  // The elements the view shows: its chain's, an exploration's as drawn,
  // all of them on All elements.
  const shown = useMemo<ReadonlySet<string> | null>(() => {
    if (!find) return null
    if (view) return viewShownNodes(view, nodes, relations) ?? null
    if (activeViewId) return new Set(rfNodes.map((n) => n.id))
    return null
  }, [find !== null, view, nodes, relations, activeViewId, rfNodes]) // eslint-disable-line react-hooks/exhaustive-deps

  const query = find?.query ?? ''
  const hits = useMemo(() => {
    if (!query.trim()) return []
    const current = { id: activeViewId, name: view?.name ?? 'All elements', nodes: shown }
    return searchModel({ nodes, relations, metamodel, current }, `@ e: ${query}`).hits.map((h) => h.id)
  }, [query, nodes, relations, metamodel, activeViewId, view?.name, shown])

  // The hits go to the store, which the canvas and the table read; a new
  // list starts before its first hit.
  useEffect(() => {
    const cur = useDiagramStore.getState().findInView
    if (!cur) return
    if (cur.hits.length === hits.length && cur.hits.every((id, i) => id === hits[i])) return
    setFind({ ...cur, hits, index: -1 })
  }, [hits, setFind])

  if (!find) return null

  const step = (dir: 1 | -1): void => {
    const cur = useDiagramStore.getState().findInView
    if (!cur || !cur.hits.length) return
    const index = cur.index < 0 ? (dir === 1 ? 0 : cur.hits.length - 1) : (cur.index + dir + cur.hits.length) % cur.hits.length
    setFind({ ...cur, index })
    const id = cur.hits[index]
    const s = useDiagramStore.getState()
    s.expandAncestors(id)
    showOnPage(s.activeViewId, id)
    s.setSelectedNodeIds([id])
    s.selectNode(id)
    requestAnimationFrame(() => {
      const focus = (window as unknown as { __rfFocusNode?: (id: string, opts?: { zoom?: number; duration?: number }) => void }).__rfFocusNode
      focus?.(id, { zoom: 1.1, duration: 400 })
    })
  }
  const close = (): void => {
    setFind(null)
    inputRef.current?.blur()
  }
  const isTable = !view || view.kind === 'table'
  const count = !query.trim() ? '' : find.hits.length === 0 ? 'No match' : find.index < 0 ? `${find.hits.length} found` : `${find.index + 1} of ${find.hits.length}`

  return (
    <div className="find-in-view" role="search" aria-label="Find in the view"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() } }}>
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden style={{ opacity: 0.6, flexShrink: 0 }}>
        <circle cx="7" cy="7" r="4.5" /><path d="M11 11l3.5 3.5" />
      </svg>
      <input
        ref={inputRef}
        value={find.query}
        placeholder={`Find in ${view?.name ?? 'All elements'}`}
        aria-label="Find in the view"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setFind({ ...find, query: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1) }
        }}
      />
      <span className={`find-in-view-count${query.trim() && !find.hits.length ? ' none' : ''}`} aria-live="polite">{count}</span>
      <button type="button" className="find-in-view-btn" title="Previous (⇧↵)" aria-label="Previous hit" disabled={!find.hits.length} onClick={() => step(-1)}>
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 10l4-4 4 4" /></svg>
      </button>
      <button type="button" className="find-in-view-btn" title="Next (↵)" aria-label="Next hit" disabled={!find.hits.length} onClick={() => step(1)}>
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 6l4 4 4-4" /></svg>
      </button>
      {isTable && (
        <button
          type="button"
          className={`find-in-view-btn${find.only ? ' active' : ''}`}
          title={find.only ? 'Show every row' : 'Show only the rows found'}
          aria-label="Only the rows found"
          aria-pressed={find.only}
          onClick={() => setFind({ ...find, only: !find.only })}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden><path d="M2.5 3h11l-4.2 5v4.5l-2.6 1V8z" /></svg>
        </button>
      )}
      <button type="button" className="find-in-view-btn" title="Close (Esc)" aria-label="Close find" onClick={close}>
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden><path d="M4 4l8 8M12 4l-8 8" /></svg>
      </button>
    </div>
  )
}
