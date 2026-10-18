import React, { useMemo } from 'react'
import { useDiagramStore } from '../store/diagramStore'
import { TYPE_LABELS } from '@radical/common/c4'
import type { PipelineContext } from '@radical/common/viewPipeline'
import { warnierRows, warnierTree, type WarnierNode } from '@radical/common/warnier'

// A view of kind `warnier`: what the view shows as a Warnier–Orr diagram,
// left to right, each element with what is under it in a brace. The tree
// comes from @radical/common/warnier; this draws it and selects on a click
// (the properties card opens on the selection).

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

function Item({ item, selectedId, onSelect, typeOf }: {
  item: WarnierNode
  selectedId: string | null
  onSelect: (id: string) => void
  typeOf: (type: string) => { label: string; color: string }
}): React.ReactElement {
  const { node } = item
  const type = typeOf(node.type)
  const operator = item.mode === 'sequence' ? null : OPERATORS[item.mode]
  return (
    <div className="wn-item">
      <button
        type="button"
        className={`wn-label${selectedId === node.id ? ' selected' : ''}`}
        style={{ ['--type-color' as string]: type.color }}
        data-node-id={node.id}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}
      >
        <span className="wn-type">{type.label}</span>
        <span className="wn-name">{node.label || 'Unnamed'}</span>
        {item.repeat && <span className="wn-repeat">{item.repeat}</span>}
        {item.condition && <span className="wn-condition">{item.condition}</span>}
        {item.alsoIn > 0 && <span className="wn-also" title={`Shown under ${item.alsoIn} other element${item.alsoIn === 1 ? '' : 's'} too`}>also elsewhere</span>}
      </button>
      {item.children.length > 0 && (
        <>
          <Brace />
          <div className="wn-children">
            {item.children.map((child, i) => (
              <React.Fragment key={child.key}>
                {i > 0 && operator && <div className="wn-operator" aria-label={operator.label} title={operator.label}>{operator.sign}</div>}
                <Item item={child} selectedId={selectedId} onSelect={onSelect} typeOf={typeOf} />
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
  const selectNode = useDiagramStore((s) => s.selectNode)

  const ctx = useMemo<PipelineContext>(() => ({ nodes, relations, metamodel }), [nodes, relations, metamodel])
  const tree = useMemo(() => warnierTree(warnierRows(activeView, ctx)), [activeView, ctx])
  const typeOf = useMemo(() => (type: string) => ({
    label: metamodel?.nodeTypes[type]?.label ?? TYPE_LABELS[type as keyof typeof TYPE_LABELS] ?? type,
    color: metamodel?.nodeTypes[type]?.color ?? '#64748b',
  }), [metamodel])

  return (
    <div className="warnier-view" aria-label="Warnier diagram" onClick={() => selectNode(null)}>
      {tree.length === 0 ? (
        <div className="wn-empty">
          Nothing to draw yet. Add a process with its steps, or set what the view shows in its Filter.
        </div>
      ) : (
        <div className="wn-roots">
          {tree.map((item) => <Item key={item.key} item={item} selectedId={selectedId} onSelect={selectNode} typeOf={typeOf} />)}
        </div>
      )}
    </div>
  )
}
