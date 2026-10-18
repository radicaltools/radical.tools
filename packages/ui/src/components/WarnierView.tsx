import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDiagramStore } from '../store/diagramStore'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { TYPE_LABELS, nodeTypeSize, type C4ElementType, type C4Node } from '@radical/common/c4'
import { isPlacementAllowed } from '@radical/common/metamodel'
import { pipelineOf, type PipelineContext } from '@radical/common/viewPipeline'
import {
  flatten, insertPlan, locate, outlinePlan, warnierEditable, warnierRows, warnierTree,
  type OutlineMove, type WarnierNode,
} from '@radical/common/warnier'

// A view of kind `warnier`: what the view shows as a Warnier–Orr diagram,
// left to right, each element with what is under it in a brace. The tree
// comes from @radical/common/warnier; this draws it, selects on a click (the
// properties card opens on the selection), and in the Designer edits it like
// an outline where the tree is containment: a bar over the diagram and the
// keyboard add, indent, outdent, move, rename and delete, each one undo step.

/** A brace as tall as what it holds: fixed ends and point, lines between. */
function Brace(): React.ReactElement {
  return (
    <div className="wn-brace" aria-hidden>
      <svg width="14" height="8" viewBox="0 0 14 8"><path d="M12 1 C8.5 1 7 2.5 7 5.5 V8" /></svg>
      <div className="wn-brace-line" />
      <svg width="14" height="12" viewBox="0 0 14 12"><path d="M7 0 V1.5 C7 4.5 5.5 6 2 6 C5.5 6 7 7.5 7 10.5 V12" /></svg>
      <div className="wn-brace-line" />
      <svg width="14" height="8" viewBox="0 0 14 8"><path d="M7 0 V2.5 C7 5.5 8.5 7 12 7" /></svg>
    </div>
  )
}

const OPERATORS = { choice: { sign: '⊕', label: 'or' }, concurrent: { sign: '+', label: 'at the same time as' } } as const

interface ItemProps {
  item: WarnierNode
  selectedId: string | null
  renaming: { id: string; draft: string } | null
  onSelect: (id: string) => void
  onRename: (id: string) => void
  onDraft: (draft: string) => void
  onCommit: () => void
  onCancel: () => void
  typeOf: (type: string) => { label: string; color: string }
}

