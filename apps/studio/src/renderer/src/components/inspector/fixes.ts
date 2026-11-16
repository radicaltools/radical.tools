// ─── Inspector: fixes of one step ────────────────────────────────────────────
//
// What the Overview offers where a finding's fix is one step: a scenario
// that verifies a requirement without one, a fitness function that
// implements an accepted ADR without one. The element is made as the
// canvas, the table and the wiki make one (requestCreateNode: the type's
// wizard, with the link offered pre-checked), and goes where the element it
// checks is shown rather than into whatever view was open last.
// What the panel may do is what the perspective it is open in may do: in
// Designer the fix is made at once; Viewer and Presenter edit nothing, so
// there it reads "… in Designer" and is made there (editAsDesigner). While
// a milestone is shown it waits: the fix is the live model's.

import type { C4ElementType, C4Node } from '@radical/common/c4'
import { nodeTypeSize } from '@radical/common/c4'
import { isPlacementAllowed } from '@radical/common/metamodel'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { editAsDesigner, liveModelEditRefused } from '@radical/ui/store/designerEdit'

/** By rule: the element that settles its finding, and how it links to it. */
export const ONE_STEP_FIXES: Record<string, { type: 'scenario' | 'fitness-fn'; relationType: string; label: string }> = {
  'requirement-without-scenario': { type: 'scenario', relationType: 'verifies', label: 'Add scenario' },
  'adr-without-fitness-fn': { type: 'fitness-fn', relationType: 'implements', label: 'Add fitness function' },
}

/** How the panel offers a fix in the perspective open: the words after
 *  its label, its tooltip, and why it is greyed out (or null). */
export function useFixOffer(): { suffix: string; title: string; refused: string | null } {
  const appMode = useDiagramStore((s) => s.appMode)
  // Read again when the milestone shown changes.
  useDiagramStore((s) => s.activeSnapshotId)
  const refused = liveModelEditRefused()
  return appMode === 'designer'
    ? { suffix: '', title: 'Make it now, as one undo step', refused }
    : { suffix: ' in Designer', title: `${appMode === 'presenter' ? 'Presentations change' : 'Viewer changes'} nothing: Studio makes it in Designer and shows it there`, refused }
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
 *  its id once it is in the model (after its wizard, when it has one). From
 *  Viewer or Presenter it is Designer's edit (editAsDesigner), which Studio
 *  then shows, made at once or by the wizard. Refused while a milestone is
 *  shown (liveModelEditRefused). */
export function startFix(rule: string, targetId: string, onCreated: (id: string) => void): void {
  const fix = ONE_STEP_FIXES[rule]
  const s = useDiagramStore.getState()
  const target = s.c4Nodes[targetId]
  if (!fix || !target) return
  const refused = liveModelEditRefused()
  if (refused) { s.pushNotification(refused, 'warning'); return }
  const def = s.metamodel.nodeTypes[fix.type]
  // Beside it, in its group, where the metamodel lets it go there.
  const parent = target.parentId ? s.c4Nodes[target.parentId] : undefined
  const parentId = parent && isPlacementAllowed(s.metamodel, fix.type, parent, s.c4Nodes) ? parent.id : undefined
  editAsDesigner(() => s.requestCreateNode({
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
  }))
}
