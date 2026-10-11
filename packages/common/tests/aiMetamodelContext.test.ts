import { describe, it, expect } from 'vitest'
import { buildMetamodelMessage } from '../src/ai/metamodelContext'
import type { C4Node } from '../src/c4'
import type { Metamodel } from '../src/metamodel'

const node = (over: Partial<C4Node>): C4Node => ({
  id: 'n', type: 'system', label: 'L', collapsed: false,
  x: 0, y: 0, width: 100, height: 100, ...over,
})

describe('buildMetamodelMessage', () => {
  it("includes each type's properties, so the model knows valid property-bag keys", () => {
    const mm: Metamodel = {
      id: 'm',
      name: 'M',
      nodeTypes: {
        requirement: {
          id: 'requirement', label: 'Requirement', color: '', fg: '', iconPath: '', width: 0, height: 0,
          properties: [{ key: 'ears_type', label: 'EARS type', type: 'enum', options: ['ubiquitous'] }],
        },
      },
      relationTypes: {
        derives: {
          id: 'derives', label: 'Derives from',
          allowedPairs: [{ from: 'requirement', to: 'requirement' }],
          properties: [],
        },
      },
    }
    const msg = buildMetamodelMessage(mm)
    expect(msg).toContain('ears_type')
    expect(msg).toContain('ubiquitous')
    expect(msg).toContain('derives')
  })

  it('abbreviates properties for types outside relevantTypeIds and not yet in use, but keeps full detail for relevant or in-use types', () => {
    const mm: Metamodel = {
      id: 'm',
      name: 'M',
      nodeTypes: {
        requirement: {
          id: 'requirement', label: 'Requirement', color: '', fg: '', iconPath: '', width: 0, height: 0,
          properties: [{ key: 'ears_type', label: 'EARS type', type: 'enum', options: ['ubiquitous'] }],
        },
        system: {
          id: 'system', label: 'System', color: '', fg: '', iconPath: '', width: 0, height: 0,
          properties: [{ key: 'tech', label: 'Tech', type: 'text' }],
        },
        container: {
          id: 'container', label: 'Container', color: '', fg: '', iconPath: '', width: 0, height: 0,
          properties: [{ key: 'stack', label: 'Stack', type: 'text' }],
        },
      },
      relationTypes: {},
    }
    const nodes: Record<string, C4Node> = { s1: node({ id: 's1', type: 'system' }) }
    const msg = buildMetamodelMessage(mm, new Set(['requirement']), nodes)
    // relevant (requirement) and in-use (system) keep full property detail
    expect(msg).toContain('ears_type')
    expect(msg).toContain('"tech"')
    // irrelevant and unused (container) loses its properties array
    expect(msg).not.toContain('"stack"')
  })
})
