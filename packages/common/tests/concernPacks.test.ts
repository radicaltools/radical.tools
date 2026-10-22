/**
 * The standard every concern pack of the Hub meets (ADR Concern groups and
 * pack standard): its group, its questions and options, its sources, and
 * each fitness function's tool and snippet.
 */
import { describe, it, expect } from 'vitest'
import { concernPackProblems, CONCERN_GROUPS } from '../src/concerns'
import type { HubRadicalDoc } from '../src/hubFormat'

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
    expect(CONCERN_GROUPS.map((g) => g.id)).toEqual(['identity', 'security', 'data', 'integration', 'reliability', 'operations', 'maintainability', 'technology'])
  })

  it('names each way a pack falls below the standard', () => {
    const doc = good()
    doc.hub.concern!.group = 'quality'
    doc.hub.templateParams = [question('A'), { ...question('B'), options: [option('a'), option('b', ' ')] }]
    doc.hub.sources = [{ title: 'One', url: 'example.org' }]
    doc.nodes[4].description = 'Checked somehow.'
    const problems = concernPackProblems(doc)
    expect(problems).toEqual(expect.arrayContaining([
      expect.stringContaining('hub.concern.group must be one of identity, security'),
      'a concern pack asks at least three questions with options (it asks 2)',
      'question B: option "b" does not say what it means and when to pick it',
      'a concern pack names at least two sources (it names 1)',
      'source "One" needs a title and an http(s) link',
      'fitness function "ff" names no tool (a "Tool: …" line in its description)',
      'fitness function "ff" carries no snippet to copy (a fenced block in its description)',
    ]))
  })
})
