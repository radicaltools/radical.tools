/**
 * A group of views per element is never a canvas of its own (F-0021 for
 * navigation). The view shown that turns into one, by choosing a viewpoint
 * of one element for it or by its viewpoint getting a subject in the
 * metamodel editor, opens the group's first view: nothing of the canvas is
 * saved into the group, and a reload shows the view shown now (F-0051).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useDiagramStore } from '../src/store/diagramStore'
import * as model from '@radical/common/model'
import { viewpointsOf, withViewpoint } from '@radical/common/viewpoints'
import type { C4Node } from '@radical/common/c4'

const s = () => useDiagramStore.getState()
const el = (id: string, type: string, label: string, parentId?: string, x = 0): C4Node =>
  ({ id, type, label, x, y: 0, width: 200, height: 120, ...(parentId ? { parentId } : {}) }) as C4Node
const realSmartLayout = s().runSmartLayout
const smartLayout = vi.fn(async () => {})

/** View `v`, two elements picked by hand and laid out, shown. */
beforeEach(() => {
  s().loadDiagram({
    nodes: [el('shop', 'system', 'Shop'), el('api', 'container', 'Payments Service', 'shop', 0), el('web', 'webapp', 'Web', 'shop', 300), el('c1', 'component', 'Ledger', 'api')],
    relations: [],
    views: [{
      id: 'v', name: 'Picked', nodeIds: ['api', 'web'],
      positions: { api: { x: 10, y: 20, width: 400, height: 300 }, web: { x: 600, y: 20, width: 200, height: 120 } },
      viewport: { x: 1, y: 2, zoom: 0.8 },
    }],
  })
  useDiagramStore.setState({ appMode: 'designer', runSmartLayout: smartLayout } as any)
  s().setActiveView('v')
  expect(s().activeViewId).toBe('v')
})

afterEach(() => {
  useDiagramStore.setState({ runSmartLayout: realSmartLayout } as any)
})

describe('the view shown becomes a group of views per element', () => {
  it('by its viewpoint in View properties: the group opens its first view and keeps no canvas', () => {
    expect(s().applyViewpoint('v', 'container-components')).toBe(true)
    const group = s().views.v
    expect(model.isViewGroup(group, s().metamodel)).toBe(true)
    const first = model.firstViewOfGroup(s().views, 'v')!
    expect(first.name).toBe('Payments Service')
    expect(s().activeViewId).toBe(first.id)
    // Nothing of a canvas is kept in, or saved into, the group.
    expect(group.nodeIds).toEqual([])
    expect(group.positions).toEqual({})
    expect(group.viewport).toBeUndefined()
    // Undo brings the view back as it was, shown.
    s().undo()
    expect(s().activeViewId).toBe('v')
    expect(s().views.v.nodeIds).toEqual(['api', 'web'])
    expect(Object.keys(s().views.v.positions).sort()).toEqual(['api', 'web'])
  })

  it('by its viewpoint getting a subject in the metamodel editor: the same', () => {
    expect(s().applyViewpoint('v', 'containers')).toBe(true)
    expect(s().activeViewId).toBe('v')
    const containers = viewpointsOf(s().metamodel).find((t) => t.id === 'containers')!
    s().setMetamodel(withViewpoint(s().metamodel, { ...containers, subject: { types: ['system'] } }))
    const group = s().views.v
    expect(model.isViewGroup(group, s().metamodel)).toBe(true)
    const first = model.firstViewOfGroup(s().views, 'v')!
    expect(first.name).toBe('Shop')
    expect(s().activeViewId).toBe(first.id)
    expect(group.positions).toEqual({})
  })
})
