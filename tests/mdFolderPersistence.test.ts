import { describe, it, expect } from 'vitest'
import {
  serializeToMdFolder,
  deserializeFromMdFolder,
  isMdFolder,
  MD_MANIFEST_FILE,
} from '../src/renderer/src/persist/mdFolder'
import type { DiagramData, C4Node } from '../src/renderer/src/types/c4'

function node(partial: Partial<C4Node> & Pick<C4Node, 'id' | 'type' | 'label'>): C4Node {
  return {
    collapsed: false,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    ...partial,
  } as C4Node
}

const sample: DiagramData = {
  nodes: [
    node({ id: 'sys1', type: 'system', label: 'Payment System', description: 'Handles payments', x: 10, y: 20, width: 400, height: 300 }),
    node({ id: 'ctn1', type: 'container', label: 'API', parentId: 'sys1', technology: 'Node.js', description: 'REST API' }),
    node({ id: 'db1', type: 'database', label: 'Ledger DB', parentId: 'ctn1', x: 5, y: 5 }),
    node({ id: 'adr1', type: 'adr', label: 'Use event sourcing', collapsed: true, ...({
      status: 'accepted',
      date: '2026-01-01',
      context: 'We need an audit trail.\nMultiple regulators require it.',
      decision: 'Adopt event sourcing.',
    } as Record<string, unknown>) }),
    node({ id: 'req1', type: 'requirement', label: 'Latency', ...({
      ears_type: 'event-driven',
      trigger: 'a payment is submitted',
      action: 'process it within 200ms',
      priority: 'must',
    } as Record<string, unknown>) }),
  ],
  relations: [
    { id: 'rel1', sourceId: 'ctn1', targetId: 'db1', relationType: 'interacts', label: 'reads/writes' },
    { id: 'rel2', sourceId: 'adr1', targetId: 'ctn1', relationType: 'constrains' },
  ],
  views: [
    { id: 'v1', name: 'Context', kind: 'static', nodeIds: ['sys1'], positions: { sys1: { x: 0, y: 0, width: 400, height: 300 } } },
  ],
  sequences: [{ id: 's1', name: 'Pay flow', relationIds: ['rel1'] }],
  defaultPositions: { sys1: { x: 10, y: 20, width: 400, height: 300 } },
  defaultViewport: { x: 0, y: 0, zoom: 1 },
}

