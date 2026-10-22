// ─── A menu's keys ───────────────────────────────────────────────────────────
//
// The Radical menu and the selection actions' menus (Wrap into…, Move to…,
// Change source/destination…) did not answer ↑/↓, and the Radical menu
// stayed open when Tab left it.

import { useEffect, useRef, type RefObject } from 'react'

const ITEMS = '[role="menu"] button:not([disabled]), [role="menu"] input:not([disabled]), [role="menu"] select:not([disabled])'

/**
 * While the menu inside `wrap` (its trigger and its `[role="menu"]`) is
 * open: ↓/↑ move the focus through its controls, from the trigger to the
 * first or last, Home/End to the ends, Escape closes it and gives the focus
 * back to the trigger, and the focus leaving it (Tab) closes it.
 */
export function useMenuKeys(wrap: RefObject<HTMLElement | null>, open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const close = (): void => closeRef.current()
    const box = wrap.current
    if (!open || !box) return
    const items = (): HTMLElement[] => [...box.querySelectorAll<HTMLElement>(ITEMS)]
    const onKey = (e: KeyboardEvent): void => {
      const at = document.activeElement as HTMLElement | null
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
        box.querySelector<HTMLElement>('[aria-haspopup], button')?.focus()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
      // A select's arrows pick its options.
      if (at?.tagName === 'SELECT') return
      const list = items()
      if (!list.length) return
      e.preventDefault()
      const i = at ? list.indexOf(at) : -1
      const next = e.key === 'Home' ? 0
        : e.key === 'End' ? list.length - 1
        : e.key === 'ArrowDown' ? (i < 0 ? 0 : (i + 1) % list.length)
        : (i < 0 ? list.length - 1 : (i - 1 + list.length) % list.length)
      list[next].focus()
    }
    const onFocusOut = (e: FocusEvent): void => {
      const to = e.relatedTarget as Node | null
      if (to && !box.contains(to)) close()
    }
    box.addEventListener('keydown', onKey)
    box.addEventListener('focusout', onFocusOut)
    return () => {
      box.removeEventListener('keydown', onKey)
      box.removeEventListener('focusout', onFocusOut)
    }
  }, [wrap, open])
}
