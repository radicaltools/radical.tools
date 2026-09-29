/**
 * Shared ELK spacing constants, factored out of elkLayout.ts and smartLayout.ts
 * so the two independently-maintained ELK config sets don't drift apart.
 *
 * This module deliberately has NO runtime dependency on `elkjs` (only the
 * `LayoutOptions` type, which is erased at build time) — smartLayout.ts's SA
 * refinement phase runs inside smartLayout.worker.ts, and elkjs's real
 * layout engine (elk.bundled.js, itself a Web Worker script) cannot be
 * imported inside another worker. A plain runtime import of elkLayout.ts
 * from smartLayout.ts would pull elkjs into the worker bundle and break it —
 * see the dynamic `import('./elkLayout')` in runSmartLayoutELKPhase for the
 * same constraint. Keeping these constants in a leaf module with no elkjs
 * import lets both sides share them safely.
 */
import type { LayoutOptions } from 'elkjs'

/** Root-level (system/domain) spacing — matches elkLayout.ts's LAYERED_OPTIONS. */
export const ELK_ROOT_SPACING: LayoutOptions = {
  'elk.spacing.nodeNode': '60',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.spacing.edgeNode': '20',
  'elk.spacing.edgeEdge': '10',
  'elk.spacing.componentComponent': '80',
}

/** Compound-child (container/component) spacing — matches elkLayout.ts's CHILD_OPTIONS. */
export const ELK_CHILD_SPACING: LayoutOptions = {
  'elk.spacing.nodeNode': '30',
  'elk.layered.spacing.nodeNodeBetweenLayers': '50',
  'elk.spacing.edgeNode': '12',
  'elk.spacing.edgeEdge': '8',
  'elk.spacing.componentComponent': '40',
}
