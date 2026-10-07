// ─── Studio document persistence ─────────────────────────────────────────────
//
// Keeps the diagram store and Studio's documents (localStorage, files, markdown
// folders) in sync: saves edits to the active document, loads it on boot and
// when the user switches documents, flushes on page hide, and follows the file
// the host opened Studio with. Imported for its side effects, before anything
// else, by main.tsx (and by the test setup).
//
// The diagram store itself has no notion of documents; see
// store/documentBackend.ts for the read side it needs while building its
// initial state, configured by ./configureDocuments.

import './configureDocuments' // must run before the store module is evaluated
import type { C4Node, C4Relation, DiagramData, DiagramView, NodePosition } from '@radical/common/c4'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { documents, useDocumentsStore, type DocumentSource } from '../store/documentStore'
import { host } from '../platform/host'

let reloadActive: () => void = () => {}

// ─── Load notifications ──────────────────────────────────────────────────────
// A file or folder document reaches the store asynchronously, after the sample
// has rendered (boot) or after the switch (Models dialog, a deep link). The
// router waits for it before it applies a view, milestone or slide from the
// URL; loadDiagram would reset them otherwise.

let _loadingId: string | null = null
const _loadListeners = new Set<(id: string) => void>()

/** The document whose load into the store is in flight, or null. */
export function loadingDocumentId(): string | null {
  return _loadingId
}

/** Calls `listener` with the document id each time a load of the active
 *  document into the store has finished (including a load that found
 *  nothing). Returns the unsubscribe function. */
export function onDocumentLoaded(listener: (id: string) => void): () => void {
  _loadListeners.add(listener)
  return () => { _loadListeners.delete(listener) }
}

/** Re-read the active document from its storage into the diagram store, e.g.
 *  after a web folder regained permission. */
export function reloadActiveDocument(): void {
  reloadActive()
}

