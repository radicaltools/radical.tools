// ─── Studio's shortcuts and the dialogs over it ──────────────────────────────
//
// A dialog has the keys while it is open: Ctrl/Cmd+Z, F5, ⌘P, ⌘+ and Alt+←
// pressed in the Models dialog, the Hub import, AI providers or Radical Forge
// undid a drag, started a presentation (Forge closed and its text was lost),
// focused Quick Search, zoomed or went back behind it.

import { useEffect, type RefObject } from 'react'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { keysTakenElsewhere } from '@radical/ui/components/keysHere'

/** Whether a key pressed on `target` is a dialog's: something else has it
 *  as the canvas's keys go (keysTakenElsewhere: a modal dialog, the Delete
 *  prompt among them, or the focus in a dialog that leaves the canvas
 *  usable, as Radical Forge, or in a menu), or the metamodel editor fills
 *  the window. Ctrl/Cmd+Z in a wizard took back the element the wizard was
 *  creating its child in, and Create then saved a child of nothing. */
export function keysTakenByDialog(target: EventTarget | null): boolean {
  if (keysTakenElsewhere(target)) return true
  return useDiagramStore.getState().appMode === 'metamodel'
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Keeps the focus in a modal dialog: it starts there (unless something in
 * it already has it) and Tab and Shift+Tab go round its controls. The first
 * Tab left the dialog for the toolbar behind it.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, open = true): void {
  useEffect(() => {
    if (!open) return
    const box = ref.current
    if (!box) return
    if (!box.contains(document.activeElement)) {
      if (!box.hasAttribute('tabindex')) box.setAttribute('tabindex', '-1')
      box.focus({ preventScroll: true })
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return
      const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (!items.length) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const at = document.activeElement
      if (!box.contains(at)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return }
      if (e.shiftKey && (at === first || at === box)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [ref, open])
}
