/**
 * The standard every concern pack of the Hub meets (ADR Concern groups and
 * pack standard): its group, its questions and options, its sources, and
 * each fitness function's tool and snippet.
 */
import { describe, it, expect } from 'vitest'
import { buildConcernInsert, concernPackProblems, CONCERN_GROUPS, metamodelProblem } from '../src/concerns'
import type { HubConcept, HubRadicalDoc } from '../src/hubFormat'
import type { C4Node } from '../src/c4'
import { builtInC4Metamodel, builtInGovernanceMetamodel } from '../src/metamodel'

const option = (value: string, description = 'When it fits.') => ({ value, label: value, description })
const question = (key: string) => ({ key, label: `${key}?`, options: [option('a'), option('b')] })

/** A pack that meets the standard: three questions, two sources, a fitness function with its tool and snippet. */
function good(): HubRadicalDoc {
  return {
    hub: {
      id: 'concern-x', category: 'concern', name: 'X', description: 'd', tags: [],
      concern: { id: 'x', trigger: 'LIST NODES WHERE type = "database"', why: 'w', group: 'compliance' },
      sources: [{ title: 'One', url: 'https://example.org/1' }, { title: 'Two', url: 'https://example.org/2' }],
      templateParams: [question('A'), question('B'), question('C')],
    },
    nodes: [
      { id: 'need', type: 'need', label: 'N' },
      { id: 'req', type: 'requirement', label: 'R' },
      { id: 'sc', type: 'scenario', label: 'S' },
      { id: 'adr', type: 'adr', label: 'D', concern: 'x', decision: 'We do {{A}}, {{B}} and {{C}}.' },
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
    expect(CONCERN_GROUPS.map((g) => g.id)).toEqual(['security', 'api', 'architecture', 'coding', 'sdlc', 'technology', 'compliance', 'operability'])
  })

  it('names each way a pack falls below the standard', () => {
    const doc = good()
    doc.hub.concern!.group = 'quality'
    doc.hub.templateParams = [question('A'), { ...question('B'), options: [option('a'), option('b', ' ')] }]
    doc.hub.sources = [{ title: 'One', url: 'example.org' }]
    doc.nodes[4].description = 'Checked somehow.'
    const problems = concernPackProblems(doc)
    expect(problems).toEqual(expect.arrayContaining([
      expect.stringContaining('hub.concern.group must be one of security, api, architecture'),
      'a concern pack asks at least three questions with options (it asks 2)',
      'question B: option "b" does not say what it means and when to pick it',
      'a concern pack names at least two sources (it names 1)',
      'source "One" needs a title and an http(s) link',
      'fitness function "ff" names no tool (a "Tool: …" line in its description)',
      'fitness function "ff" carries no snippet to copy (a fenced block in its description)',
    ]))
  })

  it('names what is wrong in the texts and across the answers', () => {
    const doc = good()
    doc.hub.templateParams = [
      { ...question('A'), options: [option('a', 'Pick it when {{NUM}} is small.'), { ...option('b'), label: 'b of {{NUM}}' }] },
      question('B'), { ...question('C'), options: [option('a'), option('b'), option('c')] },
      { key: 'NUM', label: 'How many?', defaultValue: '5' }, { key: 'M', label: 'Unused?', defaultValue: '1' },
    ]
    doc.nodes[1] = { id: 'req', type: 'requirement', label: 'R', ears_type: 'state-driven', precondition: 'while it rains', action: 'keep {{NUM}} and {{ZZZ}} dry', hubWhen: { C: ['a'] } }
    doc.nodes[3] = { id: 'adr', type: 'adr', label: 'D', concern: 'x', decision: 'We do {{A}} and {{B}}.', hubWhen: { C: ['a', 'b'] } }
    doc.nodes[4].description = 'Checked by a test.\n\nTool: Vitest\n\n```ts\nconst MAX = 5   // NUM\n```'
    expect(concernPackProblems(doc)).toEqual(expect.arrayContaining([
      'node "req" action: {{ZZZ}} names no question or detail of the pack',
      'detail M is asked but no text uses {{M}}',
      'question A: option "b" has {{…}} in its label; a label fills the texts and is not filled itself',
      'question A: option "a" has {{…}} in its description; the wizard shows it as written',
      'fitness function "ff": a line names NUM in a comment but hard-codes its value; use {{NUM}}: const MAX = 5   // NUM',
      'requirement "req": precondition starts with "while", which the EARS sentence adds itself',
      'question C: option "c" decides nothing: no element is imported for it and no decision names {{C}}',
      'fitness function "ff" is imported with none of the decisions it implements for {"A":"a","B":"a","C":"c"}',
    ]))
    expect(concernPackProblems(doc)).not.toEqual(expect.arrayContaining([expect.stringContaining('option "a" decides nothing')]))
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
      concern: { id: 'x', trigger: 'LIST NODES WHERE type = "webapp"', why: 'w', group: 'compliance' },
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

  // F-0009: Studio brought a pack into a model on the C4 metamodel, whose
  // validation then flagged all it brought; the MCP server refused it.
  it('refuses a pack the model\'s metamodel cannot hold, saying which types it lacks', () => {
    const concept: HubConcept = {
      id: 'concern-x', category: 'concern', name: 'X', description: 'd', tags: [],
      concern: { id: 'x', trigger: 'LIST NODES WHERE type = "webapp"', why: 'w', group: 'compliance' },
      nodes: [{ id: 'need', type: 'need', label: 'N', x: 0, y: 0 }, { id: 'adr', type: 'adr', label: 'D', concern: 'x', x: 300, y: 0 }],
      relations: [],
    }
    const options = { answers: {}, elements: [], today: '2026-10-22', newId: () => 'id', place: () => ({ x: 0, y: 0 }) }
    expect(() => buildConcernInsert(concept, { ...options, metamodel: builtInC4Metamodel() }))
      .toThrow('the metamodel "C4 (built-in)" has no type need, adr, nor relation constrains, satisfies, which the pack brings: it needs one that holds decisions and requirements, such as Radical')
    expect(metamodelProblem(concept, builtInGovernanceMetamodel())).toBeNull()
    expect(metamodelProblem(concept, undefined)).toBeNull()
  })
})
