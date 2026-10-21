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
import type { C4Node, C4Relation, DiagramData } from '@radical/common/c4'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import { mergeModelEdits, mergeModels, mergeNotices, modelEdits, type MergeDrop, type ModelEdits } from '@radical/common/modelMerge'
import { useDiagramStore, historyMark, parkedLiveModel, type ParkedDesigner } from '@radical/ui/store/diagramStore'
import { documents, useDocumentsStore, DocumentUnreadableError, StorageFullError, type DocumentSource } from '../store/documentStore'
import { host } from '../platform/host'
import { openFirstView } from '../navigation'

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

/** The model as it was before a reload brought in an edit made outside
 *  Studio: its nodes and relations. */
export interface BeforeOutsideEdit {
  id: string
  nodes: Record<string, C4Node>
  relations: Record<string, C4Relation>
}

const _outsideEditListeners = new Set<(before: BeforeOutsideEdit) => void>()

/** Calls `listener` each time the active document was reloaded because its
 *  folder changed outside Studio (an MCP client, an editor, git), once the
 *  new model is in the store. Returns the unsubscribe function. */
export function onOutsideEditLoaded(listener: (before: BeforeOutsideEdit) => void): () => void {
  _outsideEditListeners.add(listener)
  return () => { _outsideEditListeners.delete(listener) }
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
  /** The longest a save waits while the model goes on changing. */
  const MAX_SAVE_WAIT_MS = 2000
  let _suspended = false
  /** Edits made since the last save was handed to the document store: what a
   *  reload of an outside edit merges into the model it loads. */
  let _unsaved = false
  /** The user was told that saves wait for an agent writing the folder. */
  let _agentNoticeShown = false
  /** The active document's model as last loaded or handed to a save: what
   *  the model in the store was edited from. */
  let _baseModel: DiagramData | null = null
  /** The store's model as a save writes it, when it last was the active
   *  document's (loaded with nothing merged in, or handed to a save); null
   *  when unknown. A save writes more than a document holds (the metamodel
   *  in use, positions, a first presentation): the store's model compared
   *  with `_baseModel` always differed, also once every edit was undone. */
  let _savedShape: DiagramData | null = null
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
    const pre = (window as any).__preModeLayout as ParkedDesigner | undefined
    // The same for any save asked for while exploring (a flush after a
    // layout, the page going away): what is arranged in Viewer or Presenter
    // is never written.
    const { appMode } = useDiagramStore.getState()
    const exploring = appMode !== 'designer' && appMode !== 'metamodel'
    if ((_layoutSafePending || exploring) && pre) {
      // Designer's live model: with a milestone shown there, its parked
      // nodes are the milestone's, and the live model is the one it had set
      // aside (a slide added in Presenter saved the milestone as live).
      const live = parkedLiveModel(pre)
      data.nodes = Object.values(live.nodes)
      data.relations = Object.values(live.relations)
      data.sequences = Object.values(live.sequences)
      // A view an edit of Designer's milestone changed is saved as the live
      // model has it (liveBackup.views).
      const parked = pre.activeSnapshotId ? pre.liveBackup : null
      data.views = Object.values(pre.views).map((v) => parked?.views?.[v.id] ?? v)
      data.defaultPositions = parked?.defaultPositions ?? pre.defaultPositions
    }
    return data
  }
  // Browser storage that is full refuses every save of a local model. Say so
  // once (not on each edit) until a save gets through again.
  let _storageFullShown = false
  const reportSaveError = (e: unknown, interactive = true): void => {
    console.warn('[diagramStore] persist failed:', e)
    if (!(e instanceof StorageFullError) || _storageFullShown || !interactive) return
    _storageFullShown = true
    if (typeof window.alert === 'function') window.alert(e.message)
  }
  /** A presentation is playing: the store holds what a slide shows (its
   *  model, its layout), not the document. Started by F5 in Designer it
   *  kept the perspective at Designer, and a slide of a milestone was saved
   *  as the live model. What was edited before it is saved when it stops. */
  const presenting = (): boolean => useDiagramStore.getState().presentationActive
  /** `leaving`: the page is going away, and a save held for an agent would
   *  never run. The folder is written at once then, merged with the agent's
   *  edits as any write is. */
  const flushPersist = async (leaving = false): Promise<void> => {
    if (_suspended || presenting()) return
    const activeId = documents.getActiveId()
    if (!activeId) return
    // An agent writing the folder over MCP has it to itself: Studio holds its
    // saves until the agent pauses, merging its edits into each change of
    // the agent it reloads meanwhile (loadActive).
    if (!leaving && documents.listDocuments().find((d) => d.id === activeId)?.source === 'md') {
      const until = await documents.agentWritingUntil(activeId).catch(() => 0)
      if (_suspended || presenting() || documents.getActiveId() !== activeId) return
      if (until > Date.now()) {
        holdForAgent(until)
        return
      }
    }
    try {
      const data = buildPersistData()
      _layoutSafePending = false
      _unsaved = false
      _agentNoticeShown = false
      _baseModel = data
      _savedShape = data
      await documents.saveDocument(activeId, data)
      forgetKeptEdits(activeId)
      _storageFullShown = false
    } catch (e) {
      reportSaveError(e, !leaving)
    }
  }
  /** When the save waiting now was first asked for. */
  let _pendingSince = 0
  const schedulePersist = (delay = 400): void => {
    _unsaved = true
    if (_persistTimer !== null) {
      // Changes that keep coming (a layout settling on a large canvas) hold
      // the save back no longer than this: each one put it off again, and
      // a Warnier process of 150 steps was never saved.
      if (Date.now() - _pendingSince >= MAX_SAVE_WAIT_MS) return
      clearTimeout(_persistTimer)
    } else {
      _pendingSince = Date.now()
    }
    _persistTimer = setTimeout(() => {
      _persistTimer = null
      void flushPersist()
    }, delay)
  }
  // ── Edits kept for the next visit ─────────────────────────────────────────
  // A folder is written asynchronously, and a page that goes away (a reload,
  // a closed tab) may not see the write land. What was edited since the last
  // save is kept in localStorage then, as the change it makes (modelEdits),
  // and merged into the folder's model when the document is opened again.
  const KEPT_EDITS = 'radical-unsaved-edits:'
  const keepEdits = (id: string): void => {
    if (!_baseModel) return
    try {
      const now = buildPersistData()
      // Nothing differs from the document (an edit undone since a hidden
      // tab kept it): what was kept goes, or the next visit brought the
      // undone edit back.
      if (_savedShape && !Object.keys(modelEdits(_savedShape, now)).length) {
        localStorage.removeItem(KEPT_EDITS + id)
        return
      }
      const edits = modelEdits(_baseModel, now)
      if (Object.keys(edits).length) localStorage.setItem(KEPT_EDITS + id, JSON.stringify(edits))
      else localStorage.removeItem(KEPT_EDITS + id)
    } catch (e) {
      console.warn('[diagramStore] could not keep the unsaved edits:', e)
    }
  }
  const takeKeptEdits = (id: string): ModelEdits | null => {
    try {
      const text = localStorage.getItem(KEPT_EDITS + id)
      localStorage.removeItem(KEPT_EDITS + id)
      return text ? JSON.parse(text) as ModelEdits : null
    } catch {
      return null
    }
  }
  function forgetKeptEdits(id: string): void {
    try { localStorage.removeItem(KEPT_EDITS + id) } catch { /* nothing kept */ }
  }

  /** Try the save again once the agent's mark has passed; say why, once. */
  const holdForAgent = (until: number): void => {
    if (!_agentNoticeShown) {
      _agentNoticeShown = true
      useDiagramStore.getState().pushNotification('An agent is editing this model. Studio saves your changes when it pauses, merged with its edits.', 'info')
    }
    schedulePersist(Math.max(until - Date.now(), 0) + 250)
  }
  // A save merged with an edit made outside Studio: where both changed the
  // same value the folder's was kept, and the user hears which.
  documents.onSaveMerged((id, merged) => {
    if (id === documents.getActiveId()) reportMergeConflicts(merged)
  })
  const reportMergeConflicts = ({ conflicts, ...rest }: { conflicts: string[]; dropped?: MergeDrop[]; restored?: string[] }): void => {
    const list = (items: string[]) => items.slice(0, 5).join('; ') + (items.length > 5 ? ` and ${items.length - 5} more` : '')
    if (conflicts.length) {
      useDiagramStore.getState().pushNotification(`Your edits were merged with a change made outside Studio. Where both changed the same value, the folder's was kept: ${list(conflicts)}.`, 'warning')
    }
    // A delete won over an edit of the other side; a container came back.
    const notices = mergeNotices(rest, { ours: 'in Studio', theirs: 'outside Studio' })
    if (notices.length) useDiagramStore.getState().pushNotification(`Your edits were merged with a change made outside Studio: ${list(notices)}.`, 'warning')
  }

  /** The folder changed outside Studio while a presentation played: read
   *  once it stops. Read at once, it ended the presentation (the store holds
   *  a slide, not the document) and lost the edits held for an agent. */
  let _changedWhilePresenting: string | null = null

  // ── A load saves nothing by itself ──────────────────────────────────────
  // After a load (a reload of the page, a document opened, an outside
  // change) the store goes on changing: the live layout settles, the canvas
  // gives places to what it has none for, the camera is put back. None of
  // it is the user's: until they edit the model (an undo step made, undone
  // or redone, or a change to more than places), nothing is written. A
  // reload saved the document and its nodes[].x/y mirror, also in Viewer
  // and Presenter (D15).
  /** historyMark() when the active document was last loaded; null once the
   *  user has edited it since. */
  let _loadedAt: number | null = historyMark()
  const NODE_PLACE = new Set(['x', 'y', 'width', 'height'])
  const VIEW_PLACE = new Set(['positions', 'viewport'])
  /** `next` differs from `was` in the places `keys` name only. */
  const placesOnly = <T extends object>(was: Record<string, T>, next: Record<string, T>, keys: Set<string>): boolean => {
    const ids = new Set([...Object.keys(was), ...Object.keys(next)])
    for (const id of ids) {
      const a = was[id] as Record<string, unknown> | undefined
      const b = next[id] as Record<string, unknown> | undefined
      if (a === b) continue
      if (!a || !b) return false
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!keys.has(k) && a[k] !== b[k]) return false
      }
    }
    return true
  }
  /** The change from `prev` to `s` only places things (the live layout, a
   *  canvas shown, the camera). */
  type StoreState = ReturnType<typeof useDiagramStore.getState>
  const placesOnlyChange = (s: StoreState, prev: StoreState): boolean =>
    s.c4Relations === prev.c4Relations &&
    s.sequences === prev.sequences &&
    s.defaultLayoutConstraints === prev.defaultLayoutConstraints &&
    s.defaultEdgeStyle === prev.defaultEdgeStyle &&
    s.snapshots === prev.snapshots &&
    s.presentations === prev.presentations &&
    s.metamodel === prev.metamodel &&
    (s.c4Nodes === prev.c4Nodes || placesOnly(prev.c4Nodes as Record<string, object>, s.c4Nodes as Record<string, object>, NODE_PLACE)) &&
    (s.views === prev.views || placesOnly(prev.views as Record<string, object>, s.views as Record<string, object>, VIEW_PLACE))

  let prev = useDiagramStore.getState()
  useDiagramStore.subscribe((s) => {
    if (prev.presentationActive && !s.presentationActive && _changedWhilePresenting) {
      const id = _changedWhilePresenting
      _changedWhilePresenting = null
      // After the stop has put the document's model back.
      setTimeout(() => {
        if (documents.getActiveId() === id && !presenting()) loadActive(id, 'md', { keepUi: true })
      }, 0)
    }
    // Loading an outside edit replaces the model in memory. Treat that state
    // as the new baseline instead of queueing an autosave of the reload.
    if (_suspended) { prev = s; return }
    // In viewer/presenter ("explore" mode), drags / collapses mutate the
    // model temporarily but must NEVER reach disk. The setAppMode snapshot
    // restores everything on the way back to designer, so by simply not
    // scheduling a persist while we're outside designer, the explore
    // session stays fully ephemeral.
    if (s.presentationActive) { prev = s; return }
    const isExploreMode = s.appMode !== 'designer' && s.appMode !== 'metamodel'
    const modelChanged =
      s.c4Nodes !== prev.c4Nodes ||
      s.c4Relations !== prev.c4Relations ||
      s.sequences !== prev.sequences ||
      s.views !== prev.views ||
      s.defaultPositions !== prev.defaultPositions ||
      s.defaultViewport !== prev.defaultViewport ||
      s.defaultLayoutConstraints !== prev.defaultLayoutConstraints ||
      s.defaultEdgeStyle !== prev.defaultEdgeStyle ||
      s.snapshots !== prev.snapshots ||
      s.presentations !== prev.presentations ||
      s.metamodel !== prev.metamodel
    // Presentation slide management (add/remove/rename/reorder/link) is a
    // genuine, durable edit even though the slides dock lives in presenter
    // mode. Persist those changes too — but layout-safe, so the ephemeral
    // explored model layout is not written alongside them.
    const presChangedInExplore =
      isExploreMode && s.presentations !== prev.presentations
    // A milestone shown, or the live model shown again, is no edit: the
    // store holds the milestone's model meanwhile, and the live document is
    // as it was. Opening one saved the document as the store had it.
    const milestoneSwitched = s.activeSnapshotId !== prev.activeSnapshotId
    if (_loadedAt !== null && modelChanged && historyMark() === _loadedAt && (milestoneSwitched || placesOnlyChange(s, prev))) {
      // The load settling: kept from disk until the user edits.
      prev = s
      return
    }
    if (modelChanged && !isExploreMode) _loadedAt = null
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
    opts?: { keepUi?: boolean; firstView?: boolean },
  ): void => {
    const seq = ++_loadSeq
    _changedWhilePresenting = null
    // Edits not saved yet when the folder changed outside Studio: merged
    // into what is on disk now, from the model they were made on. Without
    // them the disk's model is loaded as it is.
    const unsaved = opts?.keepUi && _unsaved && _baseModel && !presenting()
      ? { base: _baseModel, ours: buildPersistData() }
      : null
    if (!opts?.keepUi) _unsaved = false
    _suspended = true
    _loadingId = id
    if (_persistTimer !== null) {
      clearTimeout(_persistTimer)
      _persistTimer = null
    }
    let mergedEdits = false
    if (_watchingId !== id) stopWatching()
    const live = useDiagramStore.getState()
    const camera = opts?.keepUi ? (window as any).__rfCurrentViewport as { x: number; y: number; zoom: number } | undefined : undefined
    // The live model, also while a milestone is shown: an outside change is
    // the live model's. Compared with the milestone, a milestone deleted
    // outside lit up what it and its edits had otherwise.
    const before: BeforeOutsideEdit | null = opts?.keepUi
      ? live.activeSnapshotId && live.liveBackup
        ? { id, nodes: live.liveBackup.nodes, relations: live.liveBackup.relations }
        : { id, nodes: live.c4Nodes, relations: live.c4Relations }
      : null
    documents.loadDocument(id).then((data) => {
      if (seq !== _loadSeq || documents.getActiveId() !== id) return
      if (data) {
        const store = useDiagramStore.getState()
        const { activeViewId, selectedNodeId } = store
        // Kept apart from the store, which may fill in what it loads.
        _baseModel = structuredClone(data)
        // An outside change to the model shown keeps the user's undo steps,
        // which then make their change on the model with it.
        const outsideChange = !!opts?.keepUi
        // Edits the page had not written when it went away (keepEdits).
        const kept = !opts?.keepUi && source === 'md' ? takeKeptEdits(id) : null
        if (unsaved) {
          const { merged, ...report } = mergeModels(unsaved.base, unsaved.ours, data)
          store.loadDiagram(structuredClone(merged), { outsideChange })
          mergedEdits = true
          reportMergeConflicts(report)
        } else if (kept) {
          const { merged, ...report } = mergeModelEdits(kept, data)
          store.loadDiagram(structuredClone(merged))
          mergedEdits = true
          reportMergeConflicts(report)
        } else {
          store.loadDiagram(data, { outsideChange })
        }
        // A model opened (from a file, a folder, the list, a Hub link) shows
        // its first view: All elements, the table of everything, only when
        // it has none. It landed on All elements.
        if (opts?.firstView) openFirstView()
        // A reload of the same document keeps the user where they were.
        if (opts?.keepUi) {
          const next = useDiagramStore.getState()
          if (activeViewId && next.views[activeViewId]) next.setActiveView(activeViewId)
          if (selectedNodeId && next.c4Nodes[selectedNodeId]) next.selectNode(selectedNodeId)
          // Loading put back the camera saved on disk; keep the one in use.
          if (camera) {
            const shown = useDiagramStore.getState().rfNodes.filter((n) => !n.hidden).map((n) => n.id)
            ;(window as any).__rfPlaceCamera?.({ ...camera }, shown, { keep: true })
          }
        }
        // The model on screen is the document's, unless edits were merged in.
        _savedShape = mergedEdits ? null : buildPersistData()
        if (before) for (const listener of [..._outsideEditListeners]) listener(before)
        if (source === 'md') watchActive(id)
      } else {
        // New/empty file, or content that is missing: initialize with the
        // maximum built-in metamodel. Never keep the model on screen, which
        // belongs to the document just left.
        _baseModel = null
        _savedShape = null
        useDiagramStore.getState().loadDiagram({
          nodes: [],
          relations: [],
          metamodel: builtInGovernanceMetamodel(),
        })
      }
    }).catch((e) => {
      if (!(e instanceof DocumentUnreadableError)) {
        console.warn('[diagramStore] document load failed:', e)
        return
      }
      if (seq !== _loadSeq || documents.getActiveId() !== id) return
      // A file of the folder cannot be parsed. Say so and leave the folder
      // alone (the document store refuses to save until a read succeeds).
      // On a reload the model on screen stays, as it was before the file
      // broke; otherwise the screen holds the document just left.
      const store = useDiagramStore.getState()
      if (!opts?.keepUi) store.loadDiagram({ nodes: [], relations: [], metamodel: builtInGovernanceMetamodel() })
      store.pushNotification(opts?.keepUi ? `${e.message} The model on screen is the one from before.` : e.message, 'error')
      // Follow the folder: the fix arrives as a change.
      if (source === 'md') watchActive(id)
    })
      .finally(() => {
        if (seq !== _loadSeq) return
        _suspended = false
        _loadingId = null
        // What settles from here on is the load's, not an edit.
        _loadedAt = mergedEdits ? null : historyMark()
        // The merged edits are still to be saved.
        if (mergedEdits) schedulePersist()
        if (documents.getActiveId() === id) for (const listener of [..._loadListeners]) listener(id)
      })
  }

  // ── Follow outside edits to the active md-folder document ────────────────
  // Once a folder is loaded, its storage is polled for edits made in another
  // editor, by git or by an agent; on one, the document is reloaded from
  // disk, with the edits not saved yet merged in (a save made meanwhile is
  // merged with it as it is written).
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
      if (presenting()) { _changedWhilePresenting = id; return }
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
      // The folder was just written with the model as it is: that is what
      // later edits are kept against (keepEdits). Set only by a save, it
      // stayed unset once a load stopped saving by itself (D15), and an edit
      // held for an agent was lost by a reload.
      if (active?.source === 'md' && !_baseModel) {
        _baseModel = buildPersistData()
        _savedShape = _baseModel
      }
      if (active?.source === 'md' && !_suspended) watchActive(active.id)
      // Moved back to the browser: the folder is not followed any more.
      else if (active && active.source !== 'md') stopWatching()
      return
    }
    const leaving = prevActive
    prevActive = s.activeId
    // An edit still inside the debounce window belongs to the document being
    // left, which the store still holds: write it there before replacing it.
    if (_persistTimer !== null && leaving && !_suspended && !presenting()) {
      clearTimeout(_persistTimer)
      _persistTimer = null
      const data = buildPersistData()
      _layoutSafePending = false
      _unsaved = false
      documents.saveDocument(leaving, data).then(() => forgetKeptEdits(leaving), (e) => reportSaveError(e))
    }
    if (!s.activeId) {
      // The only model was deleted. It stayed on screen with nowhere to save
      // to, and a reload showed another one: start an empty model instead.
      if (s.docs.length === 0) {
        try {
          documents.createLSDocument('Untitled', { nodes: [], relations: [], metamodel: builtInGovernanceMetamodel() })
        } catch (e) {
          reportSaveError(e)
        }
      }
      return
    }
    loadActive(s.activeId, documents.listDocuments().find(d => d.id === s.activeId)?.source, { firstView: true })
  })

  // Expose hooks for other modules / future use.
  ;(window as any).__radicalFlushPersist = flushPersist

  // ── Synchronous flush on tab close / reload / hide ───────────────────────
  // LocalStorage writes are synchronous, so we can safely persist pending
  // changes during pagehide / visibilitychange. This prevents a quick
  // reload (within the 400 ms debounce) from losing the most recent edit
  // (e.g. a freshly-applied smart layout).
  const flushSync = (leaving: boolean): void => {
    if (_suspended || presenting()) return
    const activeId = documents.getActiveId()
    if (!activeId) return
    const meta = documents.listDocuments().find(d => d.id === activeId)
    // A folder: what is not written yet is kept for the next visit, and
    // written now when the page goes, also while an agent writes the folder
    // (Studio held its saves until it pauses, and a reload lost them). The
    // write merges with the agent's edits; it may not land before the page
    // is gone, the kept edits do.
    if (meta?.source === 'md') {
      if (!_unsaved) return
      if (_persistTimer !== null) clearTimeout(_persistTimer)
      _persistTimer = null
      keepEdits(activeId)
      void flushPersist(leaving)
      return
    }
    if (_persistTimer === null) return // nothing pending
    clearTimeout(_persistTimer)
    _persistTimer = null
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
      // The page is going away: no dialog, just the console.
      documents.saveDocument(activeId, data).catch((e) => reportSaveError(e, false))
    } catch (e) {
      console.warn('[diagramStore] sync flush failed:', e)
    }
  }
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', () => flushSync(true))
    window.addEventListener('beforeunload', () => flushSync(true))
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushSync(false)
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
      // A file that could not be read is read again, now that it changed:
      // until a read succeeds nothing is saved to it.
      const activeId = documents.getActiveId()
      if (activeId && documents.isUnreadable(activeId)) {
        loadActive(activeId, 'fs')
        return
      }
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
