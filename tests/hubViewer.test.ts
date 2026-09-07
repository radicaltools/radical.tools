/**
 * Embedded Hub viewer — pure helpers.
 *
 *   - conceptToDiagramData: hub concept → self-contained DiagramData
 *     (ids preserved, governance metamodel, synthetic wiki/table views,
 *     template defaults substituted, dangling parents/relations dropped)
 *   - defaultViewKind: single governance element → wiki, bundles → canvas
 *   - parseHubHash / formatHubHash round-trip
 */
import { describe, it, expect } from 'vitest'
import {
  conceptToDiagramData,
  defaultViewKind,
  substituteTemplateDefaults,
  HUB_WIKI_VIEW_ID,
  HUB_TABLE_VIEW_ID,
} from '../src/renderer/src/hub/conceptToDiagram'
import { parseHubHash, formatHubHash, studioImportUrl } from '../src/renderer/src/hub/hubRoute'
import type { HubConcept } from '../src/renderer/src/store/hubStore'

const requirement: HubConcept = {
  id: 'req-api-response-time',
  category: 'requirement',
  name: 'API response time',
  description: 'p95 latency budget',
  tags: ['performance'],
  templateParams: [
    { key: 'ENDPOINT', label: 'Endpoint', defaultValue: '/orders' },
    { key: 'LATENCY_MS', label: 'Latency', hint: '250' },
    { key: 'OWNER', label: 'Owner' },
  ],
  nodes: [
    {
      id: 'req-1', type: 'requirement', label: 'Latency of {{ENDPOINT}}',
      ears_type: 'event-driven', trigger: 'a request hits {{ENDPOINT}}',
      action: 'respond within {{LATENCY_MS}} ms (owner: {{OWNER}})',
      templateParams: [{ key: 'ENDPOINT', label: 'Endpoint' }],
    },
  ],
}

const pattern: HubConcept = {
  id: 'pattern-cqrs',
  category: 'pattern',
  name: 'CQRS',
  description: 'Split reads and writes',
  tags: [],
  nodes: [
    { id: 'sys', type: 'system', label: 'Shop', x: 0, y: 0, width: 360, height: 260 },
    { id: 'cmd', type: 'container', label: 'Command side', parentId: 'sys', x: 20, y: 60 },
    { id: 'orphan', type: 'container', label: 'Orphan', parentId: 'missing' },
  ],
  relations: [
    { id: 'r1', sourceId: 'cmd', targetId: 'sys', label: 'writes to {{X}}' },
    { sourceId: 'cmd', targetId: 'ghost' },
  ],
}

describe('conceptToDiagramData', () => {
  it('keeps ids, attaches governance metamodel and synthetic views', () => {
    const data = conceptToDiagramData(requirement)
    expect(data.nodes.map((n) => n.id)).toEqual(['req-1'])
    expect(data.metamodel?.id).toBe('c4-ddd-governance-builtin')
    const kinds = Object.fromEntries((data.views ?? []).map((v) => [v.id, v.kind]))
    expect(kinds).toEqual({ [HUB_WIKI_VIEW_ID]: 'wiki', [HUB_TABLE_VIEW_ID]: 'table' })
    const wiki = data.views!.find((v) => v.id === HUB_WIKI_VIEW_ID)!
    expect(wiki.nodeIds).toEqual(['req-1'])
    expect(wiki.wikiFocusId).toBe('req-1')
  })

  it('substitutes template defaults and leaves unresolved keys visible', () => {
    const data = conceptToDiagramData(requirement)
    const n = data.nodes[0] as unknown as Record<string, unknown>
    expect(n.label).toBe('Latency of /orders')
    expect(n.trigger).toBe('a request hits /orders')
    expect(n.action).toBe('respond within 250 ms (owner: {{OWNER}})')
    expect(n.ears_type).toBe('event-driven')
    expect('templateParams' in n).toBe(false)
  })

  it('fills geometry defaults from NODE_SIZES and drops dangling refs', () => {
    const data = conceptToDiagramData(pattern)
    const cmd = data.nodes.find((n) => n.id === 'cmd')!
    expect(cmd.parentId).toBe('sys')
    expect(cmd.width).toBeGreaterThan(0)
    expect(cmd.height).toBeGreaterThan(0)
    expect(cmd.collapsed).toBe(false)
    const orphan = data.nodes.find((n) => n.id === 'orphan')!
    expect(orphan.parentId).toBeUndefined()
    expect(data.relations).toHaveLength(1)
    expect(data.relations[0]).toMatchObject({ id: 'r1', sourceId: 'cmd', targetId: 'sys', label: 'writes to {{X}}' })
  })
})

describe('defaultViewKind', () => {
  it('opens single governance elements in wiki, bundles on canvas', () => {
    expect(defaultViewKind(requirement)).toBe('wiki')
    expect(defaultViewKind(pattern)).toBe('canvas')
    expect(defaultViewKind({ ...requirement, category: 'blueprint' })).toBe('canvas')
  })
})

describe('substituteTemplateDefaults', () => {
  it('is a no-op without params', () => {
    expect(substituteTemplateDefaults('{{A}}', undefined)).toBe('{{A}}')
    expect(substituteTemplateDefaults('{{A}}', [])).toBe('{{A}}')
  })
})

describe('hub route', () => {
  it('round-trips concept + view + filters', () => {
    const r = { browse: true, concept: 'req-a b', view: 'wiki' as const, category: 'requirement', tag: 'perf/latency' }
    const hash = formatHubHash(r)
    expect(hash).toBe('#/c/req-a%20b/v/wiki/cat/requirement/tag/perf%2Flatency')
    expect(parseHubHash(hash)).toEqual(r)
  })

  it('omits view without a concept and ignores unknown view kinds', () => {
    expect(formatHubHash({ view: 'table', category: 'adr' })).toBe('#/cat/adr')
    expect(parseHubHash('#/c/x/v/bogus')).toEqual({ browse: true, concept: 'x' })
  })

  it('distinguishes landing (empty hash) from the bare catalogue (#/browse)', () => {
    expect(parseHubHash('')).toEqual({})
    expect(formatHubHash({})).toBe('')
    expect(formatHubHash({ browse: true })).toBe('#/browse')
    expect(parseHubHash('#/browse')).toEqual({ browse: true })
    expect(parseHubHash('#/browse/cat/adr')).toEqual({ browse: true, category: 'adr' })
  })

  it('builds the studio import deep link', () => {
    expect(studioImportUrl('https://studio.radical.tools', ['a', 'b'])).toBe('https://studio.radical.tools?hub=a%2Cb')
  })
})
