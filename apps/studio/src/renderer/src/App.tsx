import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { host } from './platform/host'
import { Toolbar } from './components/Toolbar'
import { Canvas } from '@radical/ui/components/Canvas'
import { LargeCanvasNotice, useOversizedCanvas } from '@radical/ui/components/LargeCanvasNotice'
import { TreemapView } from './components/TreemapView'
import { SequenceView } from './components/SequenceView'
import { TableView } from '@radical/ui/components/TableView'
import { WarnierView } from '@radical/ui/components/WarnierView'
import { MatrixView } from './components/MatrixView'
import { WikiView } from '@radical/ui/components/WikiView'
import { PresentationBar, PresenterDock } from './components/PresentationBar'
import { RightPanel, LeftPanel, ActivityRail } from '@radical/ui/components/RightPanel'
import { MetamodelEditor } from './components/MetamodelEditor'
import { InspectorMain, InspectorSection } from './components/Inspector'
import { CheckSettingsDialog } from './components/CheckSettingsDialog'
import { toggleInspector, useInspectorNav } from './navigation'
import { setLeftCollapsed, toggleLeftPanel, useLeftPanelFold } from './leftPanelFold'
import { NotificationHost } from '@radical/ui/components/NotificationHost'
import { MilestoneChip } from '@radical/ui/components/MilestoneChip'
import { OtherModelViewBar } from '@radical/ui/components/OtherModelViewBar'
import { NodeWizard } from '@radical/ui/components/NodeWizard'
import { setCanvasCovered } from '@radical/ui/components/keysHere'
import { SelectionActionBar } from '@radical/ui/components/SelectionActions'
import { QuickSearch } from './components/QuickSearch'
import { FindInView } from './components/FindInView'
import { useRegisterCommands } from './commands'
import { WelcomeScreen } from './components/WelcomeScreen'
import { SetupWizard, OPEN_SETUP_EVENT } from './components/SetupWizard'
import { firstStart } from './firstStart'
import { useApplyTheme } from './theme'
import { MilestoneEditOverlay } from './components/MilestoneEditOverlay'
import { otherModelViewShown, useDiagramStore } from '@radical/ui/store/diagramStore'
import { useRouteSync, useShownMode, parseHash } from './route'
import { useDocumentsStore } from './store/documentStore'
import { DiscussionPanel, type DiscussionTarget } from './components/DiscussionPanel'
import { webFolderSupported } from './persist/webFolder'
import { useNodeDiscussions } from './discussions/useNodeDiscussions'
import { OPEN_HUB_EVENT, useInspectorMayShow } from './persistence/inspector'
import { closePresentations, usePresentationsFrom } from './presentationsPlace'


/** The Hub's packs a link asks to import (`?hub=id1,id2`, its Open in
 *  Studio). The link stays in the address until its import opens, so a
 *  reload of the Welcome screen still has the packs wait (doneWithHubLink). */