describe('md-folder persistence', () => {
  it('produces a manifest and one file per node', () => {
    const files = serializeToMdFolder(sample, 'Demo')
    expect(isMdFolder(files)).toBe(true)
    expect(files[MD_MANIFEST_FILE]).toContain('radicalFormat')
    // Container systems/containers are directories with _index.md; leaves are .md
    const paths = Object.keys(files)
    expect(paths).toContain('nodes/payment-system/_index.md')
    expect(paths).toContain('nodes/payment-system/api/_index.md')
    expect(paths).toContain('nodes/payment-system/api/ledger-db.md')
    expect(paths.some((p) => p.startsWith('nodes/use-event-sourcing'))).toBe(true)
  })

  it('stores node geometry in the markdown frontmatter', () => {
    const files = serializeToMdFolder(sample)
    const md = files['nodes/payment-system/_index.md']
    expect(md).toMatch(/^x: 10$/m)
    expect(md).toMatch(/^width: 400$/m)
    expect(md).toMatch(/^collapsed: false$/m)
    // _layout.json no longer carries a per-node map — only default-view state.
    const layout = JSON.parse(files['_layout.json'])
    expect(layout.nodes).toBeUndefined()
    expect(layout.defaultPositions.sys1).toEqual({ x: 10, y: 20, width: 400, height: 300 })
  })

  it('round-trips losslessly', () => {
    const files = serializeToMdFolder(sample, 'Demo')
    const back = deserializeFromMdFolder(files)

    const byId = (d: DiagramData): Record<string, C4Node> =>
      Object.fromEntries(d.nodes.map((n) => [n.id, n]))
    const orig = byId(sample)
    const rt = byId(back)

    expect(Object.keys(rt).sort()).toEqual(Object.keys(orig).sort())
    for (const id of Object.keys(orig)) {
      expect(rt[id]).toEqual(orig[id])
    }
    expect(back.relations).toEqual(sample.relations)
    expect(back.views).toEqual(sample.views)
    expect(back.sequences).toEqual(sample.sequences)
    expect(back.defaultPositions).toEqual(sample.defaultPositions)
    expect(back.defaultViewport).toEqual(sample.defaultViewport)
  })

  it('preserves custom metamodel property types and multiline prose', () => {
    const files = serializeToMdFolder(sample)
    const back = deserializeFromMdFolder(files)
    const adr = back.nodes.find((n) => n.id === 'adr1') as unknown as Record<string, unknown>
    expect(adr.status).toBe('accepted')
    expect(adr.context).toBe('We need an audit trail.\nMultiple regulators require it.')
    expect(adr.collapsed).toBe(true)
    const req = back.nodes.find((n) => n.id === 'req1') as unknown as Record<string, unknown>
    expect(req.ears_type).toBe('event-driven')
    expect(req.priority).toBe('must')
  })

  it('does not confuse numeric-looking strings with numbers', () => {
    const data: DiagramData = {
      nodes: [node({ id: 'n1', type: 'adr', label: '123', ...({ date: '2026-01-01', ref: '007' } as Record<string, unknown>) })],
      relations: [],
    }
    const back = deserializeFromMdFolder(serializeToMdFolder(data))
    const n = back.nodes[0] as unknown as Record<string, unknown>
    expect(n.label).toBe('123')
    expect(n.ref).toBe('007')
    expect(n.date).toBe('2026-01-01')
  })

  it('produces deterministic output regardless of store ordering (git-friendly)', () => {
    const shuffled: DiagramData = {
      ...sample,
      nodes: [...sample.nodes].reverse(),
      relations: [...(sample.relations ?? [])].reverse(),
    }
    const a = serializeToMdFolder(sample, 'Demo')
    const b = serializeToMdFolder(shuffled, 'Demo')
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort())
    for (const path of Object.keys(a)) {
      expect(b[path]).toBe(a[path])
    }
  })

  it('sorts custom frontmatter keys and ends sidecars with a newline', () => {
    const files = serializeToMdFolder(sample)
    const adrPath = Object.keys(files).find((p) => p.startsWith('nodes/use-event-sourcing'))!
    const front = files[adrPath].split('---')[1]
    const skip = ['id', 'type', 'label', 'x', 'y', 'width', 'height', 'collapsed']
    const keyLines = front
      .split('\n')
      .map((l) => l.match(/^([a-zA-Z_]+):/)?.[1])
      .filter((k): k is string => !!k && !skip.includes(k))
    expect(keyLines).toEqual([...keyLines].sort())
    expect(files['_layout.json'].endsWith('\n')).toBe(true)
    expect(files['relations.md'].endsWith('\n')).toBe(true)
  })

  it('serializes relations as a markdown table (not JSON) and round-trips', () => {
    const files = serializeToMdFolder(sample)
    expect(files['relations.json']).toBeUndefined()
    const md = files['relations.md']
    expect(md).toMatch(/^\| id \| source \| target \|/m)
    expect(md).toContain('| rel1 | ctn1 | db1 | reads/writes |')
    const back = deserializeFromMdFolder(files)
    expect(back.relations).toEqual(sample.relations)
  })

  it('escapes pipe and newline characters in relation cells', () => {
    const data: DiagramData = {
      nodes: [node({ id: 'a', type: 'system', label: 'A' }), node({ id: 'b', type: 'system', label: 'B' })],
      relations: [{ id: 'r', sourceId: 'a', targetId: 'b', label: 'reads | writes\nasync' }],
    }
    const back = deserializeFromMdFolder(serializeToMdFolder(data))
    expect(back.relations[0].label).toBe('reads | writes\nasync')
  })

  it('reads legacy folders (relations.json + _layout.json positions)', () => {
    const legacy: Record<string, string> = {
      'radical.md': '---\nradicalFormat: "md-folder"\nversion: 1\n---\n',
      'nodes/a.md': '---\nid: "a"\ntype: "system"\nlabel: "A"\n---\n',
      '_layout.json':
        JSON.stringify({ nodes: { a: { x: 7, y: 8, width: 100, height: 50, collapsed: true } } }) + '\n',
      'relations.json': JSON.stringify([{ id: 'r', sourceId: 'a', targetId: 'a', label: 'self' }]) + '\n',
    }
    const back = deserializeFromMdFolder(legacy)
    const a = back.nodes.find((n) => n.id === 'a')!
    expect(a.x).toBe(7)
    expect(a.width).toBe(100)
    expect(a.collapsed).toBe(true)
    expect(back.relations).toEqual([{ id: 'r', sourceId: 'a', targetId: 'a', label: 'self' }])
  })

  it('serializes sequences as markdown ordered lists (not JSON) and round-trips', () => {
    const files = serializeToMdFolder(sample)
    expect(files['sequences.json']).toBeUndefined()
    const md = files['sequences/pay-flow.md']
    expect(md).toBeDefined()
    expect(md).toMatch(/^1\. `rel1`$/m)
    const back = deserializeFromMdFolder(files)
    expect(back.sequences).toEqual(sample.sequences)
  })

  it('round-trips sequence step descriptions including gaps', () => {
    const data: DiagramData = {
      nodes: [node({ id: 'a', type: 'system', label: 'A' })],
      relations: [
        { id: 'r1', sourceId: 'a', targetId: 'a' },
        { id: 'r2', sourceId: 'a', targetId: 'a' },
        { id: 'r3', sourceId: 'a', targetId: 'a' },
      ],
      sequences: [
        {
          id: 'sq',
          name: 'Flow',
          relationIds: ['r1', 'r2', 'r3'],
          stepDescriptions: ['first', undefined, 'third'],
        },
      ],
    }
    const back = deserializeFromMdFolder(serializeToMdFolder(data))
    expect(back.sequences).toEqual(data.sequences)
  })

  it('reads legacy sequences.json when no sequences/ markdown present', () => {
    const legacy: Record<string, string> = {
      'radical.md': '---\nradicalFormat: "md-folder"\nversion: 1\n---\n',
      'nodes/a.md': '---\nid: "a"\ntype: "system"\nlabel: "A"\nx: 0\ny: 0\nwidth: 10\nheight: 10\ncollapsed: false\n---\n',
      'sequences.json': JSON.stringify([{ id: 'sq', name: 'Legacy', relationIds: ['r1'] }]) + '\n',
    }
    const back = deserializeFromMdFolder(legacy)
    expect(back.sequences).toEqual([{ id: 'sq', name: 'Legacy', relationIds: ['r1'] }])
  })

  it('serializes views as markdown (frontmatter + node list) and round-trips', () => {
    const files = serializeToMdFolder(sample)
    expect(files['views.json']).toBeUndefined()
    const md = files['views/context.md']
    expect(md).toBeDefined()
    expect(md).toMatch(/^kind: "static"$/m)
    expect(md).toMatch(/^## Nodes$/m)
    expect(md).toMatch(/^- `sys1`$/m)
    // Per-view positions live in the layout sidecar, not the .md.
    const layout = JSON.parse(files['_layout.json'])
    expect(layout.views.v1.positions.sys1).toEqual({ x: 0, y: 0, width: 400, height: 300 })
    const back = deserializeFromMdFolder(files)
    expect(back.views).toEqual(sample.views)
  })

  it('round-trips rich view UI state (viewport, collapse sets, treemap, null focus)', () => {
    const data: DiagramData = {
      nodes: [node({ id: 'a', type: 'system', label: 'A' })],
      relations: [],
      views: [
        {
          id: 'vx',
          name: 'Treemap',
          kind: 'treemap',
          nodeIds: ['a'],
          positions: { a: { x: 1, y: 2, width: 3, height: 4 } },
          viewport: { x: 5, y: 6, zoom: 1.5 },
          collapsedNodeIds: ['a'],
          expandedNodeIds: [],
          hiddenRelationIds: ['r9'],
          treemapFocusId: null,
          treemapSizeBy: 'uniform',
          treemapMaxDepth: 2,
          layoutMode: 'tree',
        },
      ],
    }
    const back = deserializeFromMdFolder(serializeToMdFolder(data))
    expect(back.views).toEqual(data.views)
  })

  it('reads legacy views.json when no views/ markdown present', () => {
    const legacy: Record<string, string> = {
      'radical.md': '---\nradicalFormat: "md-folder"\nversion: 1\n---\n',
      'nodes/a.md': '---\nid: "a"\ntype: "system"\nlabel: "A"\nx: 0\ny: 0\nwidth: 10\nheight: 10\ncollapsed: false\n---\n',
      'views.json': JSON.stringify([{ id: 'v', name: 'Legacy', nodeIds: ['a'], positions: {} }]) + '\n',
    }
    const back = deserializeFromMdFolder(legacy)
    expect(back.views).toEqual([{ id: 'v', name: 'Legacy', nodeIds: ['a'], positions: {} }])
  })
})