function Item(props: ItemProps): React.ReactElement {
  const { item, selectedId, renaming, onSelect, onRename, onDraft, onCommit, onCancel, typeOf } = props
  const { node } = item
  const type = typeOf(node.type)
  const operator = item.mode === 'sequence' ? null : OPERATORS[item.mode]
  const isRenaming = renaming?.id === node.id
  return (
    <div className="wn-item">
      <div
        role="button"
        tabIndex={0}
        className={`wn-label${selectedId === node.id ? ' selected' : ''}`}
        style={{ ['--type-color' as string]: type.color }}
        data-node-id={node.id}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}
        onDoubleClick={(e) => { e.stopPropagation(); onRename(node.id) }}
      >
        <span className="wn-type">{type.label}</span>
        {isRenaming ? (
          <input
            className="wn-name-input"
            aria-label="Name"
            autoFocus
            value={renaming.draft}
            onChange={(e) => onDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={onCommit}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') { e.preventDefault(); onCommit() }
              else if (e.key === 'Escape') { e.preventDefault(); onCancel() }
            }}
          />
        ) : (
          <span className="wn-name">{node.label || 'Unnamed'}</span>
        )}
        {item.repeat && <span className="wn-repeat">{item.repeat}</span>}
        {item.condition && <span className="wn-condition">{item.condition}</span>}
        {item.alsoIn > 0 && <span className="wn-also" title={`Shown under ${item.alsoIn} other element${item.alsoIn === 1 ? '' : 's'} too`}>also elsewhere</span>}
      </div>
      {item.children.length > 0 && (
        <>
          <Brace />
          <div className="wn-children">
            {item.children.map((child, i) => (
              <React.Fragment key={child.key}>
                {i > 0 && operator && <div className="wn-operator" aria-label={operator.label} title={operator.label}>{operator.sign}</div>}
                <Item {...props} item={child} />
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function WarnierView(): React.ReactElement {
  const nodes = useDiagramStore((s) => s.c4Nodes)
  const relations = useDiagramStore((s) => s.c4Relations)
  const metamodel = useDiagramStore((s) => s.metamodel)
  const activeView = useDiagramStore((s) => (s.activeViewId ? s.views[s.activeViewId] : undefined))
  const selectedId = useDiagramStore((s) => s.selectedNodeId)
  const readOnly = useDiagramStore((s) => s.appMode !== 'designer')
  const selectNode = useDiagramStore((s) => s.selectNode)
  const addNode = useDiagramStore((s) => s.addNode)
  const updateNode = useDiagramStore((s) => s.updateNode)
  const reparentNodes = useDiagramStore((s) => s.reparentNodes)
  const runAsOneStep = useDiagramStore((s) => s.runAsOneStep)
  const requestDelete = useDiagramStore((s) => s.requestDelete)

  const ctx = useMemo<PipelineContext>(() => ({ nodes, relations, metamodel }), [nodes, relations, metamodel])
  const tree = useMemo(() => warnierTree(warnierRows(activeView, ctx)), [activeView, ctx])
  const typeOf = useMemo(() => (type: string) => ({
    label: metamodel?.nodeTypes[type]?.label ?? TYPE_LABELS[type as keyof typeof TYPE_LABELS] ?? type,
    color: metamodel?.nodeTypes[type]?.color ?? '#64748b',
  }), [metamodel])
  const hasProperty = useCallback((type: string, key: string) => !!metamodel?.nodeTypes[type]?.properties?.some((p) => p.key === key), [metamodel])
  const hasOrder = useCallback((type: string) => hasProperty(type, 'order'), [hasProperty])

  // Structure edits only where the tree is containment; renaming everywhere.
  const structural = !readOnly && warnierEditable(activeView)
  const items = useMemo(() => flatten(tree), [tree])
  const selected = selectedId ? items.find((i) => i.node.id === selectedId) : undefined
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null)
  const root = useRef<HTMLDivElement>(null)

  // The selected element has the keyboard (after an edit, too).
  useEffect(() => {
    if (!selectedId || renaming) return
    // Not away from the properties card or another panel being typed in.
    const active = document.activeElement
    if (active && active !== document.body && !root.current?.contains(active)) return
    const el = root.current?.querySelector<HTMLElement>(`.wn-label[data-node-id="${CSS.escape(selectedId)}"]`)
    if (el && active !== el) el.focus()
  }, [selectedId, renaming, items])

  /** Writes the orders that differ from the model's. */
  const writeOrders = (orders: Record<string, number>) => {
    for (const [id, order] of Object.entries(orders)) {
      const current = (useDiagramStore.getState().c4Nodes[id] as unknown as Record<string, unknown> | undefined)?.order
      if (current !== order) updateNode(id, { order } as unknown as Partial<C4Node>)
    }
  }

  const move = (m: OutlineMove) => {
    if (!selected || !structural) return
    const plan = outlinePlan(tree, selected.key, m, hasOrder)
    if (!plan) return
    const id = selected.node.id
    runAsOneStep(() => {
      if (plan.parentId !== undefined) {
        reparentNodes([id], plan.parentId)
        // Refused (the metamodel's place rules): the store has said why.
        if ((useDiagramStore.getState().c4Nodes[id]?.parentId ?? null) !== plan.parentId) return
      }
      writeOrders(plan.orders)
    })
  }

  /** The type a new element inside `node` gets: what it holds already, a
   *  step in a process or step, else the first the view shows that fits. */
  const childTypeFor = (item: WarnierNode): string | null => {
    const fits = (type: string) => isPlacementAllowed(metamodel, type, item.node, nodes)
    const levelTypes = pipelineOf(activeView)?.levels?.[0]?.ways.flatMap((w) => w.types ?? []) ?? []
    const candidates = [...item.children.map((c) => c.node.type), 'step', ...levelTypes, ...Object.keys(metamodel?.nodeTypes ?? {})]
    return candidates.find((type) => !!metamodel?.nodeTypes[type] && fits(type) && (levelTypes.length === 0 || levelTypes.includes(type))) ?? null
  }

  const add = (where: 'after' | 'inside') => {
    if (!selected || !structural) return
    const type = where === 'after' ? selected.node.type : childTypeFor(selected)
    if (!type) return
    const plan = insertPlan(tree, selected.key, where, type, hasOrder)
    if (!plan) return
    const label = `New ${typeOf(type).label.toLowerCase()}`
    let created = ''
    runAsOneStep(() => {
      created = addNode({
        type: type as C4ElementType,
        label,
        collapsed: false,
        x: 0,
        y: 0,
        ...nodeTypeSize(type, metamodel),
        ...(plan.parentId ? { parentId: plan.parentId } : {}),
        ...(plan.order !== undefined ? { order: plan.order } : {}),
      } as unknown as Omit<C4Node, 'id'>)
      if (created) writeOrders(plan.orders)
    })
    if (!created) return
    selectNode(created)
    setRenaming({ id: created, draft: label })
  }

  const startRename = (id: string) => {
    if (readOnly) return
    selectNode(id)
    setRenaming({ id, draft: nodes[id]?.label ?? '' })
  }
  const commitRename = () => {
    if (!renaming) return
    const label = renaming.draft.trim()
    if (label && label !== nodes[renaming.id]?.label) updateNode(renaming.id, { label })
    setRenaming(null)
  }

  const setField = (key: string, value: string) => {
    if (selected && !readOnly) updateNode(selected.node.id, { [key]: value } as unknown as Partial<C4Node>)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (renaming || !selected) return
    const index = items.indexOf(selected)
    const handled = (() => {
      if (e.altKey && e.key === 'ArrowUp') { move('up'); return true }
      if (e.altKey && e.key === 'ArrowDown') { move('down'); return true }
      if (e.key === 'ArrowUp') { if (index > 0) selectNode(items[index - 1].node.id); return true }
      if (e.key === 'ArrowDown') { if (index < items.length - 1) selectNode(items[index + 1].node.id); return true }
      if (e.key === 'Tab') { if (structural) { move(e.shiftKey ? 'outdent' : 'indent'); return true } return false }
      if (e.key === 'Enter') { add('after'); return true }
      if (e.key === 'F2') { startRename(selected.node.id); return true }
      if ((e.key === 'Delete' || e.key === 'Backspace') && structural) { requestDelete([selected.node.id]); return true }
      if (e.key === 'Escape') { selectNode(null); return true }
      return false
    })()
    if (handled) { e.preventDefault(); e.stopPropagation() }
  }

  const can = selected && structural ? {
    up: !!outlinePlan(tree, selected.key, 'up', hasOrder),
    down: !!outlinePlan(tree, selected.key, 'down', hasOrder),
    indent: !!outlinePlan(tree, selected.key, 'indent', hasOrder),
    outdent: !!locate(tree, selected.key)?.parent,
    inside: !!childTypeFor(selected),
  } : null
  const field = (key: string) => (selected ? (selected.node as unknown as Record<string, unknown>)[key] : undefined)
  const optionsOf = (key: string) => (selected ? metamodel?.nodeTypes[selected.node.type]?.properties?.find((p) => p.key === key)?.options ?? [] : [])

  return (
    <div className="warnier-view" aria-label="Warnier diagram" ref={root} onKeyDown={onKeyDown} onClick={() => { if (!renaming) selectNode(null) }}>
      {can && selected && (
        <div className="wn-bar" role="toolbar" aria-label="Edit outline" onClick={(e) => e.stopPropagation()}>
          <span className="wn-bar-name">{selected.node.label || 'Unnamed'}</span>
          <button type="button" onClick={() => add('after')} title="Add after (Enter)">+ After</button>
          <button type="button" onClick={() => add('inside')} disabled={!can.inside} title="Add inside">+ Inside</button>
          <span className="wn-bar-sep" />
          <button type="button" onClick={() => move('outdent')} disabled={!can.outdent} aria-label="Outdent" title="Outdent (Shift+Tab)">⇤</button>
          <button type="button" onClick={() => move('indent')} disabled={!can.indent} aria-label="Indent" title="Indent (Tab)">⇥</button>
          <button type="button" onClick={() => move('up')} disabled={!can.up} aria-label="Move up" title="Move up (Alt+↑)">↑</button>
          <button type="button" onClick={() => move('down')} disabled={!can.down} aria-label="Move down" title="Move down (Alt+↓)">↓</button>
          {hasProperty(selected.node.type, 'repeat') && (
            <label className="wn-bar-field">Repeat
              <select aria-label="Repeat" value={String(field('repeat') ?? '1')} onChange={(e) => setField('repeat', e.target.value)}>
                {optionsOf('repeat').map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          )}
          {hasProperty(selected.node.type, 'children') && (
            <label className="wn-bar-field">Children
              <select aria-label="Children run" value={String(field('children') ?? 'sequence')} onChange={(e) => setField('children', e.target.value)}>
                {optionsOf('children').map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          )}
          <span className="wn-bar-sep" />
          <button type="button" className="danger" onClick={() => requestDelete([selected.node.id])} title="Delete (Delete)">Delete</button>
        </div>
      )}
      {tree.length === 0 ? (
        <div className="wn-empty">
          Nothing to draw yet. Add a process with its steps, or set what the view shows in its Filter.
        </div>
      ) : (
        <div className="wn-roots">
          {tree.map((item) => (
            <Item
              key={item.key}
              item={item}
              selectedId={selectedId}
              renaming={renaming}
              onSelect={(id) => { if (renaming && renaming.id !== id) commitRename(); selectNode(id) }}
              onRename={startRename}
              onDraft={(draft) => setRenaming((r) => (r ? { ...r, draft } : r))}
              onCommit={commitRename}
              onCancel={() => setRenaming(null)}
              typeOf={typeOf}
            />
          ))}
        </div>
      )}
      <DeleteConfirmDialog />
    </div>
  )
}
