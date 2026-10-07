// ─── What one Radical Forge stage run added to the model ────────────────────
// Studio's side of @radical/common/ai/forge's stage output: reads the ids from
// the store and removes a previous attempt's additions before Regenerate.

import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { idsAddedSince, modelIdsOf, type ModelIds } from '@radical/common/ai/forge'

export type { ModelIds }

export function currentModelIds(): ModelIds {
  const { c4Nodes, c4Relations, views } = useDiagramStore.getState()
  return modelIdsOf({ nodes: c4Nodes, relations: c4Relations, views })
}

/** Ids in the model now that were not in `before`. */
export function addedSince(before: ModelIds): ModelIds {
  return idsAddedSince(before, currentModelIds())
}

/** Removes what is still there of an earlier run's additions. */
export function removeAdded(added: ModelIds): void {
  const store = useDiagramStore.getState
  for (const id of added.views) if (store().views[id]) store().removeView(id)
  for (const id of added.relations) if (store().c4Relations[id]) store().removeRelation(id)
  for (const id of added.nodes) if (store().c4Nodes[id]) store().removeNode(id)
}
