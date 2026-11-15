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
 *  About, the Delete prompt…): it has the keys. The canvas's keys and
 *  Studio's shortcuts stay out of it; Delete pressed in Setup opened the
 *  canvas's delete prompt behind it, for the element selected there. The
 *  Delete prompt is asked for in the store before it is drawn: it was no
 *  dialog to this gate, and Cmd/Ctrl+P, F5 and Ctrl/Cmd+Z switched the
 *  view, started the presentation or undid a step behind it. */
export function modalDialogOpen(): boolean {
  const { nodeWizard, pendingDelete } = useDiagramStore.getState()
  if (nodeWizard || (pendingDelete && pendingDelete.nodeIds.length + pendingDelete.edgeIds.length > 0)) return true
  if (typeof document === 'undefined') return false
  return !!document.querySelector('[role="dialog"][aria-modal="true"]')
}

/** Where the focus keeps its keys: a dialog that leaves the canvas usable
 *  (Radical Forge, the agent's run panels, a popover) or an open menu. */
const KEEPS_KEYS = '[role="dialog"], [role="menu"]'

/** Whether a key pressed on `target` is something else's: a modal dialog
 *  is open, or the key is pressed in a dialog or a menu. The one rule for
 *  the canvas's keys (canvasKeysOff) and Studio's shortcuts (dialogKeys.ts
 *  in Studio): Delete pressed in Radical Forge opened the delete prompt
 *  under the panel, for the element selected behind it. */
export function keysTakenElsewhere(target: EventTarget | null): boolean {
  if (modalDialogOpen()) return true
  const el = target as Element | null
  return !!el && typeof el.closest === 'function' && !!el.closest(KEEPS_KEYS)
}

/** Whether the canvas leaves a key alone: something else has it
 *  (keysTakenElsewhere), or it is typed into a field (or something marked
 *  `nokey`), as React Flow tells. */
export function canvasKeysOff(e: { target: EventTarget | null }): boolean {
  if (keysTakenElsewhere(e.target)) return true
  const el = e.target as HTMLElement | null
  if (!el || typeof el.closest !== 'function') return false
  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.nodeName) || el.hasAttribute('contenteditable') || !!el.closest('.nokey')
}

/** The dialogs and the run panels. Each is portalled to the body and drawn
 *  on one layer (--z-dialog in index.css), so the one opened last is on
 *  top. Each had a number of its own: Radical Forge's panel covered the
 *  Delete prompt, the Models dialog, AI providers and About opened over it. */
const OVERLAYS = '.milestone-modal-backdrop, .nw-backdrop, .docmgr-backdrop, .forge-panel'
/** Of them, the panels that leave the page usable beside them. */
const PANELS = '.forge-panel'

/** The dialog or run panel on top: on the highest layer, and of those on
 *  it the one opened last (the last in the body). */
export function topOverlay(): Element | null {
  if (typeof document === 'undefined') return null
  let top: Element | null = null
  let topZ = -Infinity
  for (const el of document.querySelectorAll(OVERLAYS)) {
    const z = Number(getComputedStyle(el).zIndex) || 0
    if (z >= topZ) { top = el; topZ = z }
  }
  return top
}

/** The overlay on top when a key went down, the same for every listener
 *  of it: the first to act closes its dialog before the next one asks. */
const topWhenPressed = new WeakMap<Event, Element | null>()

/** Whether key `e`, listened for on the window (Esc), is for `el`, a
 *  dialog, a run panel or a popover: nothing is open over it. Each closed on
 *  Esc whatever lay over it: Esc in the Delete prompt over Radical Forge
 *  closed Forge with it. A popover under a run panel closes still, as the
 *  panel leaves the page usable. */
export function keysOnTop(el: Element | null, e: Event): boolean {
  if (!topWhenPressed.has(e)) topWhenPressed.set(e, topOverlay())
  const top = topWhenPressed.get(e)
  if (!el || !top || top === el || top.contains(el) || el.contains(top)) return true
  return !el.closest(OVERLAYS) && top.matches(PANELS)
}
