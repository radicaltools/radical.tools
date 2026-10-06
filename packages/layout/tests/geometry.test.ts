import { describe, it, expect } from 'vitest'
import { fitAncestors, fittedParentSize, placeNewNode } from '../src/geometry'
import { NODE_SIZES, type C4Node } from '@radical/common/c4'

const node = (id: string, type: string, extra: Partial<C4Node> = {}): C4Node =>
  ({ id, type, label: id, collapsed: false, x: 0, y: 0, ...NODE_SIZES[type as keyof typeof NODE_SIZES], ...extra }) as C4Node

describe('fittedParentSize', () => {
  it('wraps the children plus padding, never below the type default', () => {
    const sys = node('sys', 'system')
    expect(fittedParentSize(sys, [{ x: 30, y: 120, width: 900, height: 600 }])).toEqual({ width: 960, height: 750 })
    expect(fittedParentSize(sys, [{ x: 0, y: 0, width: 10, height: 10 }])).toEqual(NODE_SIZES.system)
  })
})

describe('fitAncestors', () => {
  it('refits the parent and every ancestor above it, leaving collapsed ones alone', () => {
    const nodes: Record<string, C4Node> = {
      dom: node('dom', 'domain'),
      sys: node('sys', 'system', { parentId: 'dom', x: 30, y: 120 }),
      api: node('api', 'container', { parentId: 'sys', x: 30, y: 120, width: 1000, height: 400 }),
      shut: node('shut', 'system', { collapsed: true, width: 10, height: 10 }),
      kid: node('kid', 'container', { parentId: 'shut', x: 5000, y: 5000 }),
    }
    fitAncestors(nodes, 'sys')
    expect(nodes.sys).toMatchObject({ width: 1060, height: 550 })
    expect(nodes.dom).toMatchObject({ width: 1120, height: 700 })
    fitAncestors(nodes, 'shut')
    expect(nodes.shut).toMatchObject({ width: 10, height: 10 })
  })

  it('wraps the components of a web app, as it does a container\'s', () => {
    const nodes: Record<string, C4Node> = {
      web: node('web', 'webapp'),
      ui: node('ui', 'component', { parentId: 'web', x: 20, y: 120 }),
      api: node('api', 'component', { parentId: 'web', x: 240, y: 120 }),
    }
    fitAncestors(nodes, 'web')
    expect(nodes.web).toMatchObject({ width: 240 + NODE_SIZES.component.width + 20, height: 120 + NODE_SIZES.component.height + 20 })
  })
})

describe('placeNewNode', () => {
  it('places a first child below the header, later ones right of their siblings', () => {
    const nodes: Record<string, C4Node> = { sys: node('sys', 'system', { x: 500, y: 500 }) }
    expect(placeNewNode(nodes, 'sys')).toEqual({ x: 30, y: 120 })
    nodes.api = node('api', 'container', { parentId: 'sys', x: 30, y: 120 })
    expect(placeNewNode(nodes, 'sys')).toEqual({ x: 30 + NODE_SIZES.container.width + 20, y: 120 })
  })

  it('places a root node right of the root nodes only', () => {
    const nodes: Record<string, C4Node> = {
      sys: node('sys', 'system', { x: 100 }),
      api: node('api', 'container', { parentId: 'sys', x: 9000 }),
    }
    expect(placeNewNode({}, undefined)).toEqual({ x: 0, y: 0 })
    expect(placeNewNode(nodes, undefined)).toEqual({ x: 100 + NODE_SIZES.system.width + 80, y: 0 })
  })
})
