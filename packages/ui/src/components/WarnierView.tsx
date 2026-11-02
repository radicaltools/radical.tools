import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { otherModelViewShown, useDiagramStore } from '../store/diagramStore'
import { openCard, useShowRequest } from '../store/showInView'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { keepKeysHere } from './keysHere'
import { TYPE_LABELS, nodeTypeSize, type C4ElementType, type C4Node } from '@radical/common/c4'
import { isPlacementAllowed } from '@radical/common/metamodel'
import { newElementFilters, pipelineOf, viewShownNodes, type PipelineContext } from '@radical/common/viewPipeline'
import {
  flatten, insertPlan, locate, outlinePlan, warnierEditable, warnierRows, warnierTree,
  type OutlineMove, type WarnierMode, type WarnierNode,
} from '@radical/common/warnier'
import { editingControl } from './editingControl'

// A view of kind `warnier`: what the view shows as a Warnier–Orr diagram,
// left to right, each element with what is under it in a brace. The tree
// comes from @radical/common/warnier; this draws it, selects on a click (the
// properties card opens on the selection), and in the Designer edits it
// where it is drawn, as the table adds rows: a faint + under each brace, +
// beside an element with nothing under it, + Process under the processes; a
// click on a step's repetition mark opens its choices, a click on a brace or
// its ⊕ or + changes how the children run; the selected card, or the one
// under the pointer, has actions to move and delete it. The keyboard does
// the same. Each edit is one undo step.

const ICONS = {
  outdent: 'M7 4h6M7 8h6M7 12h6M5 6 3 8l2 2',
  indent: 'M7 4h6M7 8h6M7 12h6M3 6l2 2-2 2',
  up: 'M8 12.5v-9M4.5 7 8 3.5 11.5 7',
  down: 'M8 3.5v9M4.5 9 8 12.5 11.5 9',
  trash: 'M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.6 8h4.8l.6-8',
  repeat: 'M12.5 6.5A4.5 4.5 0 0 0 4 5.5M3.5 9.5A4.5 4.5 0 0 0 12 10.5M4 2.5v3h3M12 13.5v-3H9',
}

/** On a control's mousedown: keep the focus where it is. Pressed while a
 *  name is being typed, blurring the input first committed the name, the
 *  card shrank to its text and the control moved away from under the
 *  pointer, so the click hit nothing. The action commits the name itself. */
const keepFocus = (e: React.MouseEvent) => e.preventDefault()

function Icon({ d }: { d: string }): React.ReactElement {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
}

/** A brace as tall as what it holds: fixed ends and point, lines between. */
function BraceShape(): React.ReactElement {
  return (
    <>
      <svg width="14" height="8" viewBox="0 0 14 8"><path d="M12 1 C8.5 1 7 2.5 7 5.5 V8" /></svg>
      <span className="wn-brace-line" />
      <svg width="14" height="12" viewBox="0 0 14 12"><path d="M7 0 V1.5 C7 4.5 5.5 6 2 6 C5.5 6 7 7.5 7 10.5 V12" /></svg>
      <span className="wn-brace-line" />
      <svg width="14" height="8" viewBox="0 0 14 8"><path d="M7 0 V2.5 C7 5.5 8.5 7 12 7" /></svg>
    </>
  )
}

const OPERATORS = { choice: { sign: '⊕', label: 'or' }, concurrent: { sign: '+', label: 'at the same time as' } } as const
const MODES: WarnierMode[] = ['sequence', 'choice', 'concurrent']
const MODE_WORDS: Record<WarnierMode, string> = { sequence: 'in sequence', choice: 'one of them (⊕)', concurrent: 'at the same time (+)' }
/** The repetitions as a Warnier–Orr diagram writes them; the model keeps the values. */
const REPEATS: Array<[string, string]> = [['1', '1'], ['0..1', '(0,1)'], ['1..n', '(1,n)'], ['0..n', '(0,n)']]

