import React, { useEffect, useState, useCallback } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { host } from './platform/host'
import { Toolbar } from './components/Toolbar'
import { Canvas } from '@radical/ui/components/Canvas'
import { TreemapView } from './components/TreemapView'
import { SequenceView } from './components/SequenceView'
import { TableView } from '@radical/ui/components/TableView'
import { WarnierView } from '@radical/ui/components/WarnierView'
import { MatrixView } from './components/MatrixView'
import { WikiView } from '@radical/ui/components/WikiView'
import { PresentationBar, PresenterDock } from './components/PresentationBar'
import { RightPanel, LeftPanel, ActivityRail } from '@radical/ui/components/RightPanel'
import { MetamodelEditor } from './components/MetamodelEditor'
import { Inspector } from './components/Inspector'
import { NotificationHost } from '@radical/ui/components/NotificationHost'
import { MilestoneChip } from '@radical/ui/components/MilestoneChip'
import { NodeWizard } from '@radical/ui/components/NodeWizard'
import { SelectionActionBar } from '@radical/ui/components/SelectionActions'
import { QuickSearch } from './components/QuickSearch'
import { WelcomeScreen } from './components/WelcomeScreen'
import { MilestoneEditOverlay } from './components/MilestoneEditOverlay'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { useRouteSync, useShownMode, parseHash } from './route'

const LS_LEFT = 'radical-leftpanel-collapsed'

function AppInner(): React.ReactElement {
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

  const isPresenting = presentationActive
  const isDesigner = appMode === 'designer'
  const isViewer = appMode === 'viewer'
  const isPresenter = appMode === 'presenter'
  const isMetamodel = appMode === 'metamodel'
  const isInspector = appMode === 'inspector'
  const isReadOnlyMode = !isDesigner && !isMetamodel && !isInspector

  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => localStorage.getItem(LS_LEFT) === '1')
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
  const toggleLeft = useCallback(() => {
    setLeftCollapsed((c) => { localStorage.setItem(LS_LEFT, c ? '0' : '1'); return !c })
  }, [])
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
    !isPresenting && isInspector ? 'mode-inspector' : '',
    !isPresenting && isReadOnlyMode ? 'mode-presentation' : '',
    !isPresenting && leftCollapsed ? 'lp-collapsed' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={layoutClass}>
      {!isPresenting && <Toolbar />}
      {/* As in VS Code: the left panel's sections and the app's actions
          (the Toolbar puts them there) along the left edge. */}
      {!isPresenting && <ActivityRail sections={isDesigner || isViewer || isPresenter} collapsed={leftCollapsed} onToggleCollapsed={toggleLeft} />}
      {!isPresenting && isDesigner && <LeftPanel mode="designer" collapsed={leftCollapsed} onToggleCollapsed={toggleLeft} />}
      {!isPresenting && isViewer && <LeftPanel mode="viewer" collapsed={leftCollapsed} onToggleCollapsed={toggleLeft} />}
      {!isPresenting && isPresenter && <LeftPanel mode="presenter" collapsed={leftCollapsed} onToggleCollapsed={toggleLeft} />}
      {isInspector && !isPresenting ? <Inspector /> : isTreemapView ? <TreemapView /> : isSequenceView ? <SequenceView /> : isTableView ? <TableView /> : isMatrixView ? <MatrixView /> : isWikiView ? <WikiView /> : isWarnierView ? <WarnierView /> : <Canvas />}
      {/* The canvas and the flow view name the milestone in their own
          corner; the other views have it at the bottom left of theirs. */}
      {!isPresenting && !isInspector && !isCanvasView && !isSequenceView && (
        <MilestoneChip style={{ gridArea: 'canvas', justifySelf: 'start', alignSelf: 'end', margin: 10, position: 'relative', zIndex: 7 }} />
      )}
      {!isPresenting && isDesigner && <RightPanel />}
      {!isPresenting && isViewer && <RightPanel readOnly />}
      {!isPresenting && isPresenter && <PresenterDock />}
      <PresentationBar />
      {!isPresenting && !isInspector && isCanvasView && <SelectionActionBar />}
      {!isInspector && <QuickSearch />}
      {isDesigner && <NodeWizard />}
      <NotificationHost />
      <MilestoneEditOverlay />
      {isMetamodel && !isPresenting && <MetamodelEditor />}
      {showWelcome && <WelcomeScreen onDismiss={() => setShowWelcome(false)} />}
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
