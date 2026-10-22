/**
 * The standard every concern pack of the Hub meets (ADR Concern groups and
 * pack standard): its group, its questions and options, its sources, and
 * each fitness function's tool and snippet.
 */
import { describe, it, expect } from 'vitest'
import { buildConcernInsert, concernPackProblems, CONCERN_GROUPS } from '../src/concerns'
import type { HubConcept, HubRadicalDoc } from '../src/hubFormat'
import type { C4Node } from '../src/c4'
import { builtInGovernanceMetamodel } from '../src/metamodel'

const option = (value: string, description = 'When it fits.') => ({ value, label: value, description })
const question = (key: string) => ({ key, label: `${key}?`, options: [option('a'), option('b')] })

/** A pack that meets the standard: three questions, two sources, a fitness function with its tool and snippet. */
function good(): HubRadicalDoc {
  return {
    hub: {
      id: 'concern-x', category: 'concern', name: 'X', description: 'd', tags: [],
      concern: { id: 'x', trigger: 'LIST NODES WHERE type = "database"', why: 'w', group: 'data' },
      sources: [{ title: 'One', url: 'https://example.org/1' }, { title: 'Two', url: 'https://example.org/2' }],
      templateParams: [question('A'), question('B'), question('C')],
    },
    nodes: [
      { id: 'need', type: 'need', label: 'N' },
      { id: 'req', type: 'requirement', label: 'R' },
      { id: 'sc', type: 'scenario', label: 'S' },
      { id: 'adr', type: 'adr', label: 'D', concern: 'x' },
      { id: 'ff', type: 'fitness-fn', label: 'F', description: 'Checked by a test.\n\nTool: Vitest\n\n```ts\nit("x", () => {})\n```' },
    ],
    relations: [
      { id: '1', relationType: 'derives', sourceId: 'req', targetId: 'need' },
      { id: '2', relationType: 'verifies', sourceId: 'sc', targetId: 'req' },
      { id: '3', relationType: 'implements', sourceId: 'ff', targetId: 'adr' },
    ],
  }
}

describe('concernPackProblems', () => {
  it('passes a pack that meets the standard', () => {
    expect(concernPackProblems(good())).toEqual([])
    expect(CONCERN_GROUPS.map((g) => g.id)).toEqual(['architecture', 'identity', 'security', 'data', 'integration', 'reliability', 'operations', 'maintainability', 'technology'])
  })

  it('names each way a pack falls below the standard', () => {
    const doc = good()
    doc.hub.concern!.group = 'quality'
    doc.hub.templateParams = [question('A'), { ...question('B'), options: [option('a'), option('b', ' ')] }]
    doc.hub.sources = [{ title: 'One', url: 'example.org' }]
    doc.nodes[4].description = 'Checked somehow.'
    const problems = concernPackProblems(doc)
    expect(problems).toEqual(expect.arrayContaining([
      expect.stringContaining('hub.concern.group must be one of architecture, identity, security'),
      'a concern pack asks at least three questions with options (it asks 2)',
      'question B: option "b" does not say what it means and when to pick it',
      'a concern pack names at least two sources (it names 1)',
      'source "One" needs a title and an http(s) link',
      'fitness function "ff" names no tool (a "Tool: …" line in its description)',
      'fitness function "ff" carries no snippet to copy (a fenced block in its description)',
    ]))
  })
})

describe('buildConcernInsert', () => {
  // F-0008: bound to an element inside a container, the view listed the
  // element without a position and placed its container without listing
  // it: Studio laid the view out again the first time it was opened.
  it('the pack\'s view lists and places each bound element with what holds it, on the left of the pack', () => {
    const box = { width: 200, height: 100 }
    const nodes: Record<string, C4Node> = Object.fromEntries(([
      { id: 'user', type: 'person', label: 'Customer', x: 0, y: 0, ...box },
      { id: 'shop', type: 'system', label: 'Shop', x: 400, y: 0, width: 700, height: 400 },
      { id: 'api', type: 'container', label: 'API', parentId: 'shop', x: 40, y: 60, width: 400, height: 300 },
      { id: 'orders', type: 'component', label: 'Orders', parentId: 'api', x: 30, y: 50, ...box },
      { id: 'web', type: 'webapp', label: 'Web', parentId: 'shop', x: 480, y: 60, ...box },
    ] as C4Node[]).map((n) => [n.id, n]))
    const concept: HubConcept = {
      id: 'concern-x', category: 'concern', name: 'X', description: 'd', tags: [],
      concern: { id: 'x', trigger: 'LIST NODES WHERE type = "webapp"', why: 'w', group: 'data' },
      nodes: [
        { id: 'need', type: 'need', label: 'N', x: 0, y: 0 },
        { id: 'req', type: 'requirement', label: 'R', x: 300, y: 0 },
        { id: 'adr', type: 'adr', label: 'D', concern: 'x', x: 600, y: 0 },
      ],
      relations: [{ id: '1', relationType: 'derives', sourceId: 'req', targetId: 'need' }],
    }
    let n = 0
    const insert = buildConcernInsert(concept, {
      answers: {}, elements: [nodes.web, nodes.orders, nodes.user], nodes, metamodel: builtInGovernanceMetamodel(),
      today: '2026-10-22', newId: () => `id${++n}`, place: () => ({ x: 2000, y: 2000 }),
    })
    const view = insert.views[0]
    expect([...view.nodeIds].sort()).toEqual([...Object.keys(insert.nodes), 'api', 'orders', 'shop', 'user', 'web'].sort())
    expect(Object.keys(view.positions).sort()).toEqual([...view.nodeIds].sort())
    // Inside a container, where the model has it; the outermost on the left.
    expect(view.positions.web).toEqual({ x: 480, y: 60, ...box })
    expect(view.positions.api).toEqual({ x: 40, y: 60, width: 400, height: 300 })
    expect(view.positions.orders).toEqual({ x: 30, y: 50, ...box })
    const packLeft = Math.min(...Object.keys(insert.nodes).map((id) => view.positions[id].x))
    for (const id of ['shop', 'user']) expect(view.positions[id].x + view.positions[id].width).toBeLessThan(packLeft)
  })
})
