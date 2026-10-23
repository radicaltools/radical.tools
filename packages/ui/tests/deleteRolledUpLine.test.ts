/**
 * Delete on a rolled-up line (F-0055). A line drawn to a folded container,
 * or to an element the view shows for what it holds, stands for relations
 * of what lies inside: it is no relation of its own. Delete on it asked
 * "Delete 1 element?" with nothing counted, and Remove from model removed
 * nothing. It deletes the relations it stands for, and the prompt names
 * them.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'
import { deletePromptTitle } from '../src/components/DeleteConfirmDialog'

const s = useDiagramStore.getState
const node = (id: string, type: 'system' | 'container' | 'person', x: number, y: number, parentId?: string): C4Node =>
  ({ id, type, label: id, collapsed: false, x, y, ...NODE_SIZES[type], ...(parentId ? { parentId } : {}) } as C4Node)

function model(): DiagramData {
  return {
    nodes: [
      node('user', 'person', 0, 0),
      { ...node('shop', 'system', 400, 0), width: 700, height: 400 },
      node('web', 'container', 40, 120, 'shop'),
      node('api', 'container', 360, 120, 'shop'),
      node('kyc', 'system', 1400, 0),
    ],
    relations: [
      { id: 'r1', sourceId: 'user', targetId: 'web', label: 'browses' },
      { id: 'r2', sourceId: 'user', targetId: 'api', label: '' },
      { id: 'r3', sourceId: 'api', targetId: 'kyc', label: 'screens' },
    ],
    views: [{ id: 'ctx', name: 'Context', nodeIds: ['user', 'shop', 'kyc'], positions: {}, collapsedNodeIds: ['shop'] }],
  }
}

const line = (source: string, target: string) => s().rfEdges.find((e) => !e.hidden && e.source === source && e.target === target)!
const press = (id: string) => s().onEdgesChange([{ type: 'remove', id }])

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram(model())
  s().setActiveView('ctx')
})
afterEach(() => s().stopLiveLayout())

describe('Delete on a rolled-up line', () => {
  it('asks about the relation it stands for, named, and Remove from model removes it', () => {
    const shopToKyc = line('shop', 'kyc')
    expect(shopToKyc.data?.isVirtual).toBe(true)
    press(shopToKyc.id)
    expect(s().pendingDelete).toEqual({ nodeIds: [], edgeIds: ['r3'] })
    expect(deletePromptTitle(s().pendingDelete!, s().c4Nodes, s().c4Relations)).toBe('Delete relation "screens"?')
    s().resolvePendingDelete('model')
    expect(s().c4Relations.r3).toBeUndefined()
    expect(s().rfEdges.some((e) => !e.hidden && e.source === 'shop' && e.target === 'kyc')).toBe(false)
    s().undo()
    expect(s().c4Relations.r3).toBeDefined()
  })

  it('standing for two relations, names both and removes both', () => {
    press(line('user', 'shop').id)
    expect([...s().pendingDelete!.edgeIds].sort()).toEqual(['r1', 'r2'])
    expect(deletePromptTitle(s().pendingDelete!, s().c4Nodes, s().c4Relations)).toBe('Delete relations "browses" and "user → api"?')
    s().resolvePendingDelete('model')
    expect(Object.keys(s().c4Relations)).toEqual(['r3'])
  })
})

describe('Hide from current view on a line', () => {
  it('hides the relations it stands for from the view, and keeps them in the model', () => {
    press(line('shop', 'kyc').id)
    s().resolvePendingDelete('view')
    expect(s().c4Relations.r3).toBeDefined()
    expect(s().views.ctx.hiddenRelationIds).toEqual(['r3'])
    expect(s().rfEdges.some((e) => !e.hidden && e.source === 'shop' && e.target === 'kyc')).toBe(false)
    s().undo()
    expect(s().views.ctx.hiddenRelationIds ?? []).toEqual([])
  })
})
