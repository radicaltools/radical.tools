// ─── What one Radical Forge stage run added to the model ────────────────────
// Regenerate runs a stage again on top of the model, so the previous attempt's
// additions are removed first; otherwise every regeneration stacks a copy.
// Updates and deletions an attempt made are not reverted.

import { useDiagramStore } from '@radical/ui/store/diagramStore'

export interface ModelIds {
  nodes: string[]
  relations: string[]
  views: string[]
}

export function currentModelIds(): ModelIds {
  const { c4Nodes, c4Relations, views } = useDiagramStore.getState()
  return { nodes: Object.keys(c4Nodes), relations: Object.keys(c4Relations), views: Object.keys(views) }
}

/** Ids in the model now that were not in `before`. */
export function addedSince(before: ModelIds): ModelIds {
  const now = currentModelIds()
  const only = (ids: string[], old: string[]): string[] => {
    const seen = new Set(old)
    return ids.filter((id) => !seen.has(id))
  }
  return { nodes: only(now.nodes, before.nodes), relations: only(now.relations, before.relations), views: only(now.views, before.views) }
}

/** Removes what is still there of an earlier run's additions. */
export function removeAdded(added: ModelIds): void {
  const store = useDiagramStore.getState
  for (const id of added.views) if (store().views[id]) store().removeView(id)
  for (const id of added.relations) if (store().c4Relations[id]) store().removeRelation(id)
  for (const id of added.nodes) if (store().c4Nodes[id]) store().removeNode(id)
}
