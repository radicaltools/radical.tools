import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { shownExploration, useDiagramStore } from '../store/diagramStore'
import { type ExploreChoice, type ExploreLink, explorationLinks, menuRows } from '../store/exploration'
import { nodeControlAt } from './CollapseToggleMirror'

/** Distinct neighbours among `links`. */
const count = (links: ExploreLink[]): number => new Set(links.map((l) => l.id)).size

/** One row of the menu: relations of one kind one way, or containment. */
interface Row {
  id: string
  text: string
  note?: string
  n: number
  choice: ExploreChoice
}

/**
 * The menu of an exploration element's +, "Add to <name>": Show all, then
 * two columns, "<name> → others" (the relations that go out from it, last
 * "contains", its children) and "others → <name>" (those that come in,
 * last "contained in", its parent), each row with how many neighbours it
 * adds. A click on a row adds that row at once; the boxes and Show checked
 * add several. Beside the + on screen, following it. Opens focused on Show
 * all; arrows move (left and right between the columns), Space ticks,
 * Enter adds the row focused (the checked ones when any), Esc closes.
 */
export function ExploreMenu({ containerRef }: { containerRef: React.RefObject<HTMLDivElement> }): React.ReactElement | null {
  const nodeId = useDiagramStore((s) => s.exploreMenuFor)
  // The temporary exploration, or a view of type Explore.
  const exploration = useDiagramStore(shownExploration)
  const nodes = useDiagramStore((s) => s.c4Nodes)
  const relations = useDiagramStore((s) => s.c4Relations)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const openExploreMenu = useDiagramStore((s) => s.openExploreMenu)
  const exploreNeighbours = useDiagramStore((s) => s.exploreNeighbours)
  const [checked, setChecked] = useState<Set<string>>(() => new Set())
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const links = useMemo(() => (nodeId && exploration ? explorationLinks(exploration, nodes, relations).get(nodeId) ?? [] : []), [nodeId, exploration, nodes, relations])
  const columns = useMemo(() => {
    const textOf = (key: string): Pick<Row, 'text' | 'note'> => key === 'children' ? { text: 'Contains', note: '(children)' }
      : key === 'parent' ? { text: 'Contained in', note: '(parent)' }
      : key.startsWith('t:') ? { text: metamodel.relationTypes[key.slice(2)]?.label ?? key.slice(2) }
      : { text: key.slice(2) || 'relation' }
    const rows = menuRows(links)
    const named = (list: typeof rows.out): Row[] => list.map((r) => ({ id: r.id, n: r.n, choice: r.choice, ...textOf(r.key) }))
    return { out: named(rows.out), in: named(rows.in) }
  }, [links, metamodel])
  const allRows = [...columns.out, ...columns.in]

  // A new element's menu starts afresh.
  useEffect(() => { setChecked(new Set()) }, [nodeId])
  // Beside its + on screen: to its right, top-aligned, else to its left
  // or up, inside the canvas. It follows the + while open (the camera
  // centring a new exploration, a pan, a zoom).
  useLayoutEffect(() => {
    if (!nodeId) { setAt(null); return }
    let raf = 0
    let last = ''
    const place = (): void => {
      raf = requestAnimationFrame(place)
      const box = containerRef.current?.getBoundingClientRect()
      const pill = containerRef.current?.querySelector<HTMLElement>(`[data-explore-more="${CSS.escape(nodeId)}"]`)?.getBoundingClientRect()
      if (!box || !pill) return
      const width = menuRef.current?.offsetWidth ?? 320
      const height = menuRef.current?.offsetHeight ?? 200
      const GAP = 6
      let left = pill.right - box.left + GAP
      if (left + width > box.width - 8) left = pill.left - box.left - GAP - width
      let top = pill.top - box.top
      if (top + height > box.height - 8) top = pill.bottom - box.top - height
      left = Math.max(8, Math.min(left, box.width - width - 8))
      top = Math.max(8, Math.min(top, box.height - height - 8))
      const key = `${Math.round(left)},${Math.round(top)}`
      if (key !== last) { last = key; setAt({ left, top }) }
    }
    place()
    return () => cancelAnimationFrame(raf)
  }, [nodeId, containerRef])
  // Opens focused, on Show all (once it has a place).
  const placed = !!at
  useEffect(() => {
    if (nodeId && placed) menuRef.current?.querySelector<HTMLElement>('[data-col="top"]')?.focus()
  }, [nodeId, placed])
  // A click elsewhere closes it.
  useEffect(() => {
    if (!nodeId) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (menuRef.current?.contains(target) || target.closest?.('[data-explore-more]')) return
      // On the + under a relation's line: the click that follows is the
      // +'s (Canvas' onClickCapture), and closes the menu itself.
      if (nodeControlAt(containerRef.current, e.clientX, e.clientY)?.hasAttribute('data-explore-more')) return
      openExploreMenu(null)
    }
    window.addEventListener('mousedown', onDown, true)
    return () => window.removeEventListener('mousedown', onDown, true)
  }, [nodeId, openExploreMenu, containerRef])

  if (!nodeId || !exploration || !links.length) return null
  const label = nodes[nodeId]?.label ?? nodeId
  const close = (): void => {
    openExploreMenu(null)
    containerRef.current?.querySelector<HTMLElement>(`[data-explore-more="${CSS.escape(nodeId)}"]`)?.focus()
  }
  const toggle = (id: string): void => setChecked((was) => {
    const next = new Set(was)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const ticked = allRows.filter((r) => checked.has(r.id))
  const showChecked = (): void => {
    if (!ticked.length) return
    exploreNeighbours(nodeId, {
      rows: ticked.flatMap((r) => r.choice.rows ?? []),
      parent: ticked.some((r) => r.choice.parent),
      children: ticked.some((r) => r.choice.children),
    })
  }
  const focusAt = (col: string, idx: number): void => {
    menuRef.current?.querySelector<HTMLElement>(`[data-col="${col}"][data-idx="${idx}"]`)?.focus()
  }
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return }
    const el = document.activeElement as HTMLElement | null
    const col = el?.dataset.col
    const idx = Number(el?.dataset.idx ?? 0)
    const rowsOf = (c: string | undefined): Row[] => (c === 'L' ? columns.out : c === 'R' ? columns.in : [])
    const first = columns.out.length ? 'L' : 'R'
    const move = (to: string, i: number): void => { e.preventDefault(); focusAt(to, i) }
    if (e.key === 'ArrowDown') {
      if (col === 'top') return move(first, 0)
      if (col === 'L' || col === 'R') return idx + 1 < rowsOf(col).length ? move(col, idx + 1) : move('bottom', 0)
    } else if (e.key === 'ArrowUp') {
      if (col === 'bottom') return move(first, rowsOf(first).length - 1)
      if (col === 'L' || col === 'R') return idx > 0 ? move(col, idx - 1) : move('top', 0)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const to = e.key === 'ArrowLeft' ? 'L' : 'R'
      if ((col === 'L' || col === 'R') && col !== to && rowsOf(to).length) return move(to, Math.min(idx, rowsOf(to).length - 1))
    } else if (e.key === ' ' && (col === 'L' || col === 'R')) {
      e.preventDefault()
      toggle(rowsOf(col)[idx].id)
    } else if (e.key === 'Enter' && (col === 'L' || col === 'R')) {
      e.preventDefault()
      if (ticked.length) showChecked()
      else exploreNeighbours(nodeId, rowsOf(col)[idx].choice)
    }
  }
  const column = (rows: Row[], col: 'L' | 'R', title: string): React.ReactElement => (
    <div className="explore-menu-col" role="group" aria-label={title}>
      <div className="explore-menu-head">{title}</div>
      {rows.map((r, i) => (
        <div key={r.id} className="explore-menu-row">
          <input type="checkbox" tabIndex={-1} aria-label={`Check ${r.text}`} checked={checked.has(r.id)} onChange={() => toggle(r.id)} />
          <button type="button" role="menuitem" data-col={col} data-idx={i} className="explore-menu-add"
            title={`Add the ${r.n === 1 ? 'element' : `${r.n} elements`} joined to ${label} this way`}
            onClick={() => exploreNeighbours(nodeId, r.choice)}>
            <span>{r.text}{r.note && <span className="explore-menu-note"> {r.note}</span>}</span>
            <span className="explore-menu-count">{r.n}</span>
          </button>
        </div>
      ))}
    </div>
  )
  return (
    <div
      ref={menuRef}
      className="explore-menu nodrag nopan"
      role="menu"
      aria-label={`Add to ${label}`}
      style={{ left: at?.left ?? 0, top: at?.top ?? 0, visibility: at ? 'visible' : 'hidden' }}
      onKeyDown={onKeyDown}
    >
      <div className="explore-menu-title">Add to {label}</div>
      <button type="button" role="menuitem" data-col="top" data-idx={0} className="explore-menu-all" onClick={() => exploreNeighbours(nodeId)}>
        Show all {count(links)}
      </button>
      <div className="explore-menu-cols">
        {column(columns.out, 'L', `${label} → others`)}
        {column(columns.in, 'R', `others → ${label}`)}
      </div>
      <button type="button" role="menuitem" data-col="bottom" data-idx={0} className="explore-menu-show" disabled={!ticked.length} onClick={showChecked}>
        Show checked
      </button>
    </div>
  )
}