/** What the view can do to an element; null where it only draws. */
interface Editing {
  structural: boolean
  childLabel: (item: WarnierNode) => string | null
  addInside: (item: WarnierNode) => void
  hasField: (type: string, key: string) => boolean
  cycleMode: (item: WarnierNode) => void
  repeatOpen: string | null
  openRepeat: (id: string | null) => void
  setFields: (id: string, fields: Record<string, string>) => void
  move: (item: WarnierNode, m: OutlineMove) => void
  canMove: (item: WarnierNode, m: OutlineMove) => boolean
  remove: (id: string) => void
}

interface ItemProps {
  item: WarnierNode
  selectedId: string | null
  renaming: { id: string; draft: string } | null
  onSelect: (id: string) => void
  onDraft: (draft: string) => void
  onCommit: () => void
  onCancel: () => void
  typeOf: (type: string) => { label: string; color: string }
  edit: Editing | null
}

/** Where a step's repetition and condition are chosen, under its card. */
function RepeatPopover({ node, onPick, onClose }: {
  node: C4Node
  onPick: (fields: Record<string, string>) => void
  onClose: () => void
}): React.ReactElement {
  const record = node as unknown as Record<string, unknown>
  const current = String(record.repeat ?? '1')
  const [condition, setCondition] = useState(String(record.condition ?? ''))
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [onClose])
  const saveCondition = () => { if (condition.trim() !== String(record.condition ?? '')) onPick({ condition: condition.trim() }) }
  return (
    <div className="wn-pop" ref={box} role="dialog" aria-label={`Repeat of ${node.label}`} onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { keepKeysHere(e); if (e.key === 'Escape') onClose() }}>
      <div className="wn-pop-row" role="group" aria-label="Repeat">
        {REPEATS.map(([value, mark]) => (
          <button key={value} type="button" className={value === current ? 'on' : ''} aria-pressed={value === current}
            onClick={() => onPick({ repeat: value })}>{mark}</button>
        ))}
      </div>
      <input
        className="wn-pop-input"
        aria-label="Condition"
        placeholder="for each…, while…, if…"
        value={condition}
        onChange={(e) => setCondition(e.target.value)}
        onBlur={saveCondition}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveCondition(); onClose() } }}
      />
    </div>
  )
}

