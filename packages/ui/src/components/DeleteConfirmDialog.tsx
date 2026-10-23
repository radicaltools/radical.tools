import React, { useEffect } from 'react'
import { hideRefusal, useDiagramStore } from '../store/diagramStore'
import type { C4Node, C4Relation } from '@radical/common/c4'
import { descendantIds, sequenceStepsRemovedBy } from '@radical/common/model'

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** The prompt's title: what is to be deleted, by name where it is one
 *  element or up to three relations (a rolled-up line stands for several),
 *  else counted. A relation with no label is named by its ends. */
export function deletePromptTitle(
  pending: { nodeIds: string[]; edgeIds: string[] },
  nodes: Record<string, C4Node>,
  relations: Record<string, C4Relation>,
): string {
  const nodeCount = pending.nodeIds.length
  const edgeCount = pending.edgeIds.length
  const firstNode = pending.nodeIds[0] ? nodes[pending.nodeIds[0]] : null
  const named = pending.edgeIds.map((id) => relations[id]).filter((r): r is C4Relation => !!r).map((r) =>
    `"${r.label || `${nodes[r.sourceId]?.label ?? '?'} → ${nodes[r.targetId]?.label ?? '?'}`}"`)
  const summary = nodeCount === 1 && edgeCount === 0 && firstNode ? `"${firstNode.label}"`
    : nodeCount === 0 && named.length === edgeCount && edgeCount > 0 && edgeCount <= 3
      ? `${edgeCount === 1 ? 'relation' : 'relations'} ${named.length === 1 ? named[0] : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`}`
      : [nodeCount ? plural(nodeCount, 'element', 'elements') : '', edgeCount ? plural(edgeCount, 'relation', 'relations') : ''].filter(Boolean).join(' and ')
  return `Delete ${summary}?`
}

/**
 * Confirmation modal that appears when the user presses Delete on the canvas.
 * Asks whether to remove the selected element(s) from the underlying model
 * (permanent) or just hide them from the currently active view.
 */
export function DeleteConfirmDialog(): React.ReactElement | null {
  const pending = useDiagramStore((s) => s.pendingDelete)
  const activeViewId = useDiagramStore((s) => s.activeViewId)
  const c4Nodes = useDiagramStore((s) => s.c4Nodes)
  const c4Relations = useDiagramStore((s) => s.c4Relations)
  const resolve = useDiagramStore((s) => s.resolvePendingDelete)
  // The steps of sequences that go with the relations deleted (D4).
  const steps = useDiagramStore((s) => (s.pendingDelete
    ? sequenceStepsRemovedBy(s as unknown as Parameters<typeof sequenceStepsRemovedBy>[0], s.pendingDelete.nodeIds, s.pendingDelete.edgeIds)
    : 0))
  // A view per element shows what its element holds, a view that lists
  // nothing what its filter gives: nothing is hidden from them.
  const refusal = useDiagramStore((s) => (s.activeViewId ? hideRefusal(s, s.activeViewId) : null))

  // Esc → cancel
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); resolve('cancel') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, resolve])

  if (!pending) return null
  const nodeCount = pending.nodeIds.length
  const edgeCount = pending.edgeIds.length
  if (nodeCount + edgeCount === 0) return null

  // What Remove from model takes: the elements with what lies inside them,
  // and every relation of any of them (the prompt counted the selection
  // only: "8 node(s) + 10 relation(s)" removed 10 and 30).
  const removedNodes = new Set<string>()
  for (const id of pending.nodeIds) {
    if (!c4Nodes[id]) continue
    removedNodes.add(id)
    for (const d of descendantIds(id, c4Nodes)) removedNodes.add(d)
  }
  const removedRelations = Object.values(c4Relations).filter((r) => pending.edgeIds.includes(r.id) || removedNodes.has(r.sourceId) || removedNodes.has(r.targetId)).length
  const removes = [removedNodes.size ? plural(removedNodes.size, 'element', 'elements') : '', removedRelations ? plural(removedRelations, 'relation', 'relations') : ''].filter(Boolean).join(' and ')

  // Relations alone are hidden from the view as the card's Hide from view
  // does (hiddenRelationIds), whatever the view shows of elements.
  const canHide = !!activeViewId && (nodeCount > 0 ? !refusal : edgeCount > 0)

  return (
    <div className="milestone-modal-backdrop" onClick={() => resolve('cancel')}>
      <div className="milestone-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="milestone-modal-title">{deletePromptTitle(pending, c4Nodes, c4Relations)}</h3>
        <p className="milestone-modal-text">
          Choose how to handle this delete request.
        </p>
        <div className="milestone-modal-options">
          <button className="milestone-option" onClick={() => resolve('model')}>
            <div className="milestone-option-title">Remove from model</div>
            <div className="milestone-option-desc">
              Permanently delete from the model (and from every view that
              references it): {removes}{removedNodes.size ? ', with what lies inside the elements and their relations' : ''}.
              {steps > 0 && (steps === 1 ? ' The sequence step along its relations goes too.' : ` ${steps} sequence steps along its relations go too.`)}
            </div>
          </button>
          <button
            className="milestone-option"
            disabled={!canHide}
            onClick={() => canHide && resolve('view')}
            style={canHide ? undefined : { opacity: 0.45, cursor: 'not-allowed' }}
          >
            <div className="milestone-option-title">
              Hide from current view{activeViewId ? '' : ' (no active view)'}
            </div>
            <div className="milestone-option-desc">
              {canHide
                ? nodeCount === 0
                  ? 'Keep the relation in the model — just hide it from the active view.'
                  : 'Keep the element in the model — just remove it from the active view.'
                : refusal === 'group'
                  ? 'A view per element shows everything its element holds; nothing can be hidden from it.'
                  : refusal === 'filter'
                    ? 'This view shows what its filter gives; change the filter to leave elements out.'
                    : 'Activate a view to be able to hide elements from it without deleting them.'}
            </div>
          </button>
          <button className="milestone-option ghost" onClick={() => resolve('cancel')}>
            <div className="milestone-option-title">Cancel</div>
            <div className="milestone-option-desc">Keep everything as it is.</div>
          </button>
        </div>
      </div>
    </div>
  )
}