// ─── Auto-persist to the active document ────────────────────────────────────
// Subscribe to model slices and debounce-save into whatever the current
// active document is (LS or FS, resolved fresh on every flush).
if (typeof window !== 'undefined') {
  let _persistTimer: ReturnType<typeof setTimeout> | null = null
  let _suspended = false
  // When a structural presentation edit (add/remove/rename/reorder/link a
  // slide) happens in viewer/presenter mode, we still must persist it — but
  // WITHOUT writing the ephemeral explored model layout to disk. This flag
  // tells the next flush to rebuild the model slice from the pre-mode-layout
  // snapshot (captured by setAppMode) so only the presentation change lands.
  let _layoutSafePending = false
  const buildPersistData = (): DiagramData => {
    const data = useDiagramStore.getState().saveDiagram()
    // In explore mode, override the model slice with the layout snapshot taken
    // when we left designer, so ephemeral drags/collapses don't reach disk.
    const pre = (window as any).__preModeLayout as
      | { c4Nodes: Record<string, C4Node>; c4Relations: Record<string, C4Relation>; views: Record<string, DiagramView>; defaultPositions: Record<string, NodePosition> }
      | undefined
    if (_layoutSafePending && pre) {
      data.nodes = Object.values(pre.c4Nodes)
      data.relations = Object.values(pre.c4Relations)
      data.views = Object.values(pre.views)
      data.defaultPositions = pre.defaultPositions
    }
    return data
  }
  const flushPersist = async (): Promise<void> => {
    if (_suspended) return
    const activeId = documents.getActiveId()
    if (!activeId) return
    try {
      const data = buildPersistData()
      _layoutSafePending = false
      await documents.saveDocument(activeId, data)
    } catch (e) {
      console.warn('[diagramStore] persist failed:', e)
    }
  }
  const schedulePersist = (): void => {
    if (_persistTimer !== null) clearTimeout(_persistTimer)
    _persistTimer = setTimeout(() => {
      _persistTimer = null
      void flushPersist()
    }, 400)
  }

  let prev = useDiagramStore.getState()
  useDiagramStore.subscribe((s) => {
    // Loading an outside edit replaces the model in memory. Treat that state
    // as the new baseline instead of queueing an autosave of the reload.
    if (_suspended) { prev = s; return }
    // In viewer/presenter ("explore" mode), drags / collapses mutate the
    // model temporarily but must NEVER reach disk. The setAppMode snapshot
    // restores everything on the way back to designer, so by simply not
    // scheduling a persist while we're outside designer, the explore
    // session stays fully ephemeral.
    const isExploreMode = s.appMode !== 'designer' && s.appMode !== 'metamodel'
    const modelChanged =
      s.c4Nodes !== prev.c4Nodes ||
      s.c4Relations !== prev.c4Relations ||
      s.sequences !== prev.sequences ||
      s.views !== prev.views ||
      s.defaultPositions !== prev.defaultPositions ||
      s.defaultViewport !== prev.defaultViewport ||
      s.defaultLayoutConstraints !== prev.defaultLayoutConstraints ||
      s.snapshots !== prev.snapshots ||
      s.presentations !== prev.presentations ||
      s.metamodel !== prev.metamodel
    // Presentation slide management (add/remove/rename/reorder/link) is a
    // genuine, durable edit even though the slides dock lives in presenter
    // mode. Persist those changes too — but layout-safe, so the ephemeral
    // explored model layout is not written alongside them.
    const presChangedInExplore =
      isExploreMode && s.presentations !== prev.presentations
    if (!isExploreMode && modelChanged) {
      prev = s
      schedulePersist()
    } else if (presChangedInExplore) {
      prev = s
      _layoutSafePending = true
      schedulePersist()
    } else {
      prev = s
    }
  })

  // ── Load a document into the store ───────────────────────────────────────
  // Auto-persist is suspended while loading so the "old model → loaded"
  // replacement doesn't overwrite the document with stale data. Each load
  // gets a sequence number: a load that finishes after a newer one started
  // (the user switched again meanwhile) is dropped, so a slow folder read can
  // never land in — and then be auto-saved into — another document.
  let _loadSeq = 0
  const loadActive = (
    id: string,
    source: DocumentSource | undefined,
    opts?: { keepUi?: boolean },
  ): void => {
    const seq = ++_loadSeq
    _suspended = true
    _loadingId = id
    if (_persistTimer !== null) {
      clearTimeout(_persistTimer)
      _persistTimer = null
    }
    if (_watchingId !== id) stopWatching()
    documents.loadDocument(id).then((data) => {
      if (seq !== _loadSeq || documents.getActiveId() !== id) return
      if (data) {
        const store = useDiagramStore.getState()
        const { activeViewId, selectedNodeId } = store
        store.loadDiagram(data)
        // A reload of the same document keeps the user where they were.
        if (opts?.keepUi) {
          const next = useDiagramStore.getState()
          if (activeViewId && next.views[activeViewId]) next.setActiveView(activeViewId)
          if (selectedNodeId && next.c4Nodes[selectedNodeId]) next.selectNode(selectedNodeId)
        }
        if (source === 'md') watchActive(id)
      } else if (source === 'fs' || source === 'md') {
        // New/empty file: initialize with the maximum built-in metamodel
        useDiagramStore.getState().loadDiagram({
          nodes: [],
          relations: [],
          metamodel: builtInGovernanceMetamodel(),
        })
      }
    }).catch((e) => console.warn('[diagramStore] document load failed:', e))
      .finally(() => {
        if (seq !== _loadSeq) return
        _suspended = false
        _loadingId = null
        if (documents.getActiveId() === id) for (const listener of [..._loadListeners]) listener(id)
      })
  }

  // ── Follow outside edits to the active md-folder document ────────────────
  // Once a folder is loaded, its storage is polled for edits made in another
  // editor or by git; on one, the document is reloaded from disk. The disk
  // wins: a save refused because of such an edit is dropped with the reload.
  let _watchingId: string | null = null
  let _stopWatch: () => void = () => {}
  function stopWatching(): void {
    _stopWatch()
    _stopWatch = () => {}
    _watchingId = null
  }
  function watchActive(id: string): void {
    if (_watchingId === id) return
    stopWatching()
    _watchingId = id
    _stopWatch = documents.watchDocument(id, () => {
      if (documents.getActiveId() !== id) return
      console.info('[diagramStore] document changed on disk — reloading')
      loadActive(id, 'md', { keepUi: true })
    })
  }

  reloadActive = () => {
    const id = documents.getActiveId()
    if (!id) return
    loadActive(id, documents.listDocuments().find(d => d.id === id)?.source)
  }

  // ── Hydrate FS-backed active doc on boot ─────────────────────────────────
  // We rendered the sample synchronously above; if the active doc is FS,
  // load the file now and replace the in-memory model.
  const activeId = documents.getActiveId()
  if (activeId) {
    const meta = documents.listDocuments().find(d => d.id === activeId)
    if (meta?.source === 'fs' || meta?.source === 'md') loadActive(activeId, meta.source)
  }

  // ── React to active-document switches ────────────────────────────────────
  // When the user picks a different document in the manager modal, load it.
  let prevActive = documents.getActiveId()
  useDocumentsStore.subscribe((s) => {
    if (s.activeId === prevActive) {
      // The active document became folder-backed without a reload ("Save as
      // folder…"): start following its folder.
      const active = s.docs.find(d => d.id === s.activeId)
      if (active?.source === 'md' && !_suspended) watchActive(active.id)
      return
    }
    const leaving = prevActive
    prevActive = s.activeId
    // An edit still inside the debounce window belongs to the document being
    // left, which the store still holds: write it there before replacing it.
    if (_persistTimer !== null && leaving && !_suspended) {
      clearTimeout(_persistTimer)
      _persistTimer = null
      const data = buildPersistData()
      _layoutSafePending = false
      documents.saveDocument(leaving, data)
        .catch((e) => console.warn('[diagramStore] persist on switch failed:', e))
    }
    if (!s.activeId) return
    loadActive(s.activeId, documents.listDocuments().find(d => d.id === s.activeId)?.source)
  })

  // Expose hooks for other modules / future use.
  ;(window as any).__radicalFlushPersist = flushPersist

  // ── Synchronous flush on tab close / reload / hide ───────────────────────
  // LocalStorage writes are synchronous, so we can safely persist pending
  // changes during pagehide / visibilitychange. This prevents a quick
  // reload (within the 400 ms debounce) from losing the most recent edit
  // (e.g. a freshly-applied smart layout).
  const flushSync = (): void => {
    if (_suspended) return
    if (_persistTimer === null) return // nothing pending
    clearTimeout(_persistTimer)
    _persistTimer = null
    const activeId = documents.getActiveId()
    if (!activeId) return
    const meta = documents.listDocuments().find(d => d.id === activeId)
    // FS writes go through the async host bridge and won't reliably complete
    // on pagehide; LS writes are synchronous and always make it to disk.
    if (meta?.source !== 'ls') {
      // Best effort — fire-and-forget. Pending FS save may still complete
      // if the unload races slowly enough; if not, the user will see the
      // pre-edit state next time.
      void flushPersist()
      return
    }
    try {
      const data = buildPersistData()
      _layoutSafePending = false
      void documents.saveDocument(activeId, data)
    } catch (e) {
      console.warn('[diagramStore] sync flush failed:', e)
    }
  }
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', flushSync)
    window.addEventListener('beforeunload', flushSync)
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushSync()
    })
  }

  // ── CLI-specified watched file ────────────────────────────────────────────
  // When Radical.Tools is launched with --file /path/to/model.c4.json (or the
  // RADICAL_FILE env var), Electron's main process watches the file and pushes
  // a 'file:external-change' IPC message whenever it changes on disk.
  //
  //   1. On boot: ensure the file is registered as an FS-backed doc and
  //      activate it. The existing switch-doc subscriber (above) will load it.
  //   2. On external change: suspend auto-persist, reload the model from the
  //      new content, then re-enable persist. This lets the user edit the file
  //      in any external editor and see changes reflected in real-time.
  //
  // Writing back from the app is handled by the existing auto-persist path
  // (saveDocument → file:write IPC), which already targets FS-backed docs.
  const h = host()
  if (h.getWatchedPath) {
    void h.getWatchedPath().then((watchedPath) => {
      if (!watchedPath) return
      const meta = documents.createFSDocument(watchedPath)
      // Activate (triggers the switch-doc subscriber above → loads the file).
      documents.setActiveId(meta.id)
    })
  }

  if (h.onFileChanged) {
    h.onFileChanged(({ content }) => {
      _suspended = true
      try {
        const data = JSON.parse(content) as DiagramData
        useDiagramStore.getState().loadDiagram(data)
      } catch (e) {
        console.warn('[diagramStore] external file change — invalid JSON, ignored:', e)
      } finally {
        // Brief delay so the store's _sync() and React render cycle can
        // complete before auto-persist is re-enabled.
        setTimeout(() => { _suspended = false }, 300)
      }
    })
  }
}