function Item(props: ItemProps): React.ReactElement {
  const { item, selectedId, renaming, onSelect, onDraft, onCommit, onCancel, typeOf, edit } = props
  const { node } = item
  const type = typeOf(node.type)
  const operator = item.mode === 'sequence' ? null : OPERATORS[item.mode]
  const isRenaming = renaming?.id === node.id
  const selected = selectedId === node.id
  const hasRepeat = !!edit?.hasField(node.type, 'repeat')
  const modeEditable = !!edit && edit.structural && edit.hasField(node.type, 'children')
  const childLabel = edit?.structural ? edit.childLabel(item) : null
  const name = node.label || 'Unnamed'
  const modeTitle = `Steps inside run ${MODE_WORDS[item.mode]}${modeEditable ? ' — click to change' : ''}`
  const cycle = (e: React.MouseEvent) => { e.stopPropagation(); edit?.cycleMode(item) }
  const toggleRepeat = (e: React.MouseEvent) => { e.stopPropagation(); onSelect(node.id); edit?.openRepeat(edit.repeatOpen === node.id ? null : node.id) }
  const action = (m: OutlineMove, label: string, icon: string) => (
    <button type="button" aria-label={label} title={label} disabled={!edit?.canMove(item, m)} onMouseDown={keepFocus}
      onClick={(e) => { e.stopPropagation(); onSelect(node.id); edit?.move(item, m) }}><Icon d={icon} /></button>
  )
  return (
    <div className="wn-item">
      <div className={`wn-node${selected ? ' selected' : ''}`}>
        <div
          role="button"
          tabIndex={0}
          className={`wn-label${selected ? ' selected' : ''}`}
          style={{ ['--type-color' as string]: type.color }}
          // Its own name: read from its content it took in the repetition button's.
          aria-label={`${type.label} ${name}`}
          data-node-id={node.id}
          onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}
          // A double-click opens its properties card; F2 renames it.
          onDoubleClick={(e) => { e.stopPropagation(); onSelect(node.id); openCard() }}
        >
          <span className="wn-head">
            <span className="wn-type">{type.label}</span>
            {edit?.structural && (
              <span {...editingControl} className="wn-actions" role="group" aria-label={`Actions of ${name}`}>
                {hasRepeat && (
                  <button type="button" aria-label={`Set the repeat of ${name}`} title="How often it happens, and for what"
                    onMouseDown={keepFocus} onClick={toggleRepeat}><Icon d={ICONS.repeat} /></button>
                )}
                {action('up', 'Move up', ICONS.up)}
                {action('down', 'Move down', ICONS.down)}
                {action('outdent', 'Outdent', ICONS.outdent)}
                {action('indent', 'Indent', ICONS.indent)}
                <button type="button" className="danger" aria-label="Delete" title="Delete" onMouseDown={keepFocus}
                  onClick={(e) => { e.stopPropagation(); onSelect(node.id); edit.remove(node.id) }}><Icon d={ICONS.trash} /></button>
              </span>
            )}
          </span>
          {isRenaming ? (
            <input
              className="wn-name-input"
              aria-label="Name"
              autoFocus
              value={renaming.draft}
              onChange={(e) => onDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.currentTarget.select()}
              // The question how to save a milestone, opened by its first
              // edit (this element added), takes the focus while it is
              // answered and gives it back: the name stays open. Kept on
              // that blur, it closed, and what was typed next was lost.
              onBlur={() => { if (!useDiagramStore.getState().milestonePromptOpen) onCommit() }}
              onKeyDown={(e) => {
                keepKeysHere(e)
                if (e.key === 'Enter') { e.preventDefault(); onCommit() }
                else if (e.key === 'Escape') { e.preventDefault(); onCancel() }
              }}
            />
          ) : (
            <span className="wn-name">{name}</span>
          )}
          {hasRepeat && item.repeat ? (
            <button type="button" className="wn-repeat wn-repeat-btn" aria-label={`Repeat of ${name}`}
              title="How often it happens, and for what — click to change" onMouseDown={keepFocus} onClick={toggleRepeat}>
              {item.repeat}
            </button>
          ) : item.repeat && <span className="wn-repeat">{item.repeat}</span>}
          {item.condition && <span className="wn-condition">{item.condition}</span>}
          {item.alsoIn > 0 && <span className="wn-also" title={`Shown under ${item.alsoIn} other element${item.alsoIn === 1 ? '' : 's'} too`}>also elsewhere</span>}
        </div>
        {edit && edit.repeatOpen === node.id && (
          <RepeatPopover node={node} onPick={(fields) => edit.setFields(node.id, fields)} onClose={() => edit.openRepeat(null)} />
        )}
        {item.children.length === 0 && childLabel && (
          <button type="button" {...editingControl} className="wn-add-first" aria-label={`Add a ${childLabel.toLowerCase()} inside ${name}`}
            title={`Add a ${childLabel.toLowerCase()} inside it`} onMouseDown={keepFocus} onClick={(e) => { e.stopPropagation(); edit?.addInside(item) }}>+</button>
        )}
      </div>
      {item.children.length > 0 && (
        <>
          {modeEditable ? (
            <button type="button" className="wn-brace" aria-label={modeTitle} title={modeTitle} onMouseDown={keepFocus} onClick={cycle}><BraceShape /></button>
          ) : (
            <div className="wn-brace" aria-hidden><BraceShape /></div>
          )}
          <div className="wn-children">
            {item.children.map((child, i) => (
              <React.Fragment key={child.key}>
                {i > 0 && operator && (modeEditable
                  ? <button type="button" className="wn-operator" aria-label={modeTitle} title={modeTitle} onMouseDown={keepFocus} onClick={cycle}>{operator.sign}</button>
                  : <div className="wn-operator" aria-label={operator.label} title={operator.label}>{operator.sign}</div>)}
                <Item {...props} item={child} />
              </React.Fragment>
            ))}
            {childLabel && (
              <button type="button" {...editingControl} className="wn-add" aria-label={`Add a ${childLabel.toLowerCase()} to ${name}`} onMouseDown={keepFocus}
                onClick={(e) => { e.stopPropagation(); edit?.addInside(item) }}>+ {childLabel}</button>
            )}
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
  // Read-only out of Designer, and on a slide played from it (F5).
  const readOnly = useDiagramStore((s) => s.appMode !== 'designer' || s.presentationActive || !!otherModelViewShown(s))
  const selectNode = useDiagramStore((s) => s.selectNode)
  const addNode = useDiagramStore((s) => s.addNode)
  const updateNode = useDiagramStore((s) => s.updateNode)
  const reparentNodes = useDiagramStore((s) => s.reparentNodes)
  const runAsOneStep = useDiagramStore((s) => s.runAsOneStep)
  const requestDelete = useDiagramStore((s) => s.requestDelete)
  const deleting = useDiagramStore((s) => !!s.pendingDelete)
  const pushNotification = useDiagramStore((s) => s.pushNotification)

  // The element whose name is being written; `added` when it was just
  // added: drawn where it goes even when the filter leaves it out, until
  // its name is written (which may let it through).
  const [renaming, setRenaming] = useState<{ id: string; draft: string; added?: true } | null>(null)
  const naming = renaming?.added ? renaming.id : undefined
  const ctx = useMemo<PipelineContext>(() => ({ nodes, relations, metamodel }), [nodes, relations, metamodel])
  const tree = useMemo(() => warnierTree(warnierRows(activeView, ctx, naming)), [activeView, ctx, naming])
  const typeOf = useMemo(() => (type: string) => ({
    label: metamodel?.nodeTypes[type]?.label ?? TYPE_LABELS[type as keyof typeof TYPE_LABELS] ?? type,
    color: metamodel?.nodeTypes[type]?.color ?? '#64748b',
  }), [metamodel])
  const hasField = useCallback((type: string, key: string) => !!metamodel?.nodeTypes[type]?.properties?.some((p) => p.key === key), [metamodel])
  const hasOrder = useCallback((type: string) => hasField(type, 'order'), [hasField])

  // Structure edits only where the tree is containment; renaming everywhere.
  const structural = !readOnly && warnierEditable(activeView)
  // A view of one element (a view per element) draws it and what lies in
  // it: whatever is added or moved stays inside it, or the view would not
  // draw it.
  const subject = activeView?.subject
  const withinSubject = (parentId: string | null | undefined): boolean => {
    if (!subject) return true
    for (let id = parentId ?? undefined, seen = 0; id && seen < 64; id = nodes[id]?.parentId, seen++) if (id === subject) return true
    return false
  }
  const items = useMemo(() => flatten(tree), [tree])
  const selected = selectedId ? items.find((i) => i.node.id === selectedId) : undefined
  const [repeatOpen, setRepeatOpen] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)

  // The selected element has the keyboard (after an edit, too).
  useEffect(() => {
    if (!selectedId || renaming || repeatOpen) return
    // Not away from the properties card or another panel being typed in.
    const active = document.activeElement
    if (active && active !== document.body && !root.current?.contains(active)) return
    const el = root.current?.querySelector<HTMLElement>(`.wn-label[data-node-id="${CSS.escape(selectedId)}"]`)
    if (el && active !== el) el.focus()
  }, [selectedId, renaming, repeatOpen, items])
  // And is in sight, also when the keyboard stays where it was (the card's
  // Views, Quick Search).
  const showSeq = useShowRequest((r) => r.seq)
  useEffect(() => {
    if (!selectedId) return
    root.current?.querySelector<HTMLElement>(`.wn-label[data-node-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedId, activeView?.id, showSeq])

  /** Writes the orders that differ from the model's. */
  const writeOrders = (orders: Record<string, number>) => {
    for (const [id, order] of Object.entries(orders)) {
      const current = (useDiagramStore.getState().c4Nodes[id] as unknown as Record<string, unknown> | undefined)?.order
      if (current !== order) updateNode(id, { order } as unknown as Partial<C4Node>)
    }
  }

  const move = (item: WarnierNode, m: OutlineMove) => {
    if (!structural) return
    commitRename()
    const plan = outlinePlan(tree, item.key, m, hasOrder)
    if (!plan || (plan.parentId !== undefined && !withinSubject(plan.parentId))) return
    const id = item.node.id
    runAsOneStep(() => {
      if (plan.parentId !== undefined) {
        reparentNodes([id], plan.parentId, { quiet: true })
        // Refused (the metamodel's place rules): the store has said why.
        if ((useDiagramStore.getState().c4Nodes[id]?.parentId ?? null) !== plan.parentId) return
      }
      writeOrders(plan.orders)
    })
  }
  const canMove = (item: WarnierNode, m: OutlineMove) => {
    if (!structural) return false
    if (m !== 'outdent') {
      const plan = outlinePlan(tree, item.key, m, hasOrder)
      return !!plan && (plan.parentId === undefined || withinSubject(plan.parentId))
    }
    const parent = locate(tree, item.key)?.parent
    return !!parent && withinSubject(parent.node.parentId)
  }

  /** The type a new element inside `node` gets: what it holds already, a
   *  step in a process or step, else the first the view shows that fits. */
  const childTypeFor = (item: WarnierNode): string | null => {
    const fits = (type: string) => isPlacementAllowed(metamodel, type, item.node, nodes)
    const levelTypes = pipelineOf(activeView)?.levels?.[0]?.ways.flatMap((w) => w.types ?? []) ?? []
    const candidates = [...item.children.map((c) => c.node.type), 'step', ...levelTypes, ...Object.keys(metamodel?.nodeTypes ?? {})]
    return candidates.find((type) => !!metamodel?.nodeTypes[type] && fits(type) && (levelTypes.length === 0 || levelTypes.includes(type))) ?? null
  }

  /** A new element, its name open: `where` the item, of `type`. */
  const insert = (item: WarnierNode, where: 'after' | 'inside', type: string | null) => {
    if (!structural || !type) return
    commitRename()
    const plan = insertPlan(tree, item.key, where, type, hasOrder)
    if (!plan || !withinSubject(plan.parentId)) return
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
        // The values the view's filter asks for, as the table gives them.
        ...newElementFilters(activeView, ctx, type)?.properties,
        ...(plan.parentId ? { parentId: plan.parentId } : {}),
        ...(plan.order !== undefined ? { order: plan.order } : {}),
      } as unknown as Omit<C4Node, 'id'>)
      if (created) writeOrders(plan.orders)
    })
    if (!created) return
    selectNode(created)
    setRenaming({ id: created, draft: label, added: true })
  }

  /** A process at the top, after the ones there are, its name open. */
  const canAddProcess = !readOnly && !!metamodel?.nodeTypes.process && warnierEditable(activeView) && !subject
    && (() => {
      const types = pipelineOf(activeView)?.levels?.[0]?.ways.flatMap((w) => w.types ?? []) ?? []
      return types.length === 0 || types.includes('process')
    })()
  const addProcess = () => {
    if (!canAddProcess) return
    commitRename()
    const roots = tree.filter((item) => item.node.type === 'process').length
    const label = `New ${typeOf('process').label.toLowerCase()}`
    // In the element a filter "inside" asks for (it went to the top of the
    // model, where the view did not show it), with the values the filters ask.
    const filtered = newElementFilters(activeView, ctx, 'process')
    let created = ''
    runAsOneStep(() => {
      created = addNode({
        type: 'process' as C4ElementType, label, collapsed: false, x: 0, y: 0,
        ...nodeTypeSize('process', metamodel), ...(hasOrder('process') ? { order: roots + 1 } : {}),
        ...filtered?.properties,
        ...(filtered?.within ? { parentId: filtered.within } : {}),
      } as unknown as Omit<C4Node, 'id'>)
    })
    if (!created) return
    selectNode(created)
    setRenaming({ id: created, draft: label, added: true })
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
    if (renaming.added) warnIfHidden(renaming.id)
  }
  const cancelRename = () => {
    if (!renaming) return
    setRenaming(null)
    if (renaming.added) warnIfHidden(renaming.id)
  }
  /** Says so when the filter does not show an element just added and named,
   *  as the table does: it is there, in the model, but not here. */
  const warnIfHidden = (id: string) => {
    const s = useDiagramStore.getState()
    const node = s.c4Nodes[id]
    const view = s.activeViewId ? s.views[s.activeViewId] : undefined
    const shown = viewShownNodes(view, s.c4Nodes, s.c4Relations)
    if (node && shown && !shown.has(id)) pushNotification(`${node.label} was added, but this view's filter does not show it.`, 'warning')
  }

  const edit: Editing | null = readOnly ? null : {
    structural,
    childLabel: (item) => { const type = childTypeFor(item); return type ? typeOf(type).label : null },
    addInside: (item) => insert(item, 'inside', childTypeFor(item)),
    hasField,
    cycleMode: (item) => {
      commitRename()
      const next = MODES[(MODES.indexOf(item.mode) + 1) % MODES.length]
      updateNode(item.node.id, { children: next } as unknown as Partial<C4Node>)
    },
    repeatOpen,
    openRepeat: (id) => { if (id) commitRename(); setRepeatOpen(id) },
    setFields: (id, fields) => updateNode(id, fields as unknown as Partial<C4Node>),
    move,
    canMove,
    remove: (id) => { commitRename(); requestDelete([id]) },
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    // The delete prompt and the repeat choices have the keys.
    if (renaming || !selected || deleting || repeatOpen) return
    // A playing slide's keys are the presentation's: Esc only deselected,
    // and the arrows moved the selection instead of the slides.
    if (useDiagramStore.getState().presentationActive) return
    const index = items.indexOf(selected)
    const handled = (() => {
      if (e.altKey && e.key === 'ArrowUp') { move(selected, 'up'); return true }
      if (e.altKey && e.key === 'ArrowDown') { move(selected, 'down'); return true }
      if (e.key === 'ArrowUp') { if (index > 0) selectNode(items[index - 1].node.id); return true }
      if (e.key === 'ArrowDown') { if (index < items.length - 1) selectNode(items[index + 1].node.id); return true }
      if (e.key === 'Tab') { if (structural) { move(selected, e.shiftKey ? 'outdent' : 'indent'); return true } return false }
      if (e.key === 'Enter') {
        // The element a view of one element is of has nothing after it
        // there: Enter adds its last step, as + Step under its brace does.
        if (selected.node.id === subject) insert(selected, 'inside', childTypeFor(selected))
        else insert(selected, 'after', selected.node.type)
        return true
      }
      if (e.key === 'F2') { startRename(selected.node.id); return true }
      if ((e.key === 'Delete' || e.key === 'Backspace') && structural) { requestDelete([selected.node.id]); return true }
      if (e.key === 'Escape') { selectNode(null); return true }
      return false
    })()
    if (handled) { e.preventDefault(); e.stopPropagation() }
  }

  return (
    <div className="warnier-view" aria-label="Warnier diagram" ref={root} onKeyDown={onKeyDown}
      onClick={() => { if (!renaming) { selectNode(null); setRepeatOpen(null) } }}>
      {tree.length === 0 ? (
        <div className="wn-empty">
          {canAddProcess ? (
            <>
              <p>No process yet.</p>
              <button type="button" {...editingControl} className="wn-empty-add" onClick={(e) => { e.stopPropagation(); addProcess() }}>+ Process</button>
            </>
          ) : 'Nothing to draw yet. Add a process with its steps, or set what the view shows in its Filter.'}
        </div>
      ) : (
        <div className="wn-roots">
          {tree.map((item) => (
            <Item
              key={item.key}
              item={item}
              selectedId={selectedId}
              renaming={renaming}
              onSelect={(id) => { if (renaming && renaming.id !== id) commitRename(); if (repeatOpen && repeatOpen !== id) setRepeatOpen(null); selectNode(id) }}
              onDraft={(draft) => setRenaming((r) => (r ? { ...r, draft } : r))}
              onCommit={commitRename}
              onCancel={cancelRename}
              typeOf={typeOf}
              edit={edit}
            />
          ))}
          {canAddProcess && (
            <button type="button" {...editingControl} className="wn-add wn-add-root" onMouseDown={keepFocus} onClick={(e) => { e.stopPropagation(); addProcess() }}>+ Process</button>
          )}
        </div>
      )}
      <DeleteConfirmDialog />
    </div>
  )
}
