// ─── Shared AI diagram facade ───────────────────────────────────────────────
// Thin adapter from `DiagramFacade` (what ai/runner.ts drives) onto the live
// diagramStore. Reads fresh from the store on every call (via getState())
// rather than closing over a snapshot, so the AI sees the latest state even
// mid-session. Shared by every AI entry point (QuickSearch's ✨ chat, the
// Radical Forge wizard, …) so they behave identically and don't duplicate
// this store-binding boilerplate.

import { useMemo } from 'react'
import { useDiagramStore } from '../store/diagramStore'
import type { DiagramFacade } from './diagramFacade'

export function useDiagramFacade(): DiagramFacade {
  return useMemo<DiagramFacade>(() => ({
    getNodes: () => useDiagramStore.getState().c4Nodes,
    getRelations: () => useDiagramStore.getState().c4Relations,
    getMetamodel: () => useDiagramStore.getState().metamodel,
    getActiveView: () => {
      const s = useDiagramStore.getState()
      if (!s.activeViewId) return null
      const v = s.views[s.activeViewId]
      if (!v) return null
      return { id: v.id, name: v.name, nodeIds: v.nodeIds }
    },
    addNode: (n: Parameters<ReturnType<typeof useDiagramStore.getState>['addNode']>[0]) =>
      useDiagramStore.getState().addNode(n),
    updateNode: (id: string, u: Parameters<ReturnType<typeof useDiagramStore.getState>['updateNode']>[1]) =>
      useDiagramStore.getState().updateNode(id, u),
    removeNode: (id: string) => useDiagramStore.getState().removeNode(id),
    addRelation: (r: Parameters<ReturnType<typeof useDiagramStore.getState>['addRelation']>[0]) =>
      useDiagramStore.getState().addRelation(r),
    updateRelation: (id: string, u: Parameters<ReturnType<typeof useDiagramStore.getState>['updateRelation']>[1]) =>
      useDiagramStore.getState().updateRelation(id, u),
    removeRelation: (id: string) => useDiagramStore.getState().removeRelation(id),
    // ── views ──
    getViews: () => useDiagramStore.getState().views,
    addView: (name: string) => useDiagramStore.getState().addView(name),
    setViewNodes: (viewId: string, nodeIds: string[]) =>
      useDiagramStore.getState().setViewNodes(viewId, nodeIds),
    removeView: (id: string) => useDiagramStore.getState().removeView(id),
    setActiveView: (id: string | null) => useDiagramStore.getState().setActiveView(id),
    setViewKind: (id: string, kind: Parameters<ReturnType<typeof useDiagramStore.getState>['setViewKind']>[1]) =>
      useDiagramStore.getState().setViewKind(id, kind),
    // ── diagram-level ──
    clearDiagram: () => {
      const s = useDiagramStore.getState()
      s.loadDiagram({
        nodes: [],
        relations: [],
        views: [],
        defaultPositions: {},
        defaultViewport: null,
        snapshots: [],
        presentations: [],
        metamodel: s.metamodel,
      })
    },
  }), [])
}
