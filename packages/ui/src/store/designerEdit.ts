// ─── Edits a perspective offers ──────────────────────────────────────────────
//
// Viewer, Presenter and the Inspector show a model that is never saved:
// Designer's is parked on the way out of it and put back on the way in, and
// undo and the save are Designer's (setAppMode). An edit one of them offers
// (the Inspector's fixes of one step, a concern pack added from the Hub) is
// made in Designer, as one undo step it saves. Made in the perspective, it
// was counted and drawn there, never saved, and gone in Designer.

import { editsModel, useDiagramStore, type ParkedDesigner } from './diagramStore'

/** Why an edit the Inspector offers cannot be made now, or null. Its edits
 *  are the live model's: with a milestone shown in Designer, Designer goes
 *  back to the live model for them, which it cannot while the milestone
 *  has edits not kept or dropped. */
export function designerEditRefused(): string | null {
  const s = useDiagramStore.getState()
  if (s.appMode !== 'inspector') return null
  const pre = (window as unknown as { __preModeLayout?: ParkedDesigner }).__preModeLayout
  if (!pre?.activeSnapshotId || !pre.milestoneDirty) return null
  const name = s.snapshots.find((m) => m.id === pre.activeSnapshotId)?.name ?? 'the milestone'
  return `Designer has edits of ${name} not kept or dropped yet: keep or drop them there first.`
}

/** Makes `edit` a Designer edit, as one undo step it saves. From Viewer or
 *  Presenter Studio stays in Designer, which shows what it made, as a Forge
 *  run does. The Inspector, about the live model, goes on over the model it
 *  made; Designer shows the live model after it. Refused (undefined, said
 *  in a notice) as designerEditRefused says. */
export function editAsDesigner<T>(edit: () => T): T | undefined {
  const s = useDiagramStore.getState()
  if (editsModel(s)) return edit()
  const refused = designerEditRefused()
  if (refused) {
    s.pushNotification(refused, 'error')
    return undefined
  }
  const from = s.appMode
  s.setAppMode('designer')
  if (from === 'inspector' && useDiagramStore.getState().activeSnapshotId) useDiagramStore.getState().discardMilestoneChanges()
  const mark = useDiagramStore.getState()._historyMark()
  try {
    return edit()
  } finally {
    useDiagramStore.getState()._mergeStepsSince(mark)
    if (from === 'inspector') useDiagramStore.getState().setAppMode('inspector')
  }
}
