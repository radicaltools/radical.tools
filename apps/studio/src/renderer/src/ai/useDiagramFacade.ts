// ─── Shared AI diagram facade ───────────────────────────────────────────────
// Thin adapter from `DiagramFacade` (what ai/runner.ts drives) onto the live
// diagramStore. Reads fresh from the store on every call (via getState())
// rather than closing over a snapshot, so the AI sees the latest state even
// mid-session. Shared by every AI entry point (QuickSearch's ✨ chat, the
// Radical Forge wizard, …) so they behave identically and don't duplicate
// this store-binding boilerplate.

import { useMemo } from 'react'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import type { DiagramFacade } from '@radical/common/ai/diagramFacade'
import type { Presentation } from '@radical/common/c4'
import type { Metamodel } from '@radical/common/metamodel'

export function useDiagramFacade(): DiagramFacade {
  return useMemo(createStoreFacade, [])
}

/** The facade over the live store; also usable outside React (tests). */
export function createStoreFacade(): DiagramFacade {
  return {
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
    moveNodes: (ids: string[], parentId: string | null) =>
      useDiagramStore.getState().reparentNodes(ids, parentId),
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
    renameView: (id: string, name: string) => useDiagramStore.getState().renameView(id, name),
    setViewSequence: (id: string, sequenceId: string | null) =>
      useDiagramStore.getState().setViewSequence(id, sequenceId),
    setViewHiddenRelations: (id: string, relationIds: string[]) =>
      useDiagramStore.getState().setViewHiddenRelations(id, relationIds),
    // ── sequences ──
    getSequences: () => useDiagramStore.getState().sequences,
    addSequence: (name: string) => useDiagramStore.getState().addSequence(name),
    renameSequence: (id: string, name: string) => useDiagramStore.getState().renameSequence(id, name),
    setSequenceSteps: (id: string, steps: Array<{ relationId: string; description?: string }>) => {
      const s = useDiagramStore.getState()
      s.clearSequence(id)
      steps.forEach((step, i) => {
        s.toggleRelationInSequence(id, step.relationId)
        if (step.description) s.updateStepDescription(id, i, step.description)
      })
    },
    removeSequence: (id: string) => useDiagramStore.getState().removeSequence(id),
    // ── metamodel, presentations, layout ──
    setMetamodel: (metamodel: Metamodel) => useDiagramStore.getState().setMetamodel(metamodel),
    getPresentations: () => useDiagramStore.getState().presentations,
    setPresentations: (presentations: Presentation[]) => useDiagramStore.getState().setPresentations(presentations),
    runLayout: async (viewId?: string) => {
      const s = useDiagramStore.getState()
      if (s.appMode !== 'designer') return { ok: false, text: 'Smart Layout runs only in the designer.' }
      // Studio lays out what is on screen, so switch to the requested canvas first.
      const target = viewId ?? null
      if (target !== s.activeViewId) s.setActiveView(target)
      await useDiagramStore.getState().runSmartLayout()
      const name = target ? useDiagramStore.getState().views[target]?.name ?? target : 'All elements'
      return { ok: true, text: `Ran Smart Layout on ${name}.` }
    },
    // ── diagram-level ──
    clearDiagram: () => useDiagramStore.getState().clearModel(),
  }
}
