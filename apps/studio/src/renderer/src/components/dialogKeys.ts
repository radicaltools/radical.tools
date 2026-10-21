// ─── Studio's shortcuts and the dialogs over it ──────────────────────────────
//
// A dialog has the keys while it is open: Ctrl/Cmd+Z, F5, ⌘P, ⌘+ and Alt+←
// pressed in the Models dialog, the Hub import, AI providers or Radical Forge
// undid a drag, started a presentation (Forge closed and its text was lost),
// focused Quick Search, zoomed or went back behind it.

import { useEffect, type RefObject } from 'react'
import { useDiagramStore } from '@radical/ui/store/diagramStore'

/** A modal dialog is open (a node wizard, the Models dialog, About…):
 *  Studio's own shortcuts stay out of it. Ctrl/Cmd+Z in a wizard took back
 *  the element the wizard was creating its child in, and Create then saved a
 *  child of nothing (the model could not be opened again). */
export function inModalDialog(): boolean {
  return !!document.querySelector('[role="dialog"][aria-modal="true"]') || !!useDiagramStore.getState().nodeWizard
}

/** Whether a key pressed on `target` is a dialog's: a modal one is open, or
 *  the focus is in a dialog that leaves the canvas usable (Radical Forge),
 *  or the metamodel editor fills the window. */
export function keysTakenByDialog(target: EventTarget | null): boolean {
  if (inModalDialog()) return true
  if (useDiagramStore.getState().appMode === 'metamodel') return true
  const el = target as Element | null
  return !!el && typeof el.closest === 'function' && !!el.closest('[role="dialog"]')
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
