import { MetamodelPreset } from '../types'
import { builtInC4Metamodel } from './c4'
import { RADICAL_METAMODEL_NAME } from './governance'
import { builtInGovernanceMetamodel } from './governance'

export { builtInC4Metamodel } from './c4'
export { builtInDddC4Metamodel } from './ddd'
export { builtInGovernanceMetamodel } from './governance'

/** The metamodels a new model can start from: Radical (the default) and
 *  plain C4. (The C4 + DDD preset that used to be offered is part of Radical;
 *  documents saved with it load under Radical, see documentMetamodel.) */
export function availableMetamodels(): MetamodelPreset[] {
  return [
    {
      id: 'c4-ddd-governance-builtin',
      name: RADICAL_METAMODEL_NAME,
      description: 'C4 with DDD domains and entities, and what shapes the architecture: needs and EARS requirements, ADRs, fitness functions, scenarios, UI mockups and state machines, linked to the elements they concern.',
      build: builtInGovernanceMetamodel,
    },
    {
      id: 'c4-builtin',
      name: 'C4',
      description: 'Classic C4 model: Person, System, Container, Component, plus stores and queues.',
      build: builtInC4Metamodel,
    },
  ]
}
