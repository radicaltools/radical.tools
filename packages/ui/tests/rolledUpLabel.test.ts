/**
 * The label of a rolled-up line (F-0078). A line drawn to a folded
 * container stands for several relations of what lies inside; its label
 * lists their names, one relation a line, and shows a technology only when
 * they all use it: the first relation's alone read as the whole line's.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node, DiagramData } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const node = (id: string, type: 'system' | 'container', x: number, y: number, parentId?: string): C4Node =>
  ({ id, type, label: id, collapsed: false, x, y, ...NODE_SIZES[type], ...(parentId ? { parentId } : {}) } as C4Node)

function model(techs: [string, string, string]): DiagramData {
  return {
    nodes: [
      { ...node('channels', 'system', 0, 0), width: 700, height: 400 },
      node('backoffice', 'container', 40, 120, 'channels'),
      node('mobile', 'container', 360, 120, 'channels'),
      node('web', 'container', 40, 300, 'channels'),
      node('core', 'system', 1400, 0),
    ],
    relations: [
      { id: 'r1', sourceId: 'backoffice', targetId: 'core', label: 'Admin API calls', technology: techs[0] },
      { id: 'r2', sourceId: 'mobile', targetId: 'core', label: 'API calls', technology: techs[1] },
      { id: 'r3', sourceId: 'web', targetId: 'core', label: 'API calls', technology: techs[2] },
    ],
    views: [{ id: 'ctx', name: 'Context', nodeIds: ['channels', 'core'], positions: {}, collapsedNodeIds: ['channels'] }],
  }
}

const line = () => s().rfEdges.find((e) => !e.hidden && e.source === 'channels' && e.target === 'core')!

afterEach(() => s().stopLiveLayout())

describe('A rolled-up line\'s label', () => {
  beforeEach(() => s().setAppMode('designer'))

  it('lists its relations one a line, with no technology when they use different ones', () => {
    s().loadDiagram(model(['HTTPS / Admin API', 'HTTPS / REST', 'HTTPS / REST']))
    s().setActiveView('ctx')
    expect(line().data?.label).toBe('Admin API calls\nAPI calls\nAPI calls')
    expect(line().data?.technology).toBeUndefined()
  })

  it('shows the technology they all use', () => {
    s().loadDiagram(model(['HTTPS / REST', 'HTTPS / REST', 'HTTPS / REST']))
    s().setActiveView('ctx')
    expect(line().data?.technology).toBe('HTTPS / REST')
  })
})
