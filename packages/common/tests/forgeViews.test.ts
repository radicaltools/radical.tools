import { describe, expect, it } from 'vitest'
import { landscapeGridColumns, landscapeSlot, type C4Node, type DiagramData } from '../src/c4'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import { createModelFacade } from '../src/ai/modelFacade'
import {
  arrangeForgeGroup,
  fileIntoForgeViews,
  findForgeView,
  forgeArrangeGroups,
  forgeViewOf,
  outermostNodes,
} from '../src/ai/forge'

const node = (id: string, type: string, extra: Partial<C4Node> = {}): C4Node =>
  ({ id, type, label: id, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...extra }) as C4Node

function facadeOf(nodes: C4Node[], views: DiagramData['views'] = []) {
  let next = 0
  return createModelFacade({ nodes, relations: [], views, metamodel: builtInGovernanceMetamodel() }, { newId: () => `id${++next}` })
}

describe('landscapeSlot', () => {
  it('grows a block wider than tall without moving cells already handed out', () => {
    const cells = Array.from({ length: 12 }, (_, i) => landscapeSlot(i))
    expect(cells.slice(0, 8)).toEqual([
      { column: 0, row: 0 }, { column: 1, row: 0 },
      { column: 0, row: 1 }, { column: 1, row: 1 },
      { column: 2, row: 0 }, { column: 2, row: 1 },
      { column: 3, row: 0 }, { column: 3, row: 1 },
    ])
    // Twice as many columns as rows: the next cells start a new row.
    expect(cells.slice(8)).toEqual([0, 1, 2, 3].map((column) => ({ column, row: 2 })))
    expect(new Set(Array.from({ length: 50 }, (_, i) => JSON.stringify(landscapeSlot(i)))).size).toBe(50)
  })

  it('sizes a grid the same way', () => {
    expect([1, 2, 3, 4, 5, 12, 30].map(landscapeGridColumns)).toEqual([1, 2, 2, 2, 3, 4, 8])
  })
})

describe('Forge views', () => {
  it('maps node types to the four views, falling back to the stage', () => {
    expect(forgeViewOf('requirement')).toBe('conceptual')
    expect(forgeViewOf('state-machine')).toBe('states')
    expect(forgeViewOf('event', 'c4')).toBe('states')
    expect(forgeViewOf('group', 'states')).toBe('states')
    expect(forgeViewOf('mockup', 'c4')).toBe('conceptual')
    expect(forgeViewOf('fitness-fn')).toBe('governance')
    expect(forgeViewOf('container', 'c4')).toBe('logical')
    expect(forgeViewOf('blueprint', 'fitness')).toBe('governance')
  })

  it('files nodes into their views, creating a view only when it gets elements and reusing one by name', () => {
    const facade = facadeOf(
      [node('need', 'need'), node('r1', 'requirement'), node('f1', 'fitness-fn')],
      [{ id: 'mine', name: 'conceptual ', nodeIds: ['need'], positions: {} }],
    )
    const filed = fileIntoForgeViews(facade, ['need', 'r1', 'f1'], 'requirements')
    expect(filed).toEqual([
      { key: 'conceptual', viewId: 'mine', nodeIds: ['r1'] },
      { key: 'governance', viewId: 'id1', nodeIds: ['f1'] },
    ])
    const views = facade.getViews!()
    expect(views.mine.nodeIds).toEqual(['need', 'r1'])
    expect(views.id1).toMatchObject({ name: 'Governance', nodeIds: ['f1'] })
    expect(findForgeView(views, 'logical')).toBeUndefined()
    // Again: nothing new.
    expect(fileIntoForgeViews(facade, ['r1'], 'requirements')).toEqual([{ key: 'conceptual', viewId: 'mine', nodeIds: [] }])
  })

  it('arranges only the outermost new elements of each view', () => {
    const facade = facadeOf([
      node('sys', 'system'),
      node('api', 'container', { parentId: 'sys' }),
      node('web', 'webapp', { parentId: 'sys' }),
      node('user', 'person'),
      node('bank', 'system'),
    ])
    const added = ['sys', 'api', 'web', 'user', 'bank']
    expect(outermostNodes(facade.getNodes(), added)).toEqual(['sys', 'user', 'bank'])
    fileIntoForgeViews(facade, added, 'c4')
    const [group] = forgeArrangeGroups(facade, added, 'c4')
    expect(group).toMatchObject({ viewName: 'Logical & physical', nodeIds: ['sys', 'user', 'bank'] })

    expect(arrangeForgeGroup(facade, group, 'row')).toEqual({ ok: true, text: 'Logical & physical: 3 elements in a row.' })
    expect(facade.getLayoutConstraints!(group.viewId)).toEqual([
      { id: expect.any(String), type: 'align', axis: 'horizontal', nodeIds: ['sys', 'user', 'bank'], ordered: true },
    ])
    expect(arrangeForgeGroup(facade, group, 'row').ok).toBe(false)
  })

  it('makes a landscape grid', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `r${i}`)
    const facade = facadeOf(ids.map((id) => node(id, 'requirement')))
    fileIntoForgeViews(facade, ids, 'requirements')
    const [group] = forgeArrangeGroups(facade, ids, 'requirements')
    expect(arrangeForgeGroup(facade, group, 'grid')).toEqual({ ok: true, text: 'Conceptual: 12 elements in a grid of 4 columns.' })
    expect(facade.getLayoutConstraints!(group.viewId)[0]).toMatchObject({ type: 'grid', columns: 4, nodeIds: ids })
  })
})
