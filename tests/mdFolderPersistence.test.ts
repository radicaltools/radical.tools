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

  it('keeps positions out of the markdown and in the layout sidecar', () => {
    const files = serializeToMdFolder(sample)
    const md = files['nodes/payment-system/_index.md']
    expect(md).not.toMatch(/^x:/m)
    expect(md).not.toMatch(/^width:/m)
    const layout = JSON.parse(files['_layout.json'])
    expect(layout.nodes.sys1).toEqual({ x: 10, y: 20, width: 400, height: 300, collapsed: false })
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

  it('sorts custom frontmatter keys and ends JSON sidecars with a newline', () => {
    const files = serializeToMdFolder(sample)
    const adrPath = Object.keys(files).find((p) => p.startsWith('nodes/use-event-sourcing'))!
    const front = files[adrPath].split('---')[1]
    const keyLines = front
      .split('\n')
      .map((l) => l.match(/^([a-zA-Z_]+):/)?.[1])
      .filter((k): k is string => !!k && !['id', 'type', 'label'].includes(k))
    expect(keyLines).toEqual([...keyLines].sort())
    expect(files['_layout.json'].endsWith('\n')).toBe(true)
    expect(files['relations.json'].endsWith('\n')).toBe(true)
  })
})
