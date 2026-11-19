// ─── Hash-based deep-link routing ────────────────────────────────────────────
//
// The app is a static SPA (`base: './'`) that runs under `file://` (Electron),
// GitHub Pages, or any host, so path-based routing would need server rewrites.
// Hash routing (`#/...`) works everywhere with zero config and no extra
// dependency, so we keep a tiny custom router that mirrors the relevant slice
// of app state into `location.hash` and back.
//
// URL grammar (segments are key/value pairs, each value URI-encoded):
//
//   #/m/<mode>/v/<viewId>[/i/<tab>][/tr/<traceId>][/f/<focusId>][/e/<elementId>][/s/<snapshotId>]
//   #/d/<docId>/m/<mode>/v/<viewId>...[/p/<presId>/play/1/sl/<n>]
//
//   <mode>    designer | viewer | presenter | metamodel   (default: designer;
//             `inspector`, the perspective the Inspector was, opens Viewer
//             with the Inspector on the tab `t` names)
//
// Without a route Studio starts in Viewer: most openings are to look at a
// model, and Viewer cannot change it. A model the user has just created is
// there to be edited, so it starts in Designer (openInDesigner).
//   <viewId>  a view id, or `canvas` for the default Canvas (activeViewId null)
//   <tab>     the Inspector's tab, while it is open in place of the view:
//             overview | model | implementation | branch. A route without
//             it shows the view: the Inspector is a place, as a view is.
//   <traceId> the element whose verification path the Inspector shows
//   <focusId> a Wiki element node id (only applied for wiki views)
//   <elementId> the selected element
//   <docId>   `ls:<id>` (a model in this app's list: browser storage or a
//             browser folder), `fs:<absolutePath>` (a .radical file) or
//             `md:<absolutePath>` (a Markdown folder); paths only where the
//             host reads the disk (desktop). Machine-local identity; when
//             omitted or unresolvable we keep the currently-active document.
//   <snapshotId>  active milestone (`s`). Restores that milestone's frozen model.
//   <presId>/play/1/sl/<n>  presentation playback: which presentation (`p`), the
//             `play` flag, and the 0-based slide index (`sl`). Only present while
//             a presentation is actually running.
//
// The route names the place on screen in one form (segments in this order),
// and every change of place pushes it onto the window's history, so Back and
// Forward walk the places (navHistory.ts names them for the toolbar).

import { useEffect } from 'react'
import { create } from 'zustand'
import { isExplorationId, useDiagramStore, viewById } from '@radical/ui/store/diagramStore'
import { documents, useDocumentsStore } from './store/documentStore'
import { loadingDocumentId, onDocumentLoaded } from './persistence/autosave'
import { host } from './platform/host'
import { inspectorTabOf, useInspectorNav, usePlaceHold, type InspectorTab } from './navigation'
import { openCheckSettings } from './components/inspector/checkSettingsOpen'
import { useBranchStore } from './persistence/branchChanges'
import { inspectorMayShow, useInspectorStore } from './persistence/inspector'
import { pushEntry, replaceEntry, moveTo, restoreNav, saveNav, stepIndex, useNavHistory, type NavEntry } from './navHistory'

/** The view token of All elements, the table of the whole model. Links
 *  written while it was a canvas say `canvas`, and still open it. */
export const ALL_ELEMENTS = 'all'
const isAllElements = (view: string): boolean => view === ALL_ELEMENTS || view === 'canvas'

type Mode = 'designer' | 'viewer' | 'presenter' | 'metamodel'
const MODES: readonly Mode[] = ['designer', 'viewer', 'presenter', 'metamodel'] as const

export interface Route {
  /** `ls:<id>`, `fs:<absolutePath>` or `md:<absolutePath>`; undefined = keep active document. */
  doc?: string
  mode: Mode
  /** view id, or `canvas` for the default Canvas. */
  view: string
  /** The Inspector's tab: it is open on it, in place of the view. Undefined: the view. */
  panel?: InspectorTab
  /** The element whose verification path the Inspector shows (with `panel` only). */
  trace?: string
  /** A link to the Inspector's Settings tab of before: Inspector settings… opens. */
  checkSettings?: boolean
  /** wiki element node id (only meaningful for wiki views). */
  focus?: string
  /** The selected element. */
  el?: string
  /** active milestone (snapshot) id. */
  snap?: string
  /** active presentation id (only when playing). */
  pres?: string
  /** whether a presentation is currently playing. */
  play?: boolean
  /** 0-based presentation slide index (only when playing). */
  slide?: number
}

