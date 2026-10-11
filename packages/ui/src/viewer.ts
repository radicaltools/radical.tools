// ─── Viewer kit ──────────────────────────────────────────────────────────────
//
// Everything the read-only Hub viewer (apps/hub) needs, as one entry point:
// `@radical/ui/viewer`.
//
// Set `window.__RADICAL_PROFILE = 'viewer'` before importing this module; the
// diagram store reads the profile at import time.

export { Canvas } from './components/Canvas'
export { WikiView } from './components/WikiView'
export { TableView } from './components/TableView'
export { RightPanel } from './components/RightPanel'
export { NotificationHost } from './components/NotificationHost'
export { SmartLayoutButton } from './components/SmartLayoutButton'
export { ErrorBoundary } from './components/ErrorBoundary'
export { useDiagramStore } from './store/diagramStore'
export { useHubStore, buildConnectionCounts, toggleInSet, type HubSortKey } from './store/hubStore'
export { HUB_CATEGORIES, categoryTheme } from './types/hubTheme'
export { conceptViewsToDiagram } from '@radical/common/hubViews'
export { sanitizeWireframeSvg } from '@radical/common/wireframe'
