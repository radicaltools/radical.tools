// ─── Edits a perspective offers ──────────────────────────────────────────────
//
// Viewer and Presenter show a model that is never saved: Designer's is
// parked on the way out of it and put back on the way in, and undo and the
// save are Designer's (setAppMode). An edit one of them offers (a fix of one
// step the Inspector panel offers there, a concern pack added from the Hub)
// is made in Designer, as one undo step it saves. Made in the perspective,
// it was counted and drawn there, never saved, and gone in Designer.

import type { C4Node, C4Relation } from '@radical/common/c4'
import { editsModel, useDiagramStore, type ParkedDesigner } from './diagramStore'

const parked = (): ParkedDesigner | undefined => (window as unknown as { __preModeLayout?: ParkedDesigner }).__preModeLayout

/** Why an edit of the live model (the Inspector's fixes of one step) cannot
 *  be made now, or null: a milestone is shown, in the perspective open or
 *  in Designer's parked model, and the edit would go into it. */
export function liveModelEditRefused(): string | null {
  const s = useDiagramStore.getState()
  const id = s.activeSnapshotId ?? (!editsModel(s) ? parked()?.activeSnapshotId : null) ?? null
  if (!id) return null
  const name = s.snapshots.find((m) => m.id === id)?.name
  return `${name ? `The milestone "${name}"` : 'A milestone'} is shown${s.activeSnapshotId ? '' : ' in Designer'}: this edits the live model. Go back to the current model first.`
}

/** Makes `edit` a Designer edit, as one undo step it saves. From Viewer or
 *  Presenter Studio stays in Designer, which shows what it made, as a Forge
 *  run does. */
export function editAsDesigner<T>(edit: () => T): T | undefined {
  const s = useDiagramStore.getState()
  if (editsModel(s)) return edit()
  s.setAppMode('designer')
  const mark = useDiagramStore.getState()._historyMark()
  try {
    return edit()
  } finally {
    useDiagramStore.getState()._mergeStepsSince(mark)
  }
}

/** The model an edit editAsDesigner makes goes into, for what the edit
 *  offers to pick (the elements a concern pack is bound to): Designer's,
 *  parked while Viewer or Presenter shows another (a milestone, a slide's).
 *  Offered from the model shown, an element only a milestone has was
 *  picked, and dropped unsaid by the edit. */
export function designerEditModel(s: Pick<ReturnType<typeof useDiagramStore.getState>, 'appMode' | 'c4Nodes' | 'c4Relations'>): { nodes: Record<string, C4Node>; relations: Record<string, C4Relation> } {
  const pre = s.appMode === 'viewer' || s.appMode === 'presenter' ? parked() : undefined
  return pre ? { nodes: pre.c4Nodes, relations: pre.c4Relations } : { nodes: s.c4Nodes, relations: s.c4Relations }
}
