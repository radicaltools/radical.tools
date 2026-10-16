import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useDiagramStore } from '../store/diagramStore'
import type { C4Node, C4ElementType } from '@radical/common/c4'
import { NODE_COLORS, NODE_FG, TYPE_LABELS, nodeTypeSize } from '@radical/common/c4'
import { addChoices, pipelineActive, pipelineOf, structureRows, viewShownNodes, type AddChoice, type ChainRow, type PipelineContext } from '@radical/common/viewPipeline'
import { WikiMenu, type WikiMenuPage } from './WikiMenu'
import { nodeSummary, nodeSummaryDetail } from '@radical/common/nodeSummary'
import { MarkdownText } from './MarkdownText'

// ─── Table view ──────────────────────────────────────────────────────────────
// Shows what the view's steps give (viewPipeline.ts, set in the Nodes panel)
// as a tree: the chain's levels — needs, the requirements under each, the
// scenarios under those — or, without a chain, the elements' containment.
// Each row is an element: its name, edited in place, with a guide line per
// level and its type beside it (a row with rows under it folds them away),
// and its summary: one line of inline Markdown its type's template makes of the data it has
// (nodeSummary.ts, set per type in the metamodel). Its fields are edited in the properties panel or its wizard, which the
// buttons at the end of the row open. It has no palette: elements are added
// where they will show, by a + row after the rows under each element (on
// the chain's next level, linked the way that level hangs under it) and one
// at the end of the table for the top level. A long table draws only the
// lines around what is scrolled into sight (useTableWindow).

interface EditCell {
  rowId: string
  draft: string
  /** What the cell held when it was opened. */
  initial: string
}

/** From this many lines on, the table draws only those near the scrolled
 *  part: a register of 750 requirements took a quarter of a second to open. */
const VIRTUAL_FROM = 200
/** Lines drawn beyond the visible part, in pixels, each way. */
const OVERSCAN_PX = 600

/** The lines of a long table to draw: those within the scrolled part of
 *  `wrap` and OVERSCAN_PX around it, and the height of the lines before and
 *  after them. Each line is as high as the drawn lines of its kind measure
 *  (a row is one line of text). `reveal` scrolls a line into sight. */
function useTableWindow(kinds: ReadonlyArray<'row' | 'add'>, wrap: React.RefObject<HTMLDivElement>, body: React.RefObject<HTMLTableSectionElement>) {
  const on = kinds.length >= VIRTUAL_FROM
  const [scroll, setScroll] = useState({ top: 0, height: 900 })
  const [heights, setHeights] = useState({ row: 33, add: 26 })

  useEffect(() => {
    const el = wrap.current
    if (!on || !el) return
    let frame = 0
    const read = () => { frame = 0; setScroll({ top: el.scrollTop, height: el.clientHeight }) }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read) }
    read()
    el.addEventListener('scroll', onScroll, { passive: true })
    const resize = new ResizeObserver(onScroll)
    resize.observe(el)
    return () => { el.removeEventListener('scroll', onScroll); resize.disconnect(); if (frame) cancelAnimationFrame(frame) }
  }, [on, wrap])

  // Each kind's height, as drawn. Set only when it changed: a state update
  // asked for on every commit, even one that changes nothing, counts towards
  // React's limit on nested updates while the window is moving.
  const heightsRef = useRef(heights)
  heightsRef.current = heights
  useLayoutEffect(() => {
    if (!on || !body.current) return
    const row = body.current.querySelector<HTMLElement>('tr.tv-row')?.getBoundingClientRect().height
    const add = body.current.querySelector<HTMLElement>('tr.tv-add-row')?.getBoundingClientRect().height
    const h = heightsRef.current
    const next = { row: row || h.row, add: add || h.add }
    // A pixel either way is rounding: taking it would move the window,
    // draw other lines and measure again, round and round.
    if (Math.abs(next.row - h.row) > 1 || Math.abs(next.add - h.add) > 1) setHeights(next)
  })

  // Where each line starts, from the top of the body.
  const offsets = useMemo(() => {
    if (!on) return [0]
    const out = new Array<number>(kinds.length + 1)
    out[0] = 0
    for (let i = 0; i < kinds.length; i++) out[i + 1] = out[i] + (kinds[i] === 'row' ? heights.row : heights.add)
    return out
  }, [on, kinds, heights])

  if (!on) return { on, start: 0, end: kinds.length, before: 0, after: 0, reveal: (_i: number) => {} }
  const firstAt = (y: number) => {
    let lo = 0, hi = kinds.length
    while (lo < hi) { const mid = (lo + hi) >> 1; if (offsets[mid + 1] <= y) lo = mid + 1; else hi = mid }
    return lo
  }
  const start = firstAt(Math.max(0, scroll.top - OVERSCAN_PX))
  const end = Math.min(kinds.length, firstAt(scroll.top + scroll.height + OVERSCAN_PX) + 1)
  const reveal = (i: number) => {
    const el = wrap.current
    if (!el || i < 0) return
    const head = el.querySelector('thead')?.getBoundingClientRect().height ?? 0
    const top = offsets[i], bottom = offsets[i + 1]
    if (top < el.scrollTop || bottom + head > el.scrollTop + el.clientHeight) el.scrollTop = Math.max(0, top - el.clientHeight / 3)
  }
  return { on, start, end, before: offsets[start], after: offsets[kinds.length] - offsets[end], reveal }
}

