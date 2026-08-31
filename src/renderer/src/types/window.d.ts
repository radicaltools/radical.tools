// Ambient typing for the renderer's window-level bridge globals.
//
// These are intentionally hung off `window` (not module state) so they survive
// Vite HMR module reloads, and so imperative hooks — React Flow viewport / fit,
// zoom controls, quick-search, persist flush — can cross component/store
// boundaries without prop-drilling. Typing them here removes the ~30 `as any`
// casts that previously guarded every access.

import type { C4Node, C4Relation, DiagramView, NodePosition } from './c4'

export {}

declare global {
  interface RadicalViewport {
    x: number
    y: number
    zoom: number
  }

  interface Window {
    // ── React Flow viewport bridge (registered by Canvas) ──
    __rfGetViewport?: () => RadicalViewport
    __rfSetViewport?: (vp: RadicalViewport, opts?: { duration?: number }) => void
    __rfCurrentViewport?: RadicalViewport
    __rfFocusNode?: (nodeId: string, opts?: { zoom?: number; duration?: number }) => void

    // ── Fit-view / auto-fit (survive HMR; see diagramStore) ──
    __radicalFitViewFn?: (() => void) | null
    __radicalFitViewInstantFn?: (() => void) | null
    __radicalAutoFitTimer?: ReturnType<typeof setInterval> | null
    __radicalAutoFitSuppressUntil?: number
    __radicalSeqFitFn?: () => void

    // ── Zoom controls (registered by the active canvas) ──
    __radicalZoomIn?: () => void
    __radicalZoomOut?: () => void

    // ── Misc imperative hooks ──
    __radicalFlushPersist?: () => Promise<void>
    __radicalExpandRightPanel?: () => void
    __radicalOpenQuickSearch?: () => void

    // ── Mode-transition scratch state (kept on window to survive HMR) ──
    // Snapshot of the model before entering a presentation, restored on exit.
    __prePresState?: {
      c4Nodes: Record<string, C4Node>
      c4Relations: Record<string, C4Relation>
      activeViewId: string | null
    }
    // Snapshot of the designer layout before entering a read-only mode, so
    // ephemeral explore-mode drags/collapses never reach disk on persist.
    __preModeLayout?: {
      c4Nodes: Record<string, C4Node>
      c4Relations: Record<string, C4Relation>
      views: Record<string, DiagramView>
      defaultPositions: Record<string, NodePosition>
      activeViewId: string | null
    }
  }
}
