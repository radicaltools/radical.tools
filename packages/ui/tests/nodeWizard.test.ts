/**
 * Node wizard store tests.
 *
 * Covers requestCreateNode / openNodeWizard / finishNodeWizard /
 * cancelNodeWizard:
 *   - a type with a create-time wizard opens a session instead of creating
 *   - types without one (or with wizards turned off) are created at once
 *   - finishing creates the node with its values and links as one undo step
 *   - cancelling creates nothing and never calls onCreated
 *   - edit mode patches only changed values and adds/removes links
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDiagramStore } from '../src/store/diagramStore'
import { saveStudioSettings, defaultStudioSettings } from '../src/studioSettings'
import { builtInGovernanceMetamodel } from '@radical/common/metamodel'
import type { C4Node } from '@radical/common/c4'

const store = () => useDiagramStore.getState()

// Studio settings live in localStorage, which node doesn't have.
const memory = new Map<string, string>()
;(globalThis as any).localStorage ??= {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => { memory.set(k, v) },
}

function draft(type: string, label = `New ${type}`): Omit<C4Node, 'id'> {
  return { type: type as C4Node['type'], label, collapsed: false, x: 0, y: 0, width: 180, height: 52 }
}

beforeEach(() => {
  saveStudioSettings(defaultStudioSettings())
  useDiagramStore.setState({
    c4Nodes: {
      sys: { id: 'sys', type: 'system', label: 'Shop', collapsed: false, x: 0, y: 0, width: 200, height: 120 },
      db: { id: 'db', type: 'database', label: 'Orders DB', collapsed: false, x: 300, y: 0, width: 200, height: 120 },
    },
    c4Relations: {},
    views: {},
    activeViewId: null,
    metamodel: builtInGovernanceMetamodel(),
    nodeWizard: null,
    appMode: 'designer',
    canUndo: false,
    canRedo: false,
  } as any)
  store()._sync()
})

describe('requestCreateNode', () => {
  it('opens the wizard for a type that has one, without creating the node', () => {
    const onCreated = vi.fn()
    const id = store().requestCreateNode(draft('adr'), { onCreated })
    expect(id).toBe('')
    expect(store().nodeWizard).toMatchObject({ mode: 'create', draft: { type: 'adr' } })
    expect(Object.values(store().c4Nodes).some((n) => n.type === 'adr')).toBe(false)
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('creates a type without a wizard at once', () => {
    const onCreated = vi.fn()
    const id = store().requestCreateNode({ ...draft('container'), parentId: 'sys' }, { onCreated })
    expect(store().c4Nodes[id]?.type).toBe('container')
    expect(store().nodeWizard).toBeNull()
    expect(onCreated).toHaveBeenCalledWith(id)
  })

  it('creates at once when wizards are turned off or skipped', () => {
    saveStudioSettings({ ...defaultStudioSettings(), nodeWizardOnCreate: false })
    expect(store().requestCreateNode(draft('adr'))).toBeTruthy()
    saveStudioSettings(defaultStudioSettings())
    expect(store().requestCreateNode(draft('adr'), { skipWizard: true })).toBeTruthy()
    expect(store().nodeWizard).toBeNull()
  })

  it('creates the given links with a directly created node', () => {
    saveStudioSettings({ ...defaultStudioSettings(), nodeWizardOnCreate: false })
    const id = store().requestCreateNode(draft('adr'), {
      links: [{ relationType: 'constrains', direction: 'out', otherId: 'sys' }],
    })
    expect(Object.values(store().c4Relations)).toEqual([
      expect.objectContaining({ sourceId: id, targetId: 'sys', relationType: 'constrains' }),
    ])
  })

  it('refuses up front when the metamodel would refuse the node', () => {
    const id = store().requestCreateNode({ ...draft('adr'), parentId: 'db' })
    expect(id).toBe('')
    expect(store().nodeWizard).toBeNull()
  })

  // Item 221: an Entity lifecycles + row under an entity that has its
  // machine added a second one, without the link, which Validation flagged.
  it('refuses the node when the rules refuse one of its links', () => {
    useDiagramStore.setState({
      c4Nodes: {
        ...store().c4Nodes,
        order: { id: 'order', type: 'entity', label: 'Order', kind: 'aggregate-root', collapsed: false, x: 0, y: 300, width: 200, height: 80 } as C4Node,
        life: { id: 'life', type: 'state-machine', label: 'Order lifecycle', collapsed: false, x: 300, y: 300, width: 300, height: 200 },
      },
      c4Relations: { l: { id: 'l', sourceId: 'life', targetId: 'order', relationType: 'lifecycle-of' } },
    } as any)
    store()._sync()
    const notify = vi.spyOn(store(), 'pushNotification')
    const id = store().requestCreateNode(draft('state-machine', 'Order payment'), {
      links: [{ relationType: 'lifecycle-of', direction: 'out', otherId: 'order' }], skipWizard: true,
    })
    expect(id).toBe('')
    expect(Object.values(store().c4Nodes).filter((n) => n.type === 'state-machine')).toHaveLength(1)
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/Entity "Order" has a state machine already/), 'error')
  })
})

describe('finishNodeWizard (create)', () => {
  it('creates the node with its values and links, then calls onCreated', () => {
    const onCreated = vi.fn()
    store().requestCreateNode(draft('adr'), { onCreated })
    const id = store().finishNodeWizard(
      { label: 'Use Postgres', status: 'accepted', decision: 'We will use Postgres.' },
      [
        { relationType: 'constrains', direction: 'out', otherId: 'db' },
        { relationType: 'constrains', direction: 'out', otherId: 'missing' },
      ],
    )
    const node = store().c4Nodes[id] as C4Node & Record<string, unknown>
    expect(node).toMatchObject({ type: 'adr', label: 'Use Postgres', status: 'accepted', decision: 'We will use Postgres.' })
    // Links to nodes that no longer exist are dropped.
    expect(Object.values(store().c4Relations)).toEqual([
      expect.objectContaining({ sourceId: id, targetId: 'db', relationType: 'constrains' }),
    ])
    expect(store().nodeWizard).toBeNull()
    expect(onCreated).toHaveBeenCalledWith(id)
  })

  it('falls back to the draft label when the name was cleared', () => {
    store().requestCreateNode(draft('adr', 'New ADR'))
    const id = store().finishNodeWizard({ label: '' }, [])
    expect(store().c4Nodes[id].label).toBe('New ADR')
  })

  it('is a single undo step', () => {
    store().requestCreateNode(draft('adr'))
    const id = store().finishNodeWizard({ label: 'X' }, [{ relationType: 'constrains', direction: 'out', otherId: 'sys' }])
    store().undo()
    expect(store().c4Nodes[id]).toBeUndefined()
    expect(Object.keys(store().c4Relations)).toEqual([])
  })
})

describe('cancelNodeWizard', () => {
  it('creates nothing and drops the callback', () => {
    const onCreated = vi.fn()
    store().requestCreateNode(draft('adr'), { onCreated })
    store().cancelNodeWizard()
    expect(store().nodeWizard).toBeNull()
    // A later wizard must not fire the cancelled one's callback.
    store().requestCreateNode(draft('adr'))
    store().finishNodeWizard({ label: 'Y' }, [])
    expect(onCreated).not.toHaveBeenCalled()
  })
})

describe('edit mode', () => {
  it('patches changed values and syncs the covered links', () => {
    saveStudioSettings({ ...defaultStudioSettings(), nodeWizardOnCreate: false })
    const id = store().requestCreateNode({ ...draft('adr', 'ADR'), context: 'old' } as any, {
      links: [{ relationType: 'constrains', direction: 'out', otherId: 'sys' }],
    })
    store().addRelation({ sourceId: id, targetId: 'db', relationType: 'uses' })

    store().openNodeWizard(id)
    expect(store().nodeWizard).toEqual({ mode: 'edit', nodeId: id })
    store().finishNodeWizard(
      { label: 'ADR', context: 'new' },
      [{ relationType: 'constrains', direction: 'out', otherId: 'db' }],
    )

    const node = store().c4Nodes[id] as C4Node & Record<string, unknown>
    expect(node.context).toBe('new')
    const rels = Object.values(store().c4Relations).map((r) => `${r.relationType}:${r.targetId}`).sort()
    // constrains→sys removed, constrains→db added, the unrelated uses→db kept.
    expect(rels).toEqual(['constrains:db', 'uses:db'])
    expect(store().nodeWizard).toBeNull()
  })

  it('does not open for a type without a wizard', () => {
    store().openNodeWizard('sys')
    expect(store().nodeWizard).toBeNull()
  })
})

describe('addNodes', () => {
  it('adds a list of nodes with their links as one undo step, each in a place of its own', () => {
    const need = store().addNode(draft('need', 'Checkout brief'))
    const ids = store().addNodes(['Keep the basket', 'Tell the customer why'].map((label) => ({
      node: draft('requirement', label),
      links: [{ relationType: 'derives', direction: 'out' as const, otherId: need }],
    })))
    expect(ids).toHaveLength(2)
    const [a, b] = ids.map((id) => store().c4Nodes[id])
    expect([a.label, b.label]).toEqual(['Keep the basket', 'Tell the customer why'])
    expect([a.x, a.y]).not.toEqual([b.x, b.y])
    expect(Object.values(store().c4Relations).filter((r) => r.relationType === 'derives' && r.targetId === need)).toHaveLength(2)

    store().undo()
    expect(Object.values(store().c4Nodes).filter((n) => n.type === 'requirement')).toHaveLength(0)
    expect(Object.values(store().c4Relations)).toHaveLength(0)
    expect(store().c4Nodes[need]).toBeDefined()
  })

  it('stops at the node the metamodel refuses and keeps the ones before it', () => {
    const ids = store().addNodes([
      { node: draft('requirement', 'Kept') },
      { node: { ...draft('component', 'Refused'), parentId: 'db' } },
      { node: draft('requirement', 'Never reached') },
    ])
    expect(ids).toHaveLength(1)
    expect(Object.values(store().c4Nodes).map((n) => n.label)).not.toContain('Never reached')
  })
})

describe('an element a wizard creates inside a container', () => {
  // The wizard's path had none of the placement of a plain add: dropped on
  // a collapsed container, an ADR landed on its header once it was opened;
  // dropped into a parent drawn smaller than itself, an element began above
  // and left of the parent, outside it.
  it('goes beside the others in a collapsed container, below its header', () => {
    useDiagramStore.setState((s: any) => ({
      c4Nodes: {
        ...s.c4Nodes,
        sys: { ...s.c4Nodes.sys, width: 900, height: 400, collapsed: true },
        web: { id: 'web', type: 'container', label: 'Web', parentId: 'sys', collapsed: false, x: 30, y: 120, width: 240, height: 160 },
      },
    }))
    store().requestCreateNode({ ...draft('adr'), parentId: 'sys', x: 49, y: 81 })
    const id = store().finishNodeWizard({ label: 'Use Postgres' }, [])
    expect(id).toBeTruthy()
    const adr = store().c4Nodes[id]
    expect(adr.y).toBeGreaterThanOrEqual(120)
    expect(adr.x).toBeGreaterThanOrEqual(30 + 240)
  })

  it('starts inside a parent drawn smaller than itself', () => {
    store().requestCreateNode({ ...draft('adr'), parentId: 'sys', x: -76, y: -67 })
    const id = store().finishNodeWizard({ label: 'Use Postgres' }, [])
    const adr = store().c4Nodes[id]
    expect(adr.x).toBeGreaterThanOrEqual(0)
    expect(adr.y).toBeGreaterThanOrEqual(100)
  })
})