// Guards the state↔URL feedback loop: while we are applying a route to the
// store we must not echo those mutations straight back into the URL.
let applying = false

// A route that waits for its document: a file or folder loads after the first
// paint, and loading resets the view, milestone and slide, so the route is
// applied once the load has landed. A browser folder that lost its access
// keeps waiting until Reconnect loads it. While a route waits, the URL keeps it.
let pending: { route: Route; docId: string } | null = null

/** The perspective Studio starts in without a route. */
let startMode: Mode = 'viewer'

/** The document whose Inspector panel a route opened (a link, Back, a
 *  reload), until it is known whether the Inspector has anything for it. */
let inspectorByRoute: string | null = null

/** For a model the user has just created: Designer, now and when the route
 *  sync starts (the web welcome screen holds it back until a model is picked). */
export function openInDesigner(): void {
  startMode = 'designer'
  usePendingMode.setState({ mode: null })
  if (useDiagramStore.getState().appMode !== 'designer') useDiagramStore.getState().setAppMode('designer')
}

/** The perspective a link asks for while its document still loads, so the
 *  app shows that one from its first paint, not Designer's canvas for a
 *  moment (the store switches only once the route is applied). Read from
 *  the address when the module loads, before the first render. */
export const usePendingMode = create<{ mode: Mode | null }>(() => ({
  // Without a route, Viewer from the first paint (startRouteSync switches to it).
  mode: typeof window !== 'undefined' && window.location ? parseHash(window.location.hash)?.mode ?? 'viewer' : null,
}))

/** The perspective to draw: the one a pending link asks for, else the store's. */
export function useShownMode(): Mode {
  const pendingMode = usePendingMode((s) => s.mode)
  const appMode = useDiagramStore((s) => s.appMode)
  return pendingMode ?? appMode
}

/** The user picked a perspective: a link still waiting gives way to it. */
export function dropPendingMode(): void {
  usePendingMode.setState({ mode: null })
}

// ─── Parse / format ──────────────────────────────────────────────────────────

