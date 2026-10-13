import { describe, it, expect } from 'vitest'
import {
  builtInC4Metamodel, builtInGovernanceMetamodel, hasPlaceUnder, isParentAllowed, isPlacementAllowed, placeOf, validateModel,
} from '../src/metamodel'
import { checkAddNode, checkNodeUpdate, checkReparent, type ModelState } from '../src/model'
import type { C4Node } from '../src/c4'

describe('C4 containment', () => {
  for (const [name, mm] of [['c4', builtInC4Metamodel()], ['governance', builtInGovernanceMetamodel()]] as const) {
    it(`${name}: a group may sit inside a system, to group its parts`, () => {
      expect(isParentAllowed(mm, 'group', 'system')).toBe(true)
      // …and a component may then sit in that group: it is inside a system.
      expect(isParentAllowed(mm, 'component', 'group')).toBe(true)
    })

    it(`${name}: a group still may not sit inside a container or component`, () => {
      expect(isParentAllowed(mm, 'group', 'container')).toBe(false)
      expect(isParentAllowed(mm, 'group', 'component')).toBe(false)
    })
  }
})

// A group gives no place that an element could not have without it: what it
// may hold follows from where it stands (ADR "A group holds what its place
// allows").
describe('what a group may hold', () => {
  const mm = builtInGovernanceMetamodel()
  const node = (id: string, type: string, parentId?: string): C4Node =>
    ({ id, type: type as C4Node['type'], label: id, parentId, collapsed: false, x: 0, y: 0, width: 100, height: 60 })
  const nodes: Record<string, C4Node> = Object.fromEntries([
    node('top', 'group'),
    node('nested', 'group', 'top'),
    node('shop', 'system'),
    node('packages', 'group', 'shop'),
    node('inner', 'group', 'packages'),
    node('api', 'container', 'shop'),
  ].map((n) => [n.id, n]))
  const state = (): ModelState => ({
    c4Nodes: structuredClone(nodes), c4Relations: {}, sequences: {}, views: {}, activeViewId: null, metamodel: mm,
  } as unknown as ModelState)
  const allowed = (type: string, parent: string | undefined): boolean =>
    isPlacementAllowed(mm, type, parent ? nodes[parent] : undefined, nodes)

  it('at the top of the model: only what may be at the top', () => {
    for (const type of ['component', 'container', 'database', 'webapp', 'queue']) {
      expect(allowed(type, 'top'), type).toBe(false)
      expect(allowed(type, 'nested'), type).toBe(false)
    }
    for (const type of ['person', 'system', 'group', 'need', 'requirement', 'adr', 'domain']) {
      expect(allowed(type, 'top'), type).toBe(true)
      expect(allowed(type, 'nested'), type).toBe(true)
    }
  })

  it('inside a system: the parts of a system at any depth, and what a system may hold', () => {
    for (const type of ['container', 'component', 'database', 'webapp', 'queue', 'system', 'group', 'requirement', 'adr']) {
      expect(allowed(type, 'packages'), type).toBe(true)
      expect(allowed(type, 'inner'), type).toBe(true)
    }
    for (const type of ['person', 'domain']) expect(allowed(type, 'packages'), type).toBe(false)
  })

  it('anything but a group follows its allowed parents alone', () => {
    expect(allowed('component', 'api')).toBe(true)
    expect(allowed('component', 'shop')).toBe(false)
    expect(allowed('component', undefined)).toBe(false)
    expect(hasPlaceUnder(mm, 'component', 'system')).toBe(true)
    expect(hasPlaceUnder(mm, 'component', undefined)).toBe(false)
    expect(placeOf(nodes.inner, nodes)).toBe(nodes.shop)
    expect(placeOf(nodes.nested, nodes)).toBeUndefined()
  })

  it('refuses to add or move a component into a group at the top, and says why', () => {
    const s = state()
    expect(checkAddNode(s, { ...node('x', 'component', 'top'), id: undefined } as never)).toMatch(
      /Cannot place Component inside Group "top": the group is at the top of the model, where a Component has no place/,
    )
    expect(checkAddNode(s, { ...node('x', 'component', 'packages'), id: undefined } as never)).toBeNull()
    expect(checkAddNode(s, { ...node('x', 'requirement', 'top'), id: undefined } as never)).toBeNull()
    s.c4Nodes.lib = node('lib', 'component', 'packages')
    expect(checkReparent(s, ['lib'], 'top')).toMatch(/the group is at the top of the model/)
    expect(checkNodeUpdate(s, 'lib', { parentId: 'nested' })).toMatch(/the group is at the top of the model/)
    expect(checkReparent(s, ['lib'], 'inner')).toBeNull()
  })

  it('refuses to move a group to where what it holds has no place', () => {
    const s = state()
    s.c4Nodes.lib = node('lib', 'component', 'inner')
    expect(checkReparent(s, ['packages'], null)).toBe(
      'Cannot move Group "packages" there: its Component "lib" would have no place. A group holds only what its place allows.',
    )
    expect(checkNodeUpdate(s, 'packages', { parentId: 'top' })).toMatch(/its Component "lib" would have no place/)
    delete s.c4Nodes.lib
    expect(checkReparent(s, ['packages'], null)).toBeNull()
  })

  it('warns about an element a model already holds in such a group', () => {
    const held = { ...nodes, stray: node('stray', 'component', 'nested'), lib: node('lib', 'component', 'inner') }
    const issues = validateModel(held, {}, mm).filter((i) => i.id.startsWith('bad-place:'))
    expect(issues).toEqual([{
      id: 'bad-place:stray',
      severity: 'warning',
      message: 'Component "stray" is in group "nested", which is at the top of the model, where a Component has no place.',
      nodeId: 'stray',
    }])
  })
})
