/**
 * A node or relation type that elements still use is not deleted from the
 * metamodel. Studio deleted it without a word, leaving elements of an
 * "unknown type" behind; the MCP server refused the same deletion.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { C4Node } from '@radical/common/c4'
import { NODE_SIZES } from '@radical/common/c4'
import { useDiagramStore } from '../src/store/diagramStore'

const s = useDiagramStore.getState
const node = (id: string, type: string): C4Node =>
  ({ id, type, label: id, collapsed: false, x: 0, y: 0, ...NODE_SIZES.system } as C4Node)

const lastNotice = (): string | undefined => s().notifications[s().notifications.length - 1]?.message

beforeEach(() => {
  s().setAppMode('designer')
  s().loadDiagram({ nodes: [node('a', 'system'), node('b', 'system')], relations: [] })
  s().upsertNodeType({ id: 'gadget', label: 'Gadget', allowedParents: [], allowedAtRoot: true } as never)
  s().upsertRelationType({ id: 'feeds', label: 'Feeds', allowedPairs: [{ from: 'system', to: 'system' }] } as never)
})
afterEach(() => s().stopLiveLayout())

describe('Deleting a type from the metamodel', () => {
  it('is refused while an element is of that type, and says so', () => {
    useDiagramStore.setState((st) => ({ c4Nodes: { ...st.c4Nodes, g: node('g', 'gadget') } }))
    s().removeNodeType('gadget')
    expect(s().metamodel.nodeTypes.gadget).toBeDefined()
    expect(lastNotice()).toMatch(/1 element is still of type Gadget/)
  })

  it('is refused while a relation is of that type', () => {
    s().addRelation({ sourceId: 'a', targetId: 'b', relationType: 'feeds' })
    s().removeRelationType('feeds')
    expect(s().metamodel.relationTypes.feeds).toBeDefined()
    expect(lastNotice()).toMatch(/1 relation is still of type "Feeds"/)
  })

  it('is refused while a milestone holds an element or a relation of that type', () => {
    // Restore to live brought the element back, of an unknown type.
    useDiagramStore.setState((st) => ({ c4Nodes: { ...st.c4Nodes, g: node('g', 'gadget') } }))
    s().addRelation({ sourceId: 'a', targetId: 'b', relationType: 'feeds' })
    s().createSnapshot('As-is')
    s().removeNode('g')
    for (const id of Object.keys(s().c4Relations)) s().removeRelation(id)
    s().removeNodeType('gadget')
    expect(s().metamodel.nodeTypes.gadget).toBeDefined()
    expect(lastNotice()).toMatch(/the milestone "As-is" holds 1 element of type Gadget/)
    s().removeRelationType('feeds')
    expect(s().metamodel.relationTypes.feeds).toBeDefined()
    expect(lastNotice()).toMatch(/the milestone "As-is" holds 1 relation of type "Feeds"/)
  })

  it('counts the live model while a milestone is open', () => {
    s().createSnapshot('Empty')
    useDiagramStore.setState((st) => ({ c4Nodes: { ...st.c4Nodes, g: node('g', 'gadget') } }))
    s().selectMilestone(s().snapshots[0].id)
    expect(s().c4Nodes.g).toBeUndefined()
    s().removeNodeType('gadget')
    expect(s().metamodel.nodeTypes.gadget).toBeDefined()
    expect(lastNotice()).toMatch(/1 element is still of type Gadget/)
  })

  it('goes through when nothing uses the type', () => {
    s().removeNodeType('gadget')
    s().removeRelationType('feeds')
    expect(s().metamodel.nodeTypes.gadget).toBeUndefined()
    expect(s().metamodel.relationTypes.feeds).toBeUndefined()
  })
})
