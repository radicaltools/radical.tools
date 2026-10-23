/**
 * Viewer and Presenter do not edit (F-0037): the special key drew a line
 * there, a relation appeared and an element was nested, with notices, and
 * all of it was gone back in Designer. The store's relation and nesting
 * actions refuse outside Designer, whatever calls them.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node } from '@radical/common/c4'
import { builtInC4Metamodel } from '@radical/common/metamodel'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const node = (id: string, type: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label: id, collapsed: false, x: 0, y: 0, width: 200, height: 80, ...props } as C4Node)

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram({
    nodes: [node('shop', 'system'), node('web', 'webapp', { parentId: 'shop' }), node('api', 'container', { parentId: 'shop' }), node('other', 'system')],
    relations: [{ id: 'r1', sourceId: 'web', targetId: 'api' }],
    views: [],
    metamodel: builtInC4Metamodel(),
  })
})
afterEach(() => { s().setAppMode('designer'); s().stopLiveLayout() })

describe('outside Designer the model is not edited', () => {
  for (const mode of ['viewer', 'presenter'] as const) {
    it(`in ${mode}: no relation added, moved or removed, no element nested, no line started`, () => {
      s().setAppMode(mode)
      const before = { nodes: s().c4Nodes, relations: s().c4Relations }
      s().addRelation({ sourceId: 'api', targetId: 'other' })
      s().connectNodes('web', 'other')
      s().updateRelation('r1', { targetId: 'other' })
      s().moveRelationEnd('r1', { targetId: 'other' })
      s().removeRelation('r1')
      s().reparentNodes(['api'], 'other')
      s().startConnection('web')
      expect(s().c4Relations).toBe(before.relations)
      expect(s().c4Nodes).toBe(before.nodes)
      expect(s().connectSource).toBeNull()
      expect(s().relationTypeChoice).toBeFalsy()
      expect(s().notifications.filter((n) => /Moved|Removed/.test(n.message))).toEqual([])
    })
  }

  it('in Designer they edit', () => {
    s().addRelation({ sourceId: 'api', targetId: 'other' })
    s().reparentNodes(['web'], 'other')
    expect(Object.keys(s().c4Relations)).toHaveLength(2)
    expect(s().c4Nodes.web.parentId).toBe('other')
  })
})