export function TableView(): React.ReactElement {
  const nodes            = useDiagramStore((s) => s.c4Nodes)
  const relations        = useDiagramStore((s) => s.c4Relations)
  const updateNode       = useDiagramStore((s) => s.updateNode)
  const selectNode       = useDiagramStore((s) => s.selectNode)
  const selectedNodeId   = useDiagramStore((s) => s.selectedNodeId)
  const activeView       = useDiagramStore((s) => s.activeViewId ? s.views[s.activeViewId] : undefined)
  const readOnly         = useDiagramStore((s) => s.appMode !== 'designer')
  const metamodel        = useDiagramStore((s) => s.metamodel)
  const requestCreateNode = useDiagramStore((s) => s.requestCreateNode)
  const pushNotification = useDiagramStore((s) => s.pushNotification)

  const [editCell, setEditCell]   = useState<EditCell | null>(null)
  const [addMenu, setAddMenu] = useState<{ at: { x: number; y: number }; root: WikiMenuPage } | null>(null)

  // The rows: the chain's tree; without a chain, the containment of what
  // the steps give (flat in their order when they set one).
  const pipeline = pipelineOf(activeView)
  const pipelineCtx = useMemo<PipelineContext>(() => ({ nodes, relations, metamodel }), [nodes, relations, metamodel])
  const allRows = useMemo<ChainRow[]>(() => structureRows(activeView, pipelineCtx), [activeView, pipelineCtx])

  // A row with rows under it folds them away.
  const [foldedRows, setFoldedRows] = useState<ReadonlySet<string>>(() => new Set())
  const toggleRowFold = useCallback((path: string) => {
    setFoldedRows((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])
  const rows = useMemo(() => {
    const folded = [...foldedRows]
    return folded.length ? allRows.filter((row) => !folded.some((p) => row.path.startsWith(p + '/'))) : allRows
  }, [allRows, foldedRows])

  const typeName = (type: string) => metamodel.nodeTypes[type]?.label ?? TYPE_LABELS[type as C4ElementType] ?? type

  // The rows and, where something can be added, a + row where it will show:
  // after the rows under each element that is not folded, and at the end.
  type Line = { kind: 'row'; row: ChainRow } | { kind: 'add'; under?: ChainRow; depth: number; choices: AddChoice[] }
  const lines = useMemo<Line[]>(() => {
    const out: Line[] = []
    const stack: ChainRow[] = []
    const close = (depth: number) => {
      while (stack.length && stack[stack.length - 1].depth >= depth) {
        const under = stack.pop()!
        if (foldedRows.has(under.path)) continue
        const choices = addChoices(activeView, pipelineCtx, { node: under.node, depth: under.depth })
        if (choices.length) out.push({ kind: 'add', under, depth: under.depth + 1, choices })
      }
    }
    for (const row of rows) {
      if (!readOnly) close(row.depth)
      out.push({ kind: 'row', row })
      stack.push(row)
    }
    if (!readOnly) {
      close(0)
      const top = addChoices(activeView, pipelineCtx)
      if (top.length) out.push({ kind: 'add', depth: 0, choices: top })
    }
    return out
  }, [rows, foldedRows, activeView, pipelineCtx, readOnly])

  // A long table draws only the lines near what is scrolled into sight; a
  // row the user goes to from elsewhere (a new element's name to write, the
  // element selected in Structure) is scrolled to.
  const wrapRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const kinds = useMemo(() => lines.map((l) => l.kind), [lines])
  const win = useTableWindow(kinds, wrapRef, bodyRef)
  const revealNode = win.reveal
  const lineOf = useCallback((id: string) => lines.findIndex((l) => l.kind === 'row' && l.row.node.id === id), [lines])
  const editRowId = editCell?.rowId
  useEffect(() => { if (editRowId) revealNode(lineOf(editRowId)) }, [editRowId, lineOf]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedNodeId) revealNode(lineOf(selectedNodeId)) }, [selectedNodeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // What a choice gets besides its type, in words: where it goes, the values
  // the filter asks for, and whether the filter will show it.
  const choiceHint = (c: AddChoice, under?: ChainRow) => [
    c.parentId && c.parentId !== under?.node.id && c.parentId !== under?.node.parentId ? `in ${nodes[c.parentId]?.label ?? c.parentId}` : '',
    ...Object.entries(c.properties ?? {}).filter(([, v]) => v).map(([k, v]) => `${metamodel.nodeTypes[c.type]?.properties?.find((p) => p.key === k)?.label ?? k}: ${v}`),
    c.hidden ? "the filter won't show it" : '',
  ].filter(Boolean).join(' · ')

  // A new element, named "New <type>" with its name open to be written
  // (a type with a wizard opens it instead), and the row it went under
  // unfolded.
  const add = (choice: AddChoice, underPath?: string) => {
    const label = `New ${typeName(choice.type)}`
    if (underPath) setFoldedRows((prev) => { const next = new Set(prev); next.delete(underPath); return next })
    const id = requestCreateNode({
      type: choice.type as C4ElementType,
      label,
      description: '',
      technology: '',
      collapsed: false,
      external: false,
      parentId: choice.parentId,
      x: 0,
      y: 0,
      ...nodeTypeSize(choice.type, metamodel),
      ...choice.properties,
    } as Omit<C4Node, 'id'>, {
      links: choice.link ? [choice.link] : [],
      onCreated: (created) => {
        selectNode(created)
        const s = useDiagramStore.getState()
        const view = s.activeViewId ? s.views[s.activeViewId] : undefined
        const shown = viewShownNodes(view, s.c4Nodes, s.c4Relations)
        if (shown && !shown.has(created)) pushNotification(`${s.c4Nodes[created]?.label ?? label} was added, but this view's filter does not show it.`, 'warning')
      },
    })
    if (id) setEditCell({ rowId: id, draft: label, initial: label })
  }

  // One choice is added at once; several open the menu of them.
  const onAdd = (e: React.MouseEvent, choices: AddChoice[], under?: ChainRow) => {
    e.stopPropagation()
    if (choices.length === 1) { add(choices[0], under?.path); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setAddMenu({
      at: { x: rect.left, y: rect.bottom + 4 },
      root: {
        items: choices.map((c) => ({
          id: `${c.type}|${c.link?.relationType ?? ''}|${c.link?.direction ?? ''}`,
          label: typeName(c.type),
          color: NODE_COLORS[c.type as C4ElementType] ?? metamodel.nodeTypes[c.type]?.color,
          hint: choiceHint(c, under) || undefined,
          group: c.group === 'Add' ? undefined : c.group,
          onSelect: () => add(c, under?.path),
        })),
        emptyHint: under ? `Nothing can be added under ${under.node.label}` : 'Nothing can be added here',
      },
    })
  }

  const commitEdit = useCallback(() => {
    if (!editCell) return
    const { rowId, draft, initial } = editCell
    // Left without a change, or emptied: nothing to save (no undo step that does nothing).
    if (draft.trim() && draft !== initial) updateNode(rowId, { label: draft.trim() } as Partial<C4Node>)
    setEditCell(null)
  }, [editCell, updateNode])

  const cancelEdit = useCallback(() => setEditCell(null), [])

  const startEdit = useCallback((rowId: string, current: string) => {
    if (readOnly) return
    setEditCell({ rowId, draft: current, initial: current })
  }, [readOnly])

  // A click on a row shows the element's attributes in the properties card
  // (brought back if ✕ hid it); a double-click on its name renames it here.
  const openProperties = (id: string) => {
    selectNode(id)
    ;(window as unknown as { __radicalExpandRightPanel?: () => void }).__radicalExpandRightPanel?.()
  }

  // Read only: it is made of several fields, edited in the properties panel or the wizard.
  function renderSummary(node: C4Node): React.ReactNode {
    const summary = nodeSummary(node, nodes, relations, metamodel)
    return (
      <span className="tv-cell-value tv-cell-summary" title={nodeSummaryDetail(node, nodes, relations, metamodel)}>
        {summary ? <MarkdownText inline text={summary} className="tv-summary-text" /> : <span className="tv-cell-placeholder">—</span>}
      </span>
    )
  }

  function renderName(row: ChainRow): React.ReactNode {
    const node = row.node

    const rawVal = node.label
    if (editCell?.rowId === node.id) {
      return (
        <input
          autoFocus
          type="text"
          className="tv-cell-input"
          value={editCell.draft}
          onChange={(e) => setEditCell({ ...editCell, draft: e.target.value })}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancelEdit()
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Tab') { e.preventDefault(); commitEdit() }
          }}
          onClick={(e) => e.stopPropagation()}
          onFocus={(e) => e.currentTarget.select()}
        />
      )
    }

    // The name, with the tree: a guide line per level above, the fold, the type.
    const folded = foldedRows.has(row.path)
    return (
      <span
        className="tv-cell-value tv-chain-cell"
        onDoubleClick={(e) => { e.stopPropagation(); startEdit(node.id, rawVal) }}
        title={readOnly ? rawVal : `${rawVal ? `${rawVal} · ` : ''}Double-click to rename`}
      >
        {Array.from({ length: row.depth }, (_, i) => <span key={i} className="tv-tree-guide" aria-hidden />)}
        {row.hasChildren ? (
          <button className={`tv-group-toggle${folded ? '' : ' open'}`} aria-expanded={!folded}
            aria-label={folded ? `Show what hangs under ${rawVal}` : `Fold what hangs under ${rawVal}`}
            onClick={(e) => { e.stopPropagation(); toggleRowFold(row.path) }}>
            <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden><path d="M5 3 L11 8 L5 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        ) : <span className="tv-group-toggle-space" />}
        <span className="tv-chain-type" style={{ background: NODE_COLORS[node.type] ?? metamodel.nodeTypes[node.type]?.color ?? '#555', color: NODE_FG[node.type] ?? '#fff' }}>
          {metamodel.nodeTypes[node.type]?.label ?? TYPE_LABELS[node.type] ?? node.type}
        </span>
        {rawVal || <span className="tv-cell-placeholder">{readOnly ? '—' : 'Double-click to name…'}</span>}
        {row.alsoIn > 0 && (
          <span className="tv-also-in" title={`Also under ${row.alsoIn} other element${row.alsoIn === 1 ? '' : 's'}`}>+{row.alsoIn}</span>
        )}
      </span>
    )
  }

  return (
    <div className="tv-wrap" onClick={() => setEditCell(null)}>
      <div className="tv-table-wrap" ref={wrapRef}>
        <table className="tv-table">
          <thead>
            <tr><th className="tv-th tv-th-name">Name</th><th className="tv-th">Summary</th></tr>
          </thead>
          <tbody ref={bodyRef}>
            {rows.length === 0 && (
              <tr>
                <td className="tv-empty" colSpan={2}>{pipelineActive(pipeline) ? "No elements pass the view's steps." : 'No nodes.'}</td>
              </tr>
            )}
            {win.before > 0 && <tr className="tv-spacer" aria-hidden style={{ height: win.before }}><td colSpan={2} /></tr>}
            {(win.on ? lines.slice(win.start, win.end) : lines).map((line) => line.kind === 'row' ? (
              <tr
                key={line.row.path}
                data-node-id={line.row.node.id}
                className={`tv-row tv-chain-row depth-${Math.min(line.row.depth, 3)}${selectedNodeId === line.row.node.id ? ' tv-row-selected' : ''}`}
                onClick={(e) => { e.stopPropagation(); openProperties(line.row.node.id) }}
              >
                <td className="tv-td">{renderName(line.row)}</td>
                <td className="tv-td">{renderSummary(line.row.node)}</td>
              </tr>
            ) : (
              <tr key={`${line.under?.path ?? ''}+`} className="tv-add-row">
                <td className="tv-td" colSpan={2}>
                  <button className="tv-add-btn"
                    aria-label={line.under ? `Add under ${line.under.node.label}` : 'Add at the top'}
                    onClick={(e) => onAdd(e, line.choices, line.under)}>
                    {Array.from({ length: line.depth }, (_, i) => <span key={i} className="tv-tree-guide" aria-hidden />)}
                    <span className="tv-group-toggle-space" />
                    <span className="tv-add-plus" aria-hidden>+</span>
                    {line.choices.length === 1 ? (
                      <>
                        <span>{typeName(line.choices[0].type)}</span>
                        {[line.choices[0].group === 'Add' || line.choices[0].group === 'Inside' ? '' : line.choices[0].group.toLowerCase(), choiceHint(line.choices[0], line.under)]
                          .filter(Boolean).map((h) => <span key={h} className="tv-add-hint">· {h}</span>)}
                      </>
                    ) : (
                      <span>{line.choices.length <= 3 ? line.choices.map((c) => typeName(c.type)).join(' / ') : 'Add element'}…</span>
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {win.after > 0 && <tr className="tv-spacer" aria-hidden style={{ height: win.after }}><td colSpan={2} /></tr>}
          </tbody>
        </table>
      </div>
      {/* A choice in the menu opens the new row's name: its click must not reach the table, which closes it. */}
      {addMenu && (
        <div onClick={(e) => e.stopPropagation()}>
          <WikiMenu at={addMenu.at} root={addMenu.root} onClose={() => setAddMenu(null)} />
        </div>
      )}
    </div>
  )
}