export function parseHash(hash: string): Route | null {
  const raw = hash.replace(/^#\/?/, '')
  if (!raw) return null
  const parts = raw.split('/').filter(Boolean)
  const map: Record<string, string> = {}
  for (let i = 0; i + 1 < parts.length; i += 2) {
    try {
      map[parts[i]] = decodeURIComponent(parts[i + 1])
    } catch {
      map[parts[i]] = parts[i + 1]
    }
  }
  if (map.m === undefined && map.v === undefined && map.d === undefined) return null
  // The Inspector was a perspective: its links open Viewer with the panel.
  const legacy = map.m === 'inspector'
  const mode = legacy ? 'viewer' : (MODES as readonly string[]).includes(map.m) ? (map.m as Mode) : 'designer'
  const panel = legacy ? inspectorTabOf(map.t) ?? 'overview' : inspectorTabOf(map.i)
  const slide = map.sl !== undefined && /^\d+$/.test(map.sl) ? Number(map.sl) : undefined
  return {
    doc: map.d || undefined,
    mode,
    view: map.v && !isAllElements(map.v) ? map.v : ALL_ELEMENTS,
    ...(panel ? { panel } : {}),
    ...(panel && map.tr ? { trace: map.tr } : {}),
    ...(legacy && map.t === 'settings' ? { checkSettings: true } : {}),
    focus: map.f || undefined,
    // The Inspector's This branch named the element whose card was open.
    el: legacy && map.t !== 'changes' && map.t !== 'branch' ? undefined : map.e || undefined,
    snap: map.s || undefined,
    pres: map.p || undefined,
    play: map.play === '1' || undefined,
    slide,
  }
}

export function formatRoute(r: Route): string {
  const segs: string[] = []
  if (r.doc) segs.push('d', encodeURIComponent(r.doc))
  segs.push('m', encodeURIComponent(r.mode))
  segs.push('v', encodeURIComponent(r.view))
  if (r.panel) segs.push('i', encodeURIComponent(r.panel))
  if (r.panel && r.trace) segs.push('tr', encodeURIComponent(r.trace))
  if (r.focus && !isAllElements(r.view)) segs.push('f', encodeURIComponent(r.focus))
  if (r.el) segs.push('e', encodeURIComponent(r.el))
  if (r.snap) segs.push('s', encodeURIComponent(r.snap))
  if (r.play && r.pres) {
    segs.push('p', encodeURIComponent(r.pres), 'play', '1')
    if (typeof r.slide === 'number') segs.push('sl', String(r.slide))
  }
  return '#/' + segs.join('/')
}

// ─── Current state → Route ───────────────────────────────────────────────────

function currentDocToken(): string | undefined {
  const id = documents.getActiveId()
  if (!id) return undefined
  const meta = documents.listDocuments().find((d) => d.id === id)
  if (!meta) return undefined
  if (meta.source === 'fs' && meta.filePath) return 'fs:' + meta.filePath
  if (meta.source === 'md' && meta.folderPath) return 'md:' + meta.folderPath
  return 'ls:' + meta.id
}

export function currentRoute(): Route {
  const s = useDiagramStore.getState()
  let focus: string | undefined
  if (s.activeViewId) {
    const v = s.views[s.activeViewId]
    // A slide of a wiki view shows its own page over the view's.
    const page = s.slideWikiPage?.viewId === s.activeViewId ? s.slideWikiPage.focusId : v?.wikiFocusId
    if (v && v.kind === 'wiki' && page) focus = page
  }
  const playing = s.presentationActive
  const nav = useInspectorNav.getState()
  // The panel is part of the place while it is on screen.
  const panel = inspectorPanelShown() ? inspectorTabShown() : undefined
  return {
    doc: currentDocToken(),
    mode: s.appMode,
    view: s.activeViewId ?? ALL_ELEMENTS,
    ...(panel ? { panel } : {}),
    ...(panel && nav.trace ? { trace: nav.trace } : {}),
    focus,
    el: s.selectedNodeId ?? undefined,
    snap: s.activeSnapshotId ?? undefined,
    pres: playing ? (s.activePresentationId ?? undefined) : undefined,
    play: playing || undefined,
    slide: playing ? s.presentationSlideIndex : undefined,
  }
}

/** The Inspector's tab on screen: the one picked, else its first, Overview. */
export function inspectorTabShown(): InspectorTab {
  return useInspectorNav.getState().tab ?? 'overview'
}

/** Whether the Inspector panel is on screen: open, in a perspective that
 *  shows it (not the metamodel editor, nor a presentation played), with
 *  something to show (inspectorAvailable). */
export function inspectorPanelShown(): boolean {
  const s = useDiagramStore.getState()
  return useInspectorNav.getState().open && s.appMode !== 'metamodel' && !s.presentationActive && inspectorMayShow()
}

// ─── Route → state ───────────────────────────────────────────────────────────

function withApplying(fn: () => void): void {
  applying = true
  try {
    fn()
  } finally {
    // Reset after the synchronous subscriber fan-out so store-driven URL
    // writes triggered by these mutations are skipped, but later (async)
    // changes still propagate to the URL.
    queueMicrotask(() => {
      applying = false
    })
  }
}

/** Switch the active document if `doc` resolves to a different one.
 *  Returns true when a switch was initiated (model load is async). */
function resolveDoc(doc: string): boolean {
  const activeId = documents.getActiveId()
  if (doc.startsWith('ls:')) {
    const id = doc.slice(3)
    if (id && id !== activeId && documents.listDocuments().some((d) => d.id === id)) {
      documents.setActiveId(id)
      return true
    }
  } else if (doc.startsWith('fs:') || doc.startsWith('md:')) {
    // Paths only resolve where the host reads the disk (desktop); create*
    // de-dupes by path.
    const path = doc.slice(3)
    const h = host()
    const meta = !path ? null
      : doc.startsWith('fs:') ? (h.readFile ? documents.createFSDocument(path) : null)
      : (h.readFolder ? documents.createMdDocument(path) : null)
    if (meta && meta.id !== activeId) {
      documents.setActiveId(meta.id)
      return true
    }
  }
  return false
}

function applyViewModeFocus(route: Route): void {
  dropPendingMode()
  withApplying(() => {
    const store = useDiagramStore.getState()
    if ((MODES as readonly string[]).includes(route.mode) && store.appMode !== route.mode) {
      store.setAppMode(route.mode)
    }
    inspectorByRoute = route.panel ? documents.getActiveId() : null
    // Resolve the target view. A view id that doesn't exist in the current
    // document (e.g. a link opened on a machine whose localStorage doesn't
    // hold that doc, so we fell back to the freshly-seeded sample) degrades
    // gracefully to All elements rather than leaving a dangling id.
    const reqView = isAllElements(route.view) ? null : route.view
    // The exploration open too (Back to it); one closed since is gone.
    const targetView = reqView && viewById(useDiagramStore.getState(), reqView) ? reqView : null
    if (useDiagramStore.getState().activeViewId !== targetView) {
      useDiagramStore.getState().setActiveView(targetView)
    }
    // A wiki's page is the route's focus; a route with none is the
    // Overview (Back from the first page read leads there).
    if (targetView) {
      const v = useDiagramStore.getState().views[targetView]
      const page = route.focus ?? null
      if (v && v.kind === 'wiki' && (v.wikiFocusId ?? null) !== page) {
        useDiagramStore.getState().setWikiFocus(targetView, page)
      }
    }
    // Milestone (snapshot). View it with selectMilestone, which parks the
    // live model in liveBackup so autosave keeps saving it; restoreSnapshot
    // would replace it. A route with none (Back from a milestone) leaves
    // the one shown, as Current (live) does; with unsaved edits it asks
    // first, as picking another milestone does (discarding them unasked
    // would lose them). Back used to keep the milestone, and the address
    // written then put it into the entry Back had gone to.
    if (route.snap) {
      const s = useDiagramStore.getState()
      if (s.activeSnapshotId !== route.snap && s.snapshots.some((sn) => sn.id === route.snap)) {
        s.selectMilestone(route.snap)
      }
    } else if (!route.play) {
      const s = useDiagramStore.getState()
      if (s.activeSnapshotId) {
        if (s.milestoneDirty && s.appMode === 'designer') useDiagramStore.setState({ milestonePromptOpen: true })
        else s.discardMilestoneChanges()
      }
    }
    // The Inspector panel's tab and path, when the route names it (one that
    // does not leaves it open or closed as it is), and the selection.
    // The Inspector is a place, as a view is: open on the tab the route
    // names, or closed for the view (Back from it, or from a path a card
    // opened, gives the view back).
    if (route.panel) useInspectorNav.setState({ open: true, tab: route.panel, trace: route.trace ?? null })
    else if (useInspectorNav.getState().open || useInspectorNav.getState().trace) useInspectorNav.setState({ open: false, trace: null })
    const s = useDiagramStore.getState()
    const el = route.el && s.c4Nodes[route.el] ? route.el : null
    if (s.selectedNodeId !== el || (el === null && s.selectedNodeIds.length)) {
      s.setSelectedNodeIds(el ? [el] : [])
      s.selectNode(el)
    }
  })
  if (route.checkSettings) openCheckSettings()
  applyPresentation(route)
}

/** Drive presentation playback from the URL. Kept outside `withApplying`
 *  because `startPresentation` finishes asynchronously (it re-applies the
 *  current slide on a timer), so we re-assert the target slide just after. */
function applyPresentation(route: Route): void {
  const st = useDiagramStore.getState()
  if (route.play && route.pres && st.presentations.some((p) => p.id === route.pres)) {
    if (st.activePresentationId !== route.pres) st.setActivePresentation(route.pres)
    if (!useDiagramStore.getState().presentationActive) useDiagramStore.getState().startPresentation()
    if (typeof route.slide === 'number') {
      const target = route.slide
      // After startPresentation's internal goToSlide(currentIndex) timer (~50ms).
      setTimeout(() => {
        if (useDiagramStore.getState().presentationActive) {
          useDiagramStore.getState().goToSlide(target)
        }
      }, 140)
    }
  } else if (!route.play && st.presentationActive) {
    st.stopPresentation()
  }
}

export function applyRoute(route: Route): void {
  pending = null
  const switched = route.doc ? resolveDoc(route.doc) : false
  const activeId = documents.getActiveId()
  if (activeId && (switched || loadingDocumentId() === activeId || documents.awaitsReconnect(activeId))) {
    pending = { route, docId: activeId }
    usePendingMode.setState({ mode: route.mode })
    return
  }
  applyViewModeFocus(route)
}

// ─── State → URL ─────────────────────────────────────────────────────────────

const MODE_NAMES: Record<Mode, string> = { designer: 'Designer', viewer: 'Viewer', presenter: 'Presentations', metamodel: 'Metamodel' }

/** What the History list says of a route: where, in which perspective, on what. */
export function describeRoute(route: Route, hash = formatRoute(route), at = Date.now()): NavEntry {
  const s = useDiagramStore.getState()
  // The exploration too, by its name ("Explore: API"), not its id.
  const view = isAllElements(route.view) ? 'All elements' : viewById(s, route.view)?.name ?? route.view
  const where = route.mode === 'metamodel' ? 'Metamodel' : route.trace ? `${view} › Verification path` : view
  const id = route.trace ?? route.el ?? route.focus
  const node = id ? s.c4Nodes[id] : undefined
  const def = node ? s.metamodel?.nodeTypes[node.type] : undefined
  return { hash, where, mode: MODE_NAMES[route.mode], ...(node ? { element: { label: node.label, type: def?.label ?? node.type, color: def?.color } } : {}), at }
}

/** Whether the place of a History entry is gone: an exploration closed
 *  since (it is never saved, and one Back led to opened All elements, a
 *  place never visited). Back and Forward pass over it. */
/** Whether the step the changes within one window make adds an entry to
 *  the history: as soon as one of them is no route applied (a person's
 *  move, not Back, Forward, a link or a document that loaded), the step
 *  does, whatever Studio wrote in place in the same moment. */
export const stepAddsEntry = (soFar: boolean, replace: boolean): boolean => soFar || !replace

export function placeGone(entry: NavEntry): boolean {
  const route = parseHash(entry.hash)
  return !!route && isExplorationId(route.view) && !viewById(useDiagramStore.getState(), route.view)
}

/** The index the history entry on screen carries, if it is one of ours. */
const stateIndex = (state: unknown): number | undefined =>
  state && typeof (state as { navIndex?: unknown }).navIndex === 'number' ? (state as { navIndex: number }).navIndex : undefined

/** Writes the route of the place on screen: a new history entry when the
 *  place changed (`push`), else in place of the current one. */
function writeUrl(push: boolean): void {
  const route = currentRoute()
  const hash = formatRoute(route)
  const current = '#/' + location.hash.replace(/^#\/?/, '')
  const nav = useNavHistory.getState()
  if (current === hash) {
    // The same place: keep the list's label up to date (a renamed view).
    if (nav.entries.length) useNavHistory.setState(replaceEntry(nav, describeRoute(route, hash)))
    // An entry the browser made for an address opened from outside (a link,
    // one typed) carries no index of ours: Back to it moved the list
    // nowhere, and the place Back led to was written over the one left.
    if (stateIndex(history.state) !== useNavHistory.getState().index) history.replaceState({ navIndex: useNavHistory.getState().index }, '', hash)
    return
  }
  if (push && nav.entries.length) {
    const next = pushEntry(nav, describeRoute(route, hash))
    useNavHistory.setState(next)
    history.pushState({ navIndex: next.index }, '', hash)
  } else {
    const next = replaceEntry(nav, describeRoute(route, hash))
    useNavHistory.setState(next)
    history.replaceState({ navIndex: next.index }, '', hash)
  }
}

// ─── Wiring ──────────────────────────────────────────────────────────────────

export function startRouteSync(): () => void {
  if (typeof window === 'undefined') return () => {}

  const initial = parseHash(location.hash)
  if (initial) applyRoute(initial)
  // No route: the start perspective, through setAppMode so that Viewer
  // parks Designer's model as a switch by hand does.
  else if (useDiagramStore.getState().appMode !== startMode) useDiagramStore.getState().setAppMode(startMode)
  // The history starts at the place opened: one entry, ours. A link still
  // waiting for its document keeps its address until it is applied.
  // After a reload the window's history is still there, and the list kept
  // in sessionStorage with it.
  const start = currentRoute()
  const startHash = initial ? '#/' + location.hash.replace(/^#\/?/, '') : formatRoute(start)
  const restored = restoreNav(startHash, stateIndex(history.state))
  useNavHistory.setState(restored ?? { entries: [describeRoute(start, startHash)], index: 0 })
  history.replaceState({ navIndex: useNavHistory.getState().index }, '', startHash)
  const unsubNav = useNavHistory.subscribe((state) => saveNav(state))
  saveNav(useNavHistory.getState())
  // A route applied at once, or none: nothing waits.
  if (!pending) dropPendingMode()

  let timer: ReturnType<typeof setTimeout> | null = null
  // Changes that apply a route (Back, Forward, a link, a document that has
  // loaded) write it in place; any other change of place adds an entry.
  // Changes within 150 ms are one step, which adds an entry when any of
  // them does (stepAddsEntry): a person's move is never written in place
  // because Studio wrote a route of its own in the same moment (the
  // Inspector's panel following its evidence took a Path step away from
  // Back).
  let pushNext = false
  const schedule = (replace = false): void => {
    if (applying || pending) return
    pushNext = stepAddsEntry(pushNext, replace)
    if (timer) clearTimeout(timer)
    timer = null
    // A move held (usePlaceHold) is written once it is let go.
    if (usePlaceHold.getState().held > 0) return
    timer = setTimeout(() => {
      timer = null
      const push = pushNext
      pushNext = false
      writeUrl(push)
    }, 150)
  }

  const unsubLoad = onDocumentLoaded((id) => {
    if (!pending) return
    // Another document was opened meanwhile: the route no longer applies.
    if (id !== pending.docId) {
      pending = null
      dropPendingMode()
      schedule(true)
      return
    }
    if (documents.awaitsReconnect(id)) return
    const { route } = pending
    pending = null
    applyViewModeFocus(route)
    // A view or slide the document doesn't have fell back; show what did open.
    queueMicrotask(() => schedule(true))
  })

  // Places being passed over (placeGone) on the way back or forward: their
  // addresses come and go without being applied.
  let passing = 0
  const onHash = (e: HashChangeEvent): void => {
    if (applying) return
    // The address that was asked for is read from the event, not from the
    // location: a write of ours that was due just before this event has by
    // now put the old state back there, and the link would be lost.
    const asked = e.newURL ? new URL(e.newURL).hash : location.hash
    const r = parseHash(asked)
    if (!r) return
    if (passing > 0 && placeGone({ hash: asked, where: '', mode: '', at: 0 })) {
      passing--
      return
    }
    passing = 0
    applyRoute(r)
    // Should such a write have overwritten the address, write what was
    // applied (after `applying` is reset; a no-op when the two agree).
    queueMicrotask(() => schedule(true))
  }
  window.addEventListener('hashchange', onHash)

  // Back or forward (Studio's buttons, the keys, the browser's): the list
  // follows the entry the history landed on; hashchange applies its route.
  const onPop = (e: PopStateEvent): void => {
    const index = stateIndex(e.state)
    if (index === undefined) return
    const from = useNavHistory.getState().index
    useNavHistory.setState(moveTo(useNavHistory.getState(), index))
    // Landed on a place that is gone (the browser's own Back, say): on in
    // the same direction to the next place that is not, when there is one.
    const nav = useNavHistory.getState()
    const entry = nav.entries[index]
    if (index === from || !entry || !placeGone(entry)) return
    const next = stepIndex(nav, index < from ? -1 : 1, placeGone)
    if (next === undefined) return
    passing++
    history.go(next - index)
  }
  window.addEventListener('popstate', onPop)

  const unsubDiagram = useDiagramStore.subscribe((s, p) => {
    if (
      s.appMode !== p.appMode ||
      s.activeViewId !== p.activeViewId ||
      s.selectedNodeId !== p.selectedNodeId ||
      s.views !== p.views ||
      s.slideWikiPage !== p.slideWikiPage ||
      s.activeSnapshotId !== p.activeSnapshotId ||
      s.presentationActive !== p.presentationActive ||
      s.presentationSlideIndex !== p.presentationSlideIndex ||
      s.activePresentationId !== p.activePresentationId
    ) {
      schedule()
    }
  })
  const unsubDocs = useDocumentsStore.subscribe(() => schedule())
  // The panel's tab, and its opening and closing, are written in place: no
  // Back step of their own. A verification path is a place to go back from.
  // The Inspector opened or closed, its tab and its path are places, as a
  // view is: each is a step of Back.
  const unsubInspector = useInspectorNav.subscribe((s, p) => {
    // Opened or closed while a link still waits for its document: the user's
    // move wins, as a perspective picked does (dropPendingMode).
    if (pending && !applying && (s.open !== p.open || s.tab !== p.tab || s.trace !== p.trace)) {
      const { panel: _panel, trace: _trace, ...rest } = pending.route
      pending = { ...pending, route: s.open ? { ...rest, panel: s.tab ?? 'overview', ...(s.trace ? { trace: s.trace } : {}) } : rest }
    }
    if (s.trace !== p.trace || s.open !== p.open || s.tab !== p.tab) schedule()
    // A route back to the panel of a model already looked at.
    if (s.open && !p.open) queueMicrotask(() => leaveEmptyInspector())
  })
  const unsubHold = usePlaceHold.subscribe((h, p) => {
    // The place left is written first, if it waits: it is where Back goes.
    if (h.held > 0 && p.held === 0 && timer) {
      clearTimeout(timer)
      timer = null
      const push = pushNext
      pushNext = false
      writeUrl(push)
    }
    if (h.held === 0 && p.held > 0) schedule()
  })

  // The Inspector's button is greyed out while the model has no test report
  // and no base beside it. A route to its panel then closes it, written over
  // the address, once both have been looked for.
  function leaveEmptyInspector(): void {
    const id = documents.getActiveId()
    if (!inspectorByRoute) return
    if (inspectorByRoute !== id || !useInspectorNav.getState().open) { inspectorByRoute = null; return }
    const { check, results, measurements } = useInspectorStore.getState()
    const { readFor, base } = useBranchStore.getState()
    if (!check || readFor !== id) return
    inspectorByRoute = null
    if (results || measurements || base) return
    useInspectorNav.setState({ open: false, trace: null })
    schedule(true)
  }
  // The panel comes and goes with what it has to show: the address follows.
  let panelShown = inspectorPanelShown()
  const onEvidence = (): void => {
    leaveEmptyInspector()
    if (inspectorPanelShown() !== panelShown) { panelShown = !panelShown; schedule(true) }
  }
  const unsubCheck = useInspectorStore.subscribe(onEvidence)
  const unsubBase = useBranchStore.subscribe(onEvidence)

  return () => {
    window.removeEventListener('hashchange', onHash)
    window.removeEventListener('popstate', onPop)
    unsubInspector()
    unsubHold()
    unsubCheck()
    unsubBase()
    unsubNav()
    unsubLoad()
    pending = null
    dropPendingMode()
    unsubDiagram()
    unsubDocs()
    if (timer) clearTimeout(timer)
  }
}

/** React hook: mount the hash↔state sync.
 *
 *  `active` gates the whole sync. While the web welcome splash is showing the
 *  user hasn't chosen anything yet, so we neither read nor write the hash —
 *  that's why a clean URL stays clean until a model is picked. A deep link
 *  bypasses the splash (App sets active from the start), so sync runs at once
 *  and applies the incoming route. */
export function useRouteSync(active = true): void {
  useEffect(() => {
    if (!active) return
    return startRouteSync()
  }, [active])
}
