import { MetamodelPreset } from '../types'
import { builtInC4Metamodel } from './c4'
import { builtInDddC4Metamodel } from './ddd'
import { builtInGovernanceMetamodel } from './governance'

export { builtInC4Metamodel } from './c4'
export { builtInDddC4Metamodel } from './ddd'
export { builtInGovernanceMetamodel } from './governance'

export function availableMetamodels(): MetamodelPreset[] {
  return [
    {
      id: 'c4-builtin',
      name: 'C4',
      description: 'Classic C4 model: Person, System, Container, Component, plus stores and queues.',
      build: builtInC4Metamodel,
    },
    {
      id: 'c4-ddd-builtin',
      name: 'C4 + DDD Domains',
      description: 'C4 extended with strategic DDD: a Domain container that nests recursively (Core / Supporting / Generic) above the technical model.',
      build: builtInDddC4Metamodel,
    },
    {
      id: 'c4-ddd-governance-builtin',
      name: 'C4 + DDD + Governance',
      description: 'C4 + DDD extended with governance: ADR (Architecture Decision Records), Fitness Functions, and EARS Requirements linked to architecture elements via Constrains, Supersedes, Implements, Satisfies, Derives, and Traces-to relations.',
      build: builtInGovernanceMetamodel,
    },
  ]
}
