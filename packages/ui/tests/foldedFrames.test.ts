/**
 * A container a view does not show, drawn invisible only to hold what it
 * does (a frame), is never folded on that canvas. Bookstore folded on the
 * model, + New view → Components: the card said 3 nodes and the canvas
 * drew none, since every element under a folded ancestor was hidden, also
 * under one the view does not draw; Smart Layout saw nothing to arrange.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { C4Node, DiagramView } from '@radical/common/c4'
import { viewLayoutInput } from '@radical/layout/viewInput'
import { useDiagramStore } from '../src/store/diagramStore'

const s = () => useDiagramStore.getState()
const node = (id: string, type: C4Node['type'], x: number, y: number, parentId?: string, collapsed = false): C4Node =>
  ({ id, type, label: id, x, y, width: type === 'system' ? 900 : type === 'container' ? 400 : 200, height: type === 'system' ? 600 : type === 'container' ? 300 : 120, collapsed, ...(parentId ? { parentId } : {}) }) as C4Node
const nodes = [
  node('shop', 'system', 0, 0, undefined, true),
  node('web', 'container', 40, 120, 'shop'),
  node('api', 'component', 30, 110, 'web'),
  node('db', 'container', 460, 120, 'shop'),
  node('repo', 'component', 30, 110, 'db'),
]
const components: DiagramView = { id: 'cmp', name: 'Components', nodeIds: [], positions: {}, pipeline: { levels: [{ ways: [{ types: ['component'] }] }] } }
const folded: DiagramView = { id: 'sys', name: 'Shop', nodeIds: ['shop', 'web', 'api'], positions: {} }

beforeEach(() => {
  s().loadDiagram({ nodes, relations: [], views: [components, folded] })
  s().setAppMode('designer')
})

describe('a view whose filter leaves out a folded container', () => {
  it('draws what it shows inside it', () => {
    s().setActiveView('cmp')
    const shown = s().rfNodes.filter((n) => !n.hidden).map((n) => n.id).sort()
    expect(shown).toEqual(['api', 'repo'])
    const input = viewLayoutInput(s().views.cmp, s().c4Nodes, s().c4Relations)
    expect(input.nodes.shop.collapsed).toBe(false)
  })

  it('a view that shows the folded container keeps it folded', () => {
    s().setActiveView('sys')
    const shown = s().rfNodes.filter((n) => !n.hidden).map((n) => n.id).sort()
    expect(shown).toEqual(['shop'])
  })
})
