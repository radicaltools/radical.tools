// ─── Headless diagram facade ─────────────────────────────────────────────────
//
// A DiagramFacade over a plain DiagramData document, with no store or UI, so
// the AI tool catalogue (./tools) can edit a model outside Studio (the MCP
// server). It applies the same metamodel rules and edits as Studio's store,
// through ../model.
//
// What it does not do, because it has no canvas: undo, notifications,
// per-view node positions, and fitting a parent's size around a new child.
// Lay the result out with @radical/layout if positions matter.

import type { C4Node, C4Relation, DiagramData, DiagramView, Presentation } from '../c4'
import type { Metamodel } from '../metamodel'
import * as model from '../model'
import type { DiagramFacade } from './diagramFacade'

export interface ModelFacade extends DiagramFacade {
  /** The edited model as a document. Fields the facade does not edit
   *  (snapshots, layout positions, …) are carried over from the input. */
  toDiagramData(): DiagramData
  /** Why the most recent refused change was refused, or null. */
  readonly lastError: string | null
}

export interface ModelFacadeOptions {
  /** Id generator for new nodes, relations and views. Defaults to crypto.randomUUID. */
  newId?: () => string
  /** Lays out a document (All elements, or one view) and returns the result
   *  as `data`, or no data when nothing changed. Enables runLayout; the MCP
   *  server passes Smart Layout from @radical/layout. */
  runLayout?: (doc: DiagramData, viewId?: string) => Promise<{ ok: boolean; text: string; data?: DiagramData }>
}

const randomId = (): string =>
  (globalThis as unknown as { crypto: { randomUUID(): string } }).crypto.randomUUID()

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const byId = <T extends { id: string }>(items: T[] | undefined): Record<string, T> =>
  Object.fromEntries((items ?? []).map((item) => [item.id, clone(item)]))

export function createModelFacade(data: DiagramData, options: ModelFacadeOptions = {}): ModelFacade {
  const newId = options.newId ?? randomId
  let carried: Omit<DiagramData, 'nodes' | 'relations' | 'views' | 'sequences'> = {}
  const state: model.ModelState & { sequences: NonNullable<model.ModelState['sequences']> } = {
    c4Nodes: {}, c4Relations: {}, views: {}, activeViewId: null, sequences: {},
  }
  // Keep an input's (possibly empty) sequences list; a cleared model drops it.
  let keepSequences = false
  const load = (doc: DiagramData): void => {
    const { nodes, relations, views, sequences, ...rest } = doc
    carried = clone(rest)
    state.c4Nodes = byId(nodes)
    state.c4Relations = byId(relations)
    state.views = byId(views)
    state.sequences = byId(sequences)
    state.metamodel = model.documentMetamodel(doc.metamodel)
    keepSequences = sequences !== undefined
  }
  load(data)
  const toDiagramData = (): DiagramData => clone({
    ...carried,
    nodes: Object.values(state.c4Nodes),
    relations: Object.values(state.c4Relations),
    views: Object.values(state.views),
    ...(keepSequences || Object.keys(state.sequences).length ? { sequences: Object.values(state.sequences) } : {}),
  })
  let lastError: string | null = null
  const refuse = (reason: string): void => { lastError = reason }

  return {
    get lastError() { return lastError },

    getNodes: () => state.c4Nodes,
    getRelations: () => state.c4Relations,
    getMetamodel: () => state.metamodel,
    getViews: () => state.views,
    getActiveView: () => {
      const view = state.activeViewId ? state.views[state.activeViewId] : undefined
      return view ? { id: view.id, name: view.name, nodeIds: view.nodeIds } : null
    },

    addNode(node: Omit<C4Node, 'id'>) {
      const refused = model.checkAddNode(state, node)
      if (refused) { refuse(refused); return '' }
      const id = newId()
      model.insertNode(state, id, node)
      return id
    },
    updateNode(id: string, updates: Partial<Omit<C4Node, 'id'>>) {
      if (!state.c4Nodes[id]) return
      const refused = model.checkNodeUpdate(state, id, updates)
      if (refused) { refuse(refused); return }
      model.patchNode(state, id, updates)
    },
    removeNode(id: string) {
      model.deleteNode(state, id)
    },
    moveNodes(ids: string[], parentId: string | null) {
      const refused = model.checkReparent(state, ids, parentId)
      if (refused) { refuse(refused); return }
      model.reparentNodes(state, ids, parentId)
    },

    addRelation(rel: Omit<C4Relation, 'id'>) {
      const refused = model.checkAddRelation(state, rel)
      if (refused) { refuse(refused); return }
      model.insertRelation(state, newId(), rel)
    },
    updateRelation(id: string, updates: Partial<Omit<C4Relation, 'id'>>) {
      model.patchRelation(state, id, updates)
    },
    removeRelation(id: string) {
      model.deleteRelation(state, id)
    },

    addView(name: string) {
      const id = newId()
      model.insertView(state, id, name)
      return id
    },
    setViewNodes(viewId: string, nodeIds: string[]) {
      model.setViewNodeIds(state, viewId, nodeIds)
    },
    removeView(id: string) {
      delete state.views[id]
      if (state.activeViewId === id) state.activeViewId = null
    },
    setActiveView(id: string | null) {
      state.activeViewId = id
    },
    setViewKind(id: string, kind: DiagramView['kind']) {
      model.setViewKind(state, id, kind)
    },
    renameView(id: string, name: string) {
      model.renameView(state, id, name)
    },
    setViewSequence(id: string, sequenceId: string | null) {
      model.setViewSequence(state, id, sequenceId)
    },
    setViewHiddenRelations(id: string, relationIds: string[]) {
      model.setViewHiddenRelations(state, id, relationIds)
    },

    getSequences: () => state.sequences,
    addSequence(name: string) {
      const id = newId()
      model.insertSequence(state, id, name)
      return id
    },
    renameSequence(id: string, name: string) {
      model.renameSequence(state, id, name)
    },
    setSequenceSteps(id: string, steps: model.SequenceStep[]) {
      model.setSequenceSteps(state, id, steps)
    },
    removeSequence(id: string) {
      model.deleteSequence(state, id)
    },

    setMetamodel(metamodel: Metamodel) {
      state.metamodel = clone(metamodel)
      carried.metamodel = clone(metamodel)
    },

    getPresentations: () => carried.presentations ?? [],
    setPresentations(presentations: Presentation[]) {
      carried.presentations = clone(presentations)
    },

    ...(options.runLayout ? {
      async runLayout(viewId?: string) {
        const outcome = await options.runLayout!(toDiagramData(), viewId)
        if (outcome.data) load(outcome.data)
        return { ok: outcome.ok, text: outcome.text }
      },
    } : {}),

    // Same as Studio's reset: everything goes except the metamodel.
    clearDiagram() {
      state.c4Nodes = {}
      state.c4Relations = {}
      state.views = {}
      state.sequences = {}
      keepSequences = false
      state.activeViewId = null
      carried = carried.metamodel ? { metamodel: carried.metamodel } : {}
    },

    toDiagramData,
  }
}
