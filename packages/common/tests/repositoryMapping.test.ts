import { describe, expect, it } from 'vitest'
import { checkModel, type RepositoryMapping } from '../src/check'
import { builtIn, implementCommand, parseRepositoryMapping, serializeRepositoryMapping } from '../src/repositoryMapping'
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
    const mapped = parseRepositoryMapping(serializeRepositoryMapping([
      { element: 'shop', name: 'Shop', paths: ['.'] },
      { element: 'api', name: 'Orders API', paths: ['apps/api', 'apps/shared'] },
    ]))
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
