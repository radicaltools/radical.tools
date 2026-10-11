import { describe, it, expect } from 'vitest'
import { builtInC4Metamodel, builtInGovernanceMetamodel, isParentAllowed } from '../src/metamodel'

describe('C4 containment', () => {
  for (const [name, mm] of [['c4', builtInC4Metamodel()], ['governance', builtInGovernanceMetamodel()]] as const) {
    it(`${name}: a group may sit inside a system, to group its parts`, () => {
      expect(isParentAllowed(mm, 'group', 'system')).toBe(true)
      // …and a component may then sit in that group, as with any group.
      expect(isParentAllowed(mm, 'component', 'group')).toBe(true)
    })

    it(`${name}: a group still may not sit inside a container or component`, () => {
      expect(isParentAllowed(mm, 'group', 'container')).toBe(false)
      expect(isParentAllowed(mm, 'group', 'component')).toBe(false)
    })
  }
})