let hubLinkIds: string[] | null | undefined
function takeHubLink(): string[] | null {
  if (hubLinkIds !== undefined) return hubLinkIds
  const ids = (new URLSearchParams(window.location.search).get('hub') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  hubLinkIds = ids.length ? ids : null
  return hubLinkIds
}

/** The link's import has opened: out of the address, so a reload does not
 *  ask again. */
function doneWithHubLink(): void {
  const params = new URLSearchParams(window.location.search)
  params.delete('hub')
  const search = params.toString()
  window.history.replaceState(window.history.state, '', window.location.pathname + (search ? `?${search}` : '') + window.location.hash)
}

function AppInner(): React.ReactElement {
  useApplyTheme()
  const activeDocument = useDocumentsStore((s) => s.docs.find((d) => d.id === s.activeId))
  const h = host()
  const discussionDocumentId = activeDocument?.source === 'md' && (
    (h.kind === 'electron' && h.loadDiscussions && h.actOnDiscussion && activeDocument.folderPath)
    || (h.kind === 'web' && webFolderSupported())
  ) ? activeDocument.id : undefined
  const [discussionTarget, setDiscussionTarget] = useState<DiscussionTarget | null>(null)
  const openDiscussion = useCallback((nodeId: string) => {
    const node = useDiagramStore.getState().c4Nodes[nodeId]
    if (discussionDocumentId && node) setDiscussionTarget({ documentId: discussionDocumentId, nodeId, label: node.label })
  }, [discussionDocumentId])
  const closeDiscussion = useCallback(() => {
    setDiscussionTarget((target) => {
      if (target) {
        const id = CSS.escape(target.nodeId)
        const element = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"], tr[data-node-id="${id}"], [data-wiki-node-id="${id}"]`)
          ?? document.querySelector<HTMLElement>('.wiki-page')
        element?.focus({ preventScroll: true })
      }
      return null
    })
  }, [])
  const runRadicalLayout = useDiagramStore((s) => s.runRadicalLayout)
  // A link still waiting for its document is drawn in its own perspective.
  const appMode = useShownMode()
  const presentationActive = useDiagramStore((s) => s.presentationActive)
  // All elements (no active view) is the whole model as a table.
  const activeViewKind = useDiagramStore((s) =>
    s.activeViewId ? (s.views[s.activeViewId]?.kind ?? 'static') : 'table'
  )
  const isTreemapView  = activeViewKind === 'treemap'
  const isSequenceView = activeViewKind === 'dynamic'
  const isTableView    = activeViewKind === 'table'
  const isMatrixView   = activeViewKind === 'matrix'
  const isWikiView     = activeViewKind === 'wiki'
  const isWarnierView  = activeViewKind === 'warnier'
  const isCanvasView   = !isTreemapView && !isSequenceView && !isTableView && !isMatrixView && !isWikiView && !isWarnierView
  // A canvas with more elements than a canvas draws says so instead.
  const oversized = useOversizedCanvas()

  const isPresenting = presentationActive
  const nodeDiscussions = useNodeDiscussions(isPresenting ? undefined : discussionDocumentId)
  const isDesigner = appMode === 'designer'
  const isViewer = appMode === 'viewer'
  const isPresenter = appMode === 'presenter'
  const isMetamodel = appMode === 'metamodel'
  const isReadOnlyMode = !isDesigner && !isMetamodel
  // The Inspector, a place of the rail as the Views section is: its tabs
  // in the left panel and the tab picked in place of the view, in Designer,
  // Viewer and Presenter, while it is open and has something to show.
  const inspectorOpen = useInspectorNav((s) => s.open)
  const inspectorHas = useInspectorMayShow()
  const showInspector = inspectorOpen && inspectorHas && !isPresenting && !isMetamodel
  // A click on a section of the rail goes back to the view and shows the section.
  useEffect(() => { setCanvasCovered(showInspector) }, [showInspector])
  // The Presentations place (ADR Presentations are a place of the rail):
  // the slides in the left panel, the slide picked on the canvas.
  const showPresentations = isPresenter && !showInspector && !isPresenting
  // Made in Designer; over Viewer only looked through and played.
  const presentationsReadOnly = usePresentationsFrom((s) => s.from) === 'viewer'
  const inspectorOver = useMemo(() => showPresentations
    ? { open: true, close: closePresentations }
    : { open: showInspector, close: () => toggleInspector(false) }, [showInspector, showPresentations])
  // Another model's view (a federation), of any view type: its bar says
  // whose it is, in a row of its own above the view.
  const otherModelBar = useDiagramStore((s) => !!otherModelViewShown(s)) && !isPresenting && !showInspector && (isDesigner || isViewer)

  const leftCollapsed = useLeftPanelFold((s) => s.collapsed)
  // The welcome screen is a web-only landing splash. Skip it when the user
  // arrived via a deep link (the hash already encodes a destination) so the
  // pasted URL lands straight on its target instead of behind the splash.
  const [showWelcome, setShowWelcome] = useState(() => {
    if (host().kind !== 'web') return false
    return !parseHash(window.location.hash)
  })
  // Only sync the URL once the welcome splash is gone: while it's up the user
  // hasn't chosen a model, so a clean URL must stay clean. A deep link skips
  // the splash (showWelcome starts false), so sync runs immediately.
  useRouteSync(!showWelcome)
  // A Hub link's packs: the import opens over the model, once there is one.
  // Opened at once, it lay under the Welcome screen, where nothing in it
  // could be clicked and Escape closed it unseen; the Welcome screen names
  // the packs that wait instead.
  const [hubLink, setHubLink] = useState(takeHubLink)
  useEffect(() => {
    if (showWelcome || !hubLink) return
    window.dispatchEvent(new CustomEvent(OPEN_HUB_EVENT, { detail: { ids: hubLink } }))
    doneWithHubLink()
    setHubLink(null)
  }, [showWelcome, hubLink])
  // The Setup wizard: over the Welcome screen on the first start, and from
  // Settings → Setup… later.
  const [setupOpen, setSetupOpen] = useState(firstStart)
  const closeSetup = useCallback(() => setSetupOpen(false), [])
  useEffect(() => {
    const open = (): void => setSetupOpen(true)
    window.addEventListener(OPEN_SETUP_EVENT, open)
    return () => window.removeEventListener(OPEN_SETUP_EVENT, open)
  }, [])
  const toggleLeft = toggleLeftPanel
  // Something shown in the left panel (Quick Search's pick of a folder or
  // a sequence) opens it when it is folded away.
  useEffect(() => {
    const show = (): void => setLeftCollapsed(false)
    window.addEventListener('radical:show-left-panel', show)
    return () => window.removeEventListener('radical:show-left-panel', show)
  }, [])
  useRegisterCommands('app', () => [
    { id: 'panel.left', title: leftCollapsed ? 'Show the left panel' : 'Hide the left panel', group: 'Panels', run: toggleLeft, when: () => useDiagramStore.getState().appMode !== 'metamodel' },
  ], [leftCollapsed, toggleLeft])
  // Run Radical layout automatically on first load — but only when nodes have
  // no saved positions yet (all at origin). Skip if positions were loaded from file.
  useEffect(() => {
    const timer = setTimeout(() => {
      const nodes = Object.values(useDiagramStore.getState().c4Nodes)
      const hasPositions = nodes.some(n => (n.x ?? 0) !== 0 || (n.y ?? 0) !== 0)
      if (!hasPositions) runRadicalLayout()
    }, 400)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const layoutClass = [
    'app-layout',
    isPresenting ? 'mode-presenting' : '',
    showInspector ? 'with-inspector' : '',
    !isPresenting && isMetamodel ? 'mode-metamodel' : '',
    !isPresenting && isReadOnlyMode ? 'mode-presentation' : '',
    !isPresenting && leftCollapsed ? 'lp-collapsed' : '',
    otherModelBar ? 'other-model-shown' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={layoutClass}>
      {!isPresenting && <Toolbar />}
      {/* As in VS Code: the left panel's sections and the app's actions
          (the Toolbar puts them there) along the left edge. */}
      {!isPresenting && <ActivityRail sections={isDesigner || isViewer || isPresenter} collapsed={leftCollapsed} onToggleCollapsed={toggleLeft} over={inspectorOver} />}
      {!isPresenting && isDesigner && <LeftPanel mode="designer" collapsed={leftCollapsed} onToggleCollapsed={toggleLeft} place={showInspector ? <InspectorSection /> : undefined} />}
      {!isPresenting && isViewer && <LeftPanel mode="viewer" collapsed={leftCollapsed} onToggleCollapsed={toggleLeft} place={showInspector ? <InspectorSection /> : undefined} />}
      {!isPresenting && isPresenter && <LeftPanel mode="presenter" collapsed={leftCollapsed} onToggleCollapsed={toggleLeft} place={showInspector ? <InspectorSection /> : <PresenterDock readOnly={presentationsReadOnly} />} />}
      {/* The Inspector covers the view, which stays mounted under it: its
          camera and its places stay as they were, and going back is at once. */}
      {showInspector && <InspectorMain />}
      {isTreemapView ? <TreemapView /> : isSequenceView ? <SequenceView /> : isTableView ? <TableView onDiscuss={discussionDocumentId ? openDiscussion : undefined} /> : isMatrixView ? <MatrixView /> : isWikiView ? <WikiView onDiscuss={discussionDocumentId ? openDiscussion : undefined} /> : isWarnierView ? <WarnierView /> : oversized ? <LargeCanvasNotice view={oversized.view} count={oversized.count} readOnly={!isDesigner} /> : <Canvas onDiscuss={discussionDocumentId ? openDiscussion : undefined} nodeDiscussions={nodeDiscussions} />}
      {/* The canvas and the flow view name the milestone in their own
          corner; the other views have it at the bottom left of theirs. */}
      {!isPresenting && !showInspector && !isCanvasView && !isSequenceView && (
        <MilestoneChip style={{ gridArea: 'canvas', justifySelf: 'start', alignSelf: 'end', margin: 10, position: 'relative', zIndex: 7 }} />
      )}
      {/* Another model's view (a federation), of any view type: whose it
          is, read-only, and Copy to this model, above the view and over
          none of its controls. */}
      {otherModelBar && <OtherModelViewBar style={{ gridArea: 'otherbar' }} />}
      {!isPresenting && !showInspector && isDesigner && <RightPanel />}
      {!isPresenting && !showInspector && isViewer && <RightPanel readOnly />}
      <PresentationBar />
      <CheckSettingsDialog />
      {!isPresenting && !showInspector && isCanvasView && <SelectionActionBar />}
      <QuickSearch />
      {!isPresenting && !isMetamodel && !showInspector && <FindInView />}
      {/* The Inspector's Add scenario and Add fitness function start one too
          (from Viewer and Presenter, in Designer). */}
      {isDesigner && <NodeWizard />}
      <NotificationHost />
      <MilestoneEditOverlay />
      {!isPresenting && discussionTarget && discussionTarget.documentId === discussionDocumentId && <DiscussionPanel key={`${discussionTarget.documentId}:${discussionTarget.nodeId}`} target={discussionTarget} onClose={closeDiscussion} />}
      {isMetamodel && !isPresenting && <MetamodelEditor />}
      {showWelcome && <WelcomeScreen onDismiss={() => setShowWelcome(false)} hubWaits={hubLink} />}
      <SetupWizard open={setupOpen} onClose={closeSetup} />
    </div>
  )
}

export default function App(): React.ReactElement {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  )
}
