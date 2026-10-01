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
