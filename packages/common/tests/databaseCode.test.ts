import { describe, expect, it } from 'vitest'
import { builtInC4Metamodel, builtInGovernanceMetamodel, isParentAllowed, isRelationAllowed, relationTypesFitting } from '../src/metamodel'
import { isContainerType, type C4Node } from '../src/c4'
import { chainOfViewpoint, viewpointsOf } from '../src/viewpoints'

// A database is a container that may run code (ADR "A database can hold and
// run code"): it holds its packages as components and calls out, as C4 lets
// any container do; it still delivers nothing to a person.
describe('A database that runs code', () => {
  it('lets a component sit in a database, a database call what a container calls and a person use one, in both built-in metamodels, and refuses a database delivering to a person', () => {
    for (const mm of [builtInC4Metamodel(), builtInGovernanceMetamodel()]) {
      expect(isParentAllowed(mm, 'component', 'database')).toBe(true)
      for (const to of ['system', 'container', 'webapp', 'database', 'queue', 'component']) {
        expect([to, relationTypesFitting(mm, 'database', to).map((r) => r.id)]).toEqual([to, ['interacts']])
      }
      expect(relationTypesFitting(mm, 'person', 'database').map((r) => r.id)).toEqual(['interacts'])
      expect(isRelationAllowed(mm, 'database', 'person')).toBe(false)
      // Nothing else goes inside a database.
      for (const child of ['container', 'webapp', 'database', 'queue', 'group']) expect([child, isParentAllowed(mm, child, 'database')]).toEqual([child, false])
    }
    expect(isContainerType('database')).toBe(true)
  })

  it('lets a database realise an entity, implement a state machine and perform a step on the Radical metamodel, and the Components viewpoint draw it with its components', () => {
    const mm = builtInGovernanceMetamodel()
    expect(relationTypesFitting(mm, 'database', 'entity').map((r) => r.id)).toEqual(['realises'])
    expect(relationTypesFitting(mm, 'database', 'state-machine').map((r) => r.id)).toEqual(['implements'])
    expect(relationTypesFitting(mm, 'step', 'database').map((r) => r.id)).toEqual(['performed-by'])
    for (const metamodel of [mm, builtInC4Metamodel()]) {
      const components = viewpointsOf(metamodel).find((v) => v.id === 'components')!
      const types = chainOfViewpoint(components).levels!.flatMap((l) => l.ways.flatMap((w) => w.types ?? []))
      expect(types).toEqual(expect.arrayContaining(['database', 'component']))
      // A view per database would be noise: most hold no code.
      expect(viewpointsOf(metamodel).find((v) => v.id === 'container-components')!.subject!.types).not.toContain('database')
    }
  })
})
