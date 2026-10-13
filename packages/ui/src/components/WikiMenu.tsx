import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ─── Menu of the wiki view ───────────────────────────────────────────────────
//
// One menu for everything that can be done with an element: it opens from
// the [edit] link beside a heading and from a right click on the element
// wherever a page or the list of pages names it. A choice that needs a
// second one (which type of child, which relation and with what) opens the
// next page of the same menu instead of a fly-out, so the menu works the
// same from a button and from a point under the pointer.

export interface WikiMenuItem {
  id: string
  label: string
  /** Quieter text after the label: the type of an element. */
  hint?: string
  /** A dot before the label, in the colour of a type. */
  color?: string
  danger?: boolean
  /** Items of one group follow each other under this heading. */
  group?: string
  /** A rule above the item. */
  separated?: boolean
  /** Runs and closes the menu. */
  onSelect?: () => void
  /** Opens the next page of the menu instead. */
  page?: () => WikiMenuPage
}

export interface WikiMenuPage {
  /** Shown beside the way back, on every page but the first. */
  title?: string
  items: WikiMenuItem[]
  /** Said when there is nothing to choose from. */
  emptyHint?: string
}

// From this many items a page gets a box to search them with.
const SEARCH_FROM = 9

export function WikiMenu({ at, root, onClose }: {
  /** Where the menu opens, in the window: it moves to stay inside it. With
   *  `alignRight`, `x` is where its right edge goes (under a button at the
   *  right of a page). */
  at: { x: number; y: number; alignRight?: boolean }
  root: WikiMenuPage
  onClose: () => void
}): React.ReactElement {
  const [pages, setPages] = useState<WikiMenuPage[]>([root])
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState<{ x: number; y: number }>(at)
  const ref = useRef<HTMLDivElement | null>(null)
  const page = pages[pages.length - 1]

  // Keep the menu inside the window, whichever page it shows.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const margin = 8
    const { width, height } = el.getBoundingClientRect()
    const left = at.alignRight ? at.x - width : at.x
    setPosition({
      x: Math.max(margin, Math.min(left, window.innerWidth - width - margin)),
      y: Math.max(margin, Math.min(at.y, window.innerHeight - height - margin)),
    })
  }, [at.x, at.y, at.alignRight, pages.length, query])

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      // Escape goes one page back before it closes the menu.
      if (pages.length > 1) {
        setPages((p) => p.slice(0, -1))
        setQuery('')
      } else {
        onClose()
      }
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onClose)
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose, pages.length])

  // A page opens with its search box in focus, or else its first item.
  useEffect(() => {
    const el = ref.current
    const target = el?.querySelector<HTMLElement>('.wiki-menu-search') ?? el?.querySelector<HTMLElement>('.wiki-menu-item')
    target?.focus()
  }, [pages.length])

  const searchable = page.items.length >= SEARCH_FROM
  const lower = query.trim().toLowerCase()
  const items = lower
    ? page.items.filter((i) => i.label.toLowerCase().includes(lower) || i.hint?.toLowerCase().includes(lower))
    : page.items

  const choose = (item: WikiMenuItem): void => {
    if (item.page) {
      setPages((p) => [...p, item.page!()])
      setQuery('')
      return
    }
    onClose()
    item.onSelect?.()
  }

  return createPortal(
    <div
      ref={ref}
      className="wiki-menu"
      role="menu"
      style={{ left: position.x, top: position.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {pages.length > 1 && (
        <button
          className="wiki-menu-back"
          onClick={() => {
            setPages((p) => p.slice(0, -1))
            setQuery('')
          }}
        >
          <span aria-hidden>‹</span> {page.title ?? 'Back'}
        </button>
      )}
      {searchable && (
        <input
          className="wiki-menu-search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className="wiki-menu-list">
        {items.length === 0 && <div className="wiki-menu-empty">{lower ? 'Nothing matches' : page.emptyHint ?? 'Nothing available'}</div>}
        {items.map((item, i) => (
          <React.Fragment key={item.id}>
            {item.separated && i > 0 && <div className="wiki-menu-rule" role="separator" />}
            {item.group && item.group !== items[i - 1]?.group && <div className="wiki-menu-group">{item.group}</div>}
            <button
              role="menuitem"
              className={`wiki-menu-item ${item.danger ? 'danger' : ''}`}
              onClick={() => choose(item)}
            >
              {item.color && <span className="wiki-menu-dot" style={{ background: item.color }} />}
              <span className="wiki-menu-label">{item.label}</span>
              {item.hint && <span className="wiki-menu-hint">{item.hint}</span>}
              {item.page && <span className="wiki-menu-more" aria-hidden>›</span>}
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>,
    document.body,
  )
}
