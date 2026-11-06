import { describe, expect, it } from 'vitest'
import { checkModel, type RepositoryMapping } from '../src/check'
import { OTHER_REPOSITORIES, builtIn, implementCommand, parseRepositoryFile, parseRepositoryMapping, repositoryPart, repositoryPartIds, serializeRepositoryFile } from '../src/repositoryMapping'
import { builtInGovernanceMetamodel } from '../src/metamodel'
import type { C4Node, DiagramData } from '../src/c4'

const node = (id: string, type: string, label: string, props: Record<string, unknown> = {}): C4Node =>
  ({ id, type, label, x: 0, y: 0, width: 200, height: 100, collapsed: false, ...props }) as C4Node
const data: DiagramData = {
  metamodel: builtInGovernanceMetamodel(),
  nodes: [node('shop', 'system', 'Shop'), node('api', 'container', 'Orders API', { parentId: 'shop' }), node('std', 'system', 'Standards', { origin: 'standards@abc1234' })],
  relations: [],
}
const found = (repository: RepositoryMapping | null | undefined) =>
  checkModel(data, {}, { repository }).findings.filter((f) => f.rule === 'repository-mapping').map((f) => [f.nodeId ?? null, f.message])

describe('repository mapping rule', () => {
  it('warns about an unknown element, a different name and a missing path', () => {
    expect(found({ file: '.radical/radical.json', implements: [
      { element: 'shop', name: 'Shop', paths: ['.'], missing: [] },
      { element: 'gone', name: 'Billing API', paths: ['apps/billing'], missing: [] },
      { element: 'api', name: 'Order API', paths: ['apps/api', 'apps/orders'], missing: ['apps/orders'] },
      // Another model's element: named on no element, that model cannot fix it.
      { element: 'std', name: 'Standard', paths: ['.'], missing: [] },
    ] })).toEqual([
      [null, '.radical/radical.json: "Billing API" (gone) is no element of the model.'],
      ['api', '.radical/radical.json: api is named "Order API"; the model calls it "Orders API".'],
      ['api', '.radical/radical.json: "Orders API" is built in apps/orders, which the repository does not have.'],
      [null, '.radical/radical.json: std is named "Standard"; the model calls it "Standards".'],
    ])
    // Without the file (Studio), nothing.
    expect(found(undefined)).toEqual([])
    expect(found(null)).toEqual([])
  })
})

describe('where an element is built', () => {
  it('gives the paths an element is built in, where they come from, and the command that maps one', () => {
    const mapped = parseRepositoryMapping(serializeRepositoryFile({ implements: [
      { element: 'shop', name: 'Shop', paths: ['.'] },
      { element: 'api', name: 'Orders API', paths: ['apps/api', 'apps/shared'] },
    ], verifies: [] }))
    const parent: Record<string, string> = { api: 'shop', checkout: 'api' }
    const at = (id: string) => builtIn(mapped, id, (n) => parent[n])
    expect([at('api'), at('checkout'), at('lonely')]).toEqual([{ paths: ['apps/api', 'apps/shared'], from: 'api' }, { paths: ['apps/api', 'apps/shared'], from: 'api' }, null])
    // By its name, unless another element has it.
    const nodes = [{ id: 'api', label: 'Orders API' }, { id: 'old', label: 'orders api' }, { id: 'web', label: 'Web shop' }]
    expect(implementCommand(nodes, nodes[2])).toBe('radical implement "Web shop" --path <folder>')
    expect(implementCommand(nodes, nodes[0])).toBe('radical implement api --path <folder>')
    expect(() => parseRepositoryMapping('{ "implements": [{ "element": "a" }] }')).toThrow('.radical/radical.json: implements[0] needs "element" (an id) and "paths" (a list of folders)')
  })
})

