// ─── Keys kept in a panel or a field ─────────────────────────────────────────
//
// A panel or a field that keeps its keys from the canvas and Studio's
// shortcuts (stopPropagation) kept F5 and Cmd/Ctrl+P from Studio as well.
// Nothing took them, so the browser did: F5 reloaded the page (a comment
// being written in the discussion panel was lost) and Cmd/Ctrl+P opened the
// print dialog. Studio takes both on the window, everywhere, and leaves them
// to a dialog that has the focus (dialogKeys.ts in Studio).

import { useDiagramStore } from '../store/diagramStore'

interface Key { key: string; metaKey: boolean; ctrlKey: boolean; stopPropagation(): void }

/** F5 and Cmd/Ctrl+P: Studio's keys that the browser has as well. */
export function isStudioBrowserKey(e: Pick<Key, 'key' | 'metaKey' | 'ctrlKey'>): boolean {
  return e.key === 'F5' || ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 'P'))
}

/** Keeps a key pressed here from the rest of the page, except F5 and
 *  Cmd/Ctrl+P: they go on to Studio, which takes them as everywhere else. */
export function keepKeysHere(e: Key): void {
  if (!isStudioBrowserKey(e)) e.stopPropagation()
}

/** A modal dialog is open (a node wizard, Setup, the Models dialog,
 *  About…): it has the keys. The canvas's keys and Studio's shortcuts stay
 *  out of it; Delete pressed in Setup opened the canvas's delete prompt
 *  behind it, for the element selected there. */
export function modalDialogOpen(): boolean {
  if (typeof document === 'undefined') return false
  return !!document.querySelector('[role="dialog"][aria-modal="true"]') || !!useDiagramStore.getState().nodeWizard
}

/** Whether the canvas leaves a key alone: a modal dialog has it, or it is
 *  typed into a field (or something marked `nokey`), as React Flow tells. */
export function canvasKeysOff(e: { target: EventTarget | null }): boolean {
  if (modalDialogOpen()) return true
  const el = e.target as HTMLElement | null
  if (!el || typeof el.closest !== 'function') return false
  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.nodeName) || el.hasAttribute('contenteditable') || !!el.closest('.nokey')
}

/** Input kinds that hold no text: a click or a pick, nothing typed. */
const NOT_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'])

/** Whether `target` is a field the user types text into: a text input, a
 *  text area or editable text. A drop-down, a checkbox or a button is not
 *  one: following the agent waited on a type picked in a card (F-0178). */
export function isTypedField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.tagName !== 'string') return false
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true
  return el.tagName === 'INPUT' && !NOT_TEXT_INPUTS.has((el as HTMLInputElement).type)
}
