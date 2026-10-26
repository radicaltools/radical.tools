// ─── Editing controls ────────────────────────────────────────────────────────
//
// What is drawn in or over a view to edit it, not what the view shows: the
// buttons on and beside the elements (−/+, Explore's +, discussions), the
// Unpin pin and the alignment guides, the menus, pills and bars over the
// canvas, the add and step buttons of the other views. An export is a
// picture of the diagram, not of the editor: it leaves out every element
// marked so (useExport in Studio). It listed the classes to leave out, and
// each control added after the list was exported with the view (the Unpin
// pin, the alignment guides with their buttons).

/** The attribute that marks an editing control. */
export const EDITING_CONTROL_ATTRIBUTE = 'data-editing-control'

/** Spread on an editing control's outermost element:
 *  `<div {...editingControl} className="…">`. */
export const editingControl = { [EDITING_CONTROL_ATTRIBUTE]: '' } as const

/** Whether `el` is an editing control (its descendants go with it). */
export function isEditingControl(el: Element): boolean {
  return el.hasAttribute(EDITING_CONTROL_ATTRIBUTE)
}