describe('a repository of one system model', () => {
  const relation = (id: string, relationType: string, sourceId: string, targetId: string) => ({ id, relationType, sourceId, targetId }) as unknown as DiagramData['relations'][number]
  const system: DiagramData = {
    metamodel: builtInGovernanceMetamodel(),
    nodes: [
      node('here', 'container', 'Here'), node('there', 'container', 'There'), node('part', 'component', 'Part', { parentId: 'here' }),
      node('need', 'need', 'Need'), node('needThere', 'need', 'Need there'),
      node('reqA', 'requirement', 'A', { ears_type: 'ubiquitous', action: 'the system shall do A' }),
      node('reqB', 'requirement', 'B', { ears_type: 'ubiquitous', action: 'the system shall do B' }),
      node('scenA', 'scenario', 'Scenario A', { given: 'g', when: 'w', then: 't' }),
      node('scenB', 'scenario', 'Scenario B', { given: 'g', when: 'w', then: 't' }),
      node('adrHere', 'adr', 'Decision here'), node('adrThere', 'adr', 'Decision there'),
      node('ffHere', 'fitness-fn', 'Measure here'), node('ffThere', 'fitness-fn', 'Measure there'),
      node('std', 'system', 'Standards', { origin: 'standards@abc1234' }),
    ],
    relations: [
      relation('r1', 'satisfies', 'part', 'reqA'), relation('r2', 'satisfies', 'there', 'reqB'),
      relation('r3', 'derives', 'reqA', 'need'), relation('r4', 'derives', 'reqB', 'needThere'),
      relation('r5', 'verifies', 'scenA', 'reqA'), relation('r6', 'verifies', 'scenB', 'reqB'),
      relation('r7', 'constrains', 'adrHere', 'here'), relation('r8', 'constrains', 'adrThere', 'there'),
      relation('r9', 'implements', 'ffHere', 'adrHere'), relation('r10', 'implements', 'ffThere', 'adrThere'),
    ],
  }
  const mapped = [{ element: 'here', paths: ['.'] }]
  const repository = (model?: { repo: string }): RepositoryMapping => ({
    file: '.radical/radical.json', ...(model ? { model } : {}),
    implements: [{ element: 'here', paths: ['.'], missing: [] }],
    verifies: [{ element: 'scenA', tests: ['a.test.ts › does A'] }],
  })
  const verified = (r: RepositoryMapping) => {
    const result = checkModel(system, { goals: { 'requirements-verified': { min: 70 } } }, { repository: r, tests: [{ file: 'a.test.ts', title: ['does A'], status: 'passed' }] })
    return { metric: result.metrics.find((m) => m.id === 'requirements-verified'), findings: result.findings }
  }

  it('reads the model it names, and writes it back', () => {
    const file = parseRepositoryFile('{ "model": { "repo": "https://example.com/arch.git", "ref": "main" }, "implements": [] }')
    expect(file.model).toEqual({ repo: 'https://example.com/arch.git', ref: 'main' })
    expect(parseRepositoryFile(serializeRepositoryFile(file)).model).toEqual(file.model)
    expect(serializeRepositoryFile(file)).toContain('"model": { "repo": "https://example.com/arch.git", "ref": "main" }')
    expect(() => parseRepositoryFile('{ "model": { "ref": "main" } }')).toThrow('"model" needs "repo"')
    expect(parseRepositoryFile('{ "implements": [] }').model).toBeUndefined()
  })

  it('marks what it does not build, and keeps a dependency\'s own mark', () => {
    const part = repositoryPart(system, mapped)
    const others = part.nodes.filter((n) => n.origin === OTHER_REPOSITORIES).map((n) => n.id).sort()
    expect(others).toEqual(['adrThere', 'ffThere', 'needThere', 'reqB', 'scenB', 'there'])
    expect(part.nodes.find((n) => n.id === 'std')!.origin).toBe('standards@abc1234')
    expect(part.relations.filter((r) => !r.origin).map((r) => r.id).sort()).toEqual(['r1', 'r3', 'r5', 'r7', 'r9'])
  })

  it('leaves another repository\'s gaps out, and counts goals on its part', () => {
    const { metric, findings } = verified(repository({ repo: 'https://example.com/arch.git' }))
    expect(metric).toMatchObject({ count: 1, total: 1, percent: 100, met: true })
    const on = new Set(findings.map((f) => f.nodeId))
    for (const id of ['there', 'reqB', 'scenB', 'needThere', 'adrThere', 'ffThere']) expect(on.has(id)).toBe(false)
  })

  it('takes in the state machines it implements and of the entities it realises, with all in them', () => {
    const data = {
      nodes: [
        { id: 'here', type: 'container' }, { id: 'there', type: 'container' }, { id: 'order', type: 'entity' }, { id: 'parcel', type: 'entity' },
        { id: 'mOrder', type: 'state-machine' }, { id: 'sPlaced', type: 'state', parentId: 'mOrder' }, { id: 'sPaid', type: 'state', parentId: 'mOrder' },
        { id: 'mStock', type: 'state-machine' }, { id: 'sHeld', type: 'state', parentId: 'mStock' },
        { id: 'mParcel', type: 'state-machine' }, { id: 'sBooked', type: 'state', parentId: 'mParcel' },
        { id: 'scenOrder', type: 'scenario' }, { id: 'scenStock', type: 'scenario' }, { id: 'scenParcel', type: 'scenario' },
      ],
      relations: [
        relation('a', 'realises', 'here', 'order'), relation('b', 'lifecycle-of', 'mOrder', 'order'),
        relation('c', 'implements', 'here', 'mStock'), relation('d', 'implements', 'there', 'mParcel'), relation('e', 'lifecycle-of', 'mParcel', 'parcel'),
        relation('f', 'transition', 'sPlaced', 'sPaid'),
        relation('g', 'verifies', 'scenOrder', 'mOrder'), relation('h', 'verifies', 'scenStock', 'mStock'), relation('i', 'verifies', 'scenParcel', 'mParcel'),
      ],
    }
    expect([...repositoryPartIds(data, mapped)].sort()).toEqual(['here', 'mOrder', 'mStock', 'order', 'sHeld', 'sPaid', 'sPlaced', 'scenOrder', 'scenStock'])
  })

  it('finds what is missing of its state machine\'s scenario, and nothing of another repository\'s', () => {
    const machines: DiagramData = {
      ...system,
      nodes: [...system.nodes, node('mHere', 'state-machine', 'Here machine'), node('mThere', 'state-machine', 'There machine'),
        node('scenM', 'scenario', 'Scenario M', { given: 'g', when: 'w', then: 't' }), node('scenN', 'scenario', 'Scenario N', { given: 'g', when: 'w', then: 't' })],
      relations: [...system.relations, relation('m1', 'implements', 'part', 'mHere'), relation('m2', 'implements', 'there', 'mThere'),
        relation('m3', 'verifies', 'scenM', 'mHere'), relation('m4', 'verifies', 'scenN', 'mThere')],
    }
    const { findings } = checkModel(machines, {}, { repository: repository({ repo: 'https://example.com/arch.git' }), tests: [{ file: 'a.test.ts', title: ['does A'], status: 'passed' }] })
    const on = new Set(findings.map((f) => f.nodeId))
    expect(on.has('scenM')).toBe(true)
    expect(on.has('scenN')).toBe(false)
  })

  it('judges the whole model when it names none, as before', () => {
    const { metric, findings } = verified(repository())
    expect(metric).toMatchObject({ count: 1, total: 2, percent: 50, met: false })
    expect(findings.some((f) => f.nodeId === 'scenB')).toBe(true)
  })
})
