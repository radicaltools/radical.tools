import { useDiagramStore } from '../store/diagramStore'
import { useCardOpen } from '../store/showInView'

/** How much of the canvas's right side the properties card (RightPanel)
 *  covers, in screen pixels: its width and margin while it is open or about
 *  to open for a selection (asked for, openCard), else 0. A click only
 *  selects: counted for any one element selected, the card that is not
 *  there pushed the framing to the left. The canvas frames a selection in
 *  what is left. Read from the layout, not the drawn box: while the card
 *  slides in, the drawn box is still off to the right. */
export function propertiesPanelCover(): number {
  if (typeof document === 'undefined') return 0
  const el = document.querySelector<HTMLElement>('.right-panel')
  if (!el) return 0
  const s = useDiagramStore.getState()
  const one = (!!s.selectedNodeId && s.selectedNodeIds.length <= 1) || !!s.selectedEdgeId
  if (!el.classList.contains('open') && !(one && useCardOpen.getState().requested)) return 0
  const margin = parseFloat(getComputedStyle(el).marginRight) || 0
  return el.offsetWidth + margin
}

/** How much of the canvas's left side the elements palette covers, in
 *  screen pixels (0 where there is none). */
export function paletteCover(): number {
  if (typeof document === 'undefined') return 0
  const el = document.querySelector<HTMLElement>('.canvas-column .element-palette')
  return el ? el.offsetLeft + el.offsetWidth : 0
}
