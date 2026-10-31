// ─── Inspector: fixes of one step ────────────────────────────────────────────
//
// What the Overview offers where a finding's fix is one step: a scenario
// that verifies a requirement without one, a fitness function that
// implements an accepted ADR without one. The element is made as the
// canvas, the table and the wiki make one (requestCreateNode: the type's
// wizard, with the link offered pre-checked), and goes where the element it
// checks is shown rather than into whatever view was open last.

import type { C4ElementType, C4Node } from '@radical/common/c4'
import { nodeTypeSize } from '@radical/common/c4'
import { isPlacementAllowed } from '@radical/common/metamodel'
import { useDiagramStore } from '@radical/ui/store/diagramStore'

/** By rule: the element that settles its finding, and how it links to it. */
export const ONE_STEP_FIXES: Record<string, { type: 'scenario' | 'fitness-fn'; relationType: string; label: string }> = {
  'requirement-without-scenario': { type: 'scenario', relationType: 'verifies', label: 'Add scenario' },
  'adr-without-fitness-fn': { type: 'fitness-fn', relationType: 'implements', label: 'Add fitness function' },
}

/** Lists `id` in the views that list `besideId`, and takes it out of the
 *  views that do not (the one open when it was made). Views that list
 *  nothing show every element, and those with a filter what it gives. */
export function placeBeside(id: string, besideId: string): void {
  const s = useDiagramStore.getState()
  for (const v of Object.values(s.views)) {
    if (!v.nodeIds.length || v.pipeline) continue
    const besides = v.nodeIds.includes(besideId)
    const lists = v.nodeIds.includes(id)
    if (besides && !lists) s.addNodeToView(v.id, id)
    else if (!besides && lists) s.removeNodeFromView(v.id, id)
  }
}

/** Starts the element `rule`'s fix makes for `targetId`; `onCreated` gets
 *  its id once it is in the model (after its wizard, when it has one). */
export function startFix(rule: string, targetId: string, onCreated: (id: string) => void): void {
  const fix = ONE_STEP_FIXES[rule]
  const s = useDiagramStore.getState()
  const target = s.c4Nodes[targetId]
  if (!fix || !target) return
  const def = s.metamodel.nodeTypes[fix.type]
  // Beside it, in its group, where the metamodel lets it go there.
  const parent = target.parentId ? s.c4Nodes[target.parentId] : undefined
  const parentId = parent && isPlacementAllowed(s.metamodel, fix.type, parent, s.c4Nodes) ? parent.id : undefined
  s.requestCreateNode({
    type: fix.type as C4ElementType,
    label: `New ${def?.label ?? fix.type}`,
    description: '',
    technology: '',
    collapsed: false,
    external: false,
    parentId,
    x: 0,
    y: 0,
    ...nodeTypeSize(fix.type, s.metamodel),
  } as Omit<C4Node, 'id'>, {
    links: [{ relationType: fix.relationType, direction: 'out', otherId: targetId }],
    onCreated: (id) => { placeBeside(id, targetId); onCreated(id) },
  })
}
