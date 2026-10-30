// ─── Built-in viewpoints ────────────────────────────────────────────────────
// The viewpoints the built-in metamodels bring (viewpoints.ts): each a view
// type and a filter chain under a name, for a question asked of the model
// again and again, grouped by the concern it serves. C4 brings the C4 ones;
// Radical all of them, along the relations its types have. Some draw one
// element (subject): a view of each system's containers, each container's
// components, each domain, state machine and process.

import type { ViewPipeline } from '../../c4'
import type { ViewpointDef } from '../types'

const DEPLOYABLE = ['container', 'webapp', 'database', 'queue']
const BUILDING_BLOCKS = ['system', 'container', 'webapp', 'component', 'database', 'queue']

/** Every relation among the elements of `types`, on a canvas or matrix. */
function among(types: string[]): ViewPipeline {
  return { levels: [{ ways: [{ types }] }], edges: 'all' }
}

/** For a view of one element: the elements of `types` (the element and what
 *  lies inside it, once scoped), those of `around` related to them either
 *  way, and every relation among them. */
function aroundOne(types: string[], around: string[]): ViewPipeline {
  return { levels: [{ ways: [{ types }] }, { ways: [{ via: { anyRelation: true }, types: around }] }], edges: 'all' }
}

/** System context, containers, components and how containers depend on each other. */
export function c4Viewpoints(): ViewpointDef[] {
  return [
    {
      id: 'system-context',
      label: 'System context',
      group: 'C4',
      description: 'The people and software systems, and how they use each other (C4 level 1).',
      kind: 'static',
      pipeline: among(['person', 'system']),
    },
    {
      id: 'containers',
      label: 'Containers',
      group: 'C4',
      description: 'The software systems with the containers, web apps, databases and queues inside them, the people who use them, and every relation between them (C4 level 2).',
      kind: 'static',
      pipeline: among(['person', 'system', ...DEPLOYABLE]),
    },
    {
      id: 'system-containers',
      label: 'Containers of a system',
      group: 'C4',
      description: 'One software system with the containers, web apps, databases and queues inside it, and the people, systems and containers they are related to: a view per system (C4 level 2).',
      kind: 'static',
      subject: { types: ['system'] },
      pipeline: aroundOne(['system', ...DEPLOYABLE], ['person', 'system', ...DEPLOYABLE]),
    },
    {
      id: 'components',
      label: 'Components',
      group: 'C4',
      description: 'The containers and web apps with the components inside them, the databases and queues they use, and every relation between them (C4 level 3).',
      kind: 'static',
      pipeline: among(['container', 'webapp', 'component', 'database', 'queue']),
    },
    {
      id: 'container-components',
      label: 'Components of a container',
      group: 'C4',
      description: 'One container or web app with the components inside it, and the people, systems, containers and components they are related to: a view per container (C4 level 3).',
      kind: 'static',
      subject: { types: ['container', 'webapp'] },
      pipeline: aroundOne(['container', 'webapp', 'component'], ['person', 'system', ...DEPLOYABLE, 'component']),
    },
    {
      id: 'container-dependencies',
      label: 'Container dependencies',
      group: 'C4',
      description: 'A matrix of the containers, web apps, databases and queues: who uses whom, and where the cycles are.',
      kind: 'matrix',
      pipeline: among(DEPLOYABLE),
    },
  ]
}

/** The C4 viewpoints, then those for domains, requirements, decisions,
 *  screens, state machines and processes. */
export function radicalViewpoints(): ViewpointDef[] {
  return [
    ...c4Viewpoints(),
    {
      id: 'domain-map',
      label: 'Domain map',
      group: 'Domain',
      description: 'The domains and subdomains, and how they depend on and partner with each other.',
      kind: 'static',
      pipeline: among(['domain']),
    },
    {
      id: 'domain-model',
      label: 'Domain model',
      group: 'Domain',
      description: 'The entities and aggregates, what they are part of and what they reference.',
      kind: 'static',
      pipeline: among(['entity']),
    },
    {
      id: 'domain-entities',
      label: 'Entities of a domain',
      group: 'Domain',
      description: 'One domain with its subdomains and entities, and the entities of other domains they reference or are part of: a view per domain.',
      kind: 'static',
      subject: { types: ['domain'] },
      pipeline: {
        levels: [
          { ways: [{ types: ['domain', 'entity'] }] },
          { ways: [{ via: { relationType: 'references', direction: 'out' }, types: ['entity'] }, { via: { relationType: 'part-of', direction: 'out' }, types: ['entity'] }] },
        ],
        edges: 'all',
      },
    },
    {
      id: 'domain-realisation',
      label: 'Domain realisation',
      group: 'Domain',
      description: 'A table of domains, their entities, and the systems, containers and components that realise each.',
      kind: 'table',
      pipeline: { levels: [
        { ways: [{ types: ['domain'] }] },
        { ways: [{ via: { contains: true }, types: ['entity'] }, { via: { relationType: 'realises', direction: 'in' } }] },
        { ways: [{ via: { relationType: 'realises', direction: 'in' } }] },
      ] },
    },
    {
      id: 'traceability',
      label: 'Traceability',
      group: 'Requirements',
      description: 'A table of needs, the requirements refined from each, and the scenarios that verify those.',
      kind: 'table',
      pipeline: { levels: [
        { ways: [{ types: ['need'] }] },
        { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }] },
        { ways: [{ via: { relationType: 'verifies', direction: 'in' }, types: ['scenario'] }] },
      ] },
    },
    {
      id: 'requirement-coverage',
      label: 'Requirement coverage',
      group: 'Requirements',
      description: 'A table of requirements, the elements that satisfy each and the scenarios that verify it.',
      kind: 'table',
      pipeline: { levels: [
        { ways: [{ types: ['requirement'] }] },
        { ways: [{ via: { relationType: 'satisfies', direction: 'in' } }, { via: { relationType: 'verifies', direction: 'in' }, types: ['scenario'] }] },
      ] },
    },
    {
      id: 'requirement-gaps',
      label: 'Requirement gaps',
      group: 'Requirements',
      description: 'The requirements no scenario verifies or nothing satisfies yet.',
      kind: 'table',
      pipeline: { levels: [
        { ways: [{ types: ['requirement'] }], filters: [
          { kind: 'relation', relationType: 'verifies', direction: 'in', has: false },
          { kind: 'relation', relationType: 'satisfies', direction: 'in', has: false, join: 'or' },
        ] },
      ] },
    },
    {
      id: 'responsibilities',
      label: 'Responsibilities',
      group: 'Requirements',
      description: 'A table of the systems, containers and components that satisfy requirements, each with its requirements and the scenarios that verify them.',
      kind: 'table',
      pipeline: { levels: [
        { ways: [{ types: BUILDING_BLOCKS }], filters: [{ kind: 'relation', relationType: 'satisfies', direction: 'out', has: true }] },
        { ways: [{ via: { relationType: 'satisfies', direction: 'out' }, types: ['requirement'] }] },
        { ways: [{ via: { relationType: 'verifies', direction: 'in' }, types: ['scenario'] }] },
      ] },
    },
    {
      id: 'specification',
      label: 'Specification',
      group: 'Requirements',
      description: 'A document of the needs, the requirements refined from each, and the scenarios and screens for each requirement.',
      kind: 'wiki',
      pipeline: { levels: [
        { ways: [{ types: ['need'] }] },
        { ways: [{ via: { relationType: 'derives', direction: 'in' }, types: ['requirement'] }] },
        { ways: [{ via: { relationType: 'verifies', direction: 'in' }, types: ['scenario'] }, { via: { relationType: 'illustrates', direction: 'in' }, types: ['mockup'] }] },
      ] },
    },
    {
      id: 'decisions',
      label: 'Decisions',
      group: 'Decisions',
      description: 'A table of ADRs, the fitness functions that check each and the elements it constrains.',
      kind: 'table',
      pipeline: { levels: [
        { ways: [{ types: ['adr'] }] },
        { ways: [{ via: { relationType: 'implements', direction: 'in' }, types: ['fitness-fn'] }, { via: { relationType: 'constrains', direction: 'out' } }] },
      ] },
    },
    {
      id: 'decision-log',
      label: 'Decision log',
      group: 'Decisions',
      description: 'A document of the ADRs, the newest first, each with the decisions it supersedes.',
      kind: 'wiki',
      pipeline: {
        levels: [
          { ways: [{ types: ['adr'] }] },
          { ways: [{ via: { relationType: 'supersedes', direction: 'out' }, types: ['adr'] }] },
        ],
        sort: { by: 'property', key: 'date', desc: true },
      },
    },
    {
      id: 'fitness-functions',
      label: 'Fitness functions',
      group: 'Decisions',
      description: 'A table of the fitness functions by characteristic, each with the decisions it checks and the elements it constrains.',
      kind: 'table',
      pipeline: {
        levels: [
          { ways: [{ types: ['fitness-fn'] }] },
          { ways: [{ via: { relationType: 'implements', direction: 'out' }, types: ['adr'] }, { via: { relationType: 'constrains', direction: 'out' } }] },
        ],
        sort: { by: 'property', key: 'characteristic' },
      },
    },
    {
      id: 'screen-flow',
      label: 'Screen flow',
      group: 'UX',
      description: 'The screens and how users navigate from one to the next.',
      kind: 'static',
      pipeline: among(['mockup']),
    },
    {
      id: 'screens',
      label: 'Screens',
      group: 'UX',
      description: 'A table of the screens, each with the requirements and scenarios it illustrates and the elements that present it.',
      kind: 'table',
      pipeline: { levels: [
        { ways: [{ types: ['mockup'] }] },
        { ways: [{ via: { relationType: 'illustrates', direction: 'out' } }, { via: { relationType: 'presented-by', direction: 'out' } }] },
      ] },
    },
    {
      id: 'entity-lifecycles',
      label: 'Entity lifecycles',
      group: 'States',
      description: 'A table of the entities with a lifecycle, the state machine of each, and what implements and verifies it.',
      kind: 'table',
      pipeline: { levels: [
        { ways: [{ types: ['entity'] }], filters: [{ kind: 'relation', relationType: 'lifecycle-of', direction: 'in', has: true }] },
        { ways: [{ via: { relationType: 'lifecycle-of', direction: 'in' }, types: ['state-machine'] }] },
        { ways: [{ via: { relationType: 'implements', direction: 'in' } }, { via: { relationType: 'verifies', direction: 'in' }, types: ['scenario'] }] },
      ] },
    },
    {
      id: 'state-machine',
      label: 'State machine',
      group: 'States',
      description: 'One state machine with its states, pseudostates, events and transitions, and the entity it is the lifecycle of: a view per machine.',
      kind: 'static',
      subject: { types: ['state-machine'] },
      pipeline: {
        levels: [
          { ways: [{ types: ['state-machine', 'state', 'pseudostate', 'event'] }] },
          { ways: [{ via: { relationType: 'lifecycle-of', direction: 'out' }, types: ['entity'] }] },
        ],
        edges: 'all',
      },
    },
    {
      id: 'event-catalogue',
      label: 'Event catalogue',
      group: 'States',
      description: 'A table of the events, each with what emits it.',
      kind: 'table',
      pipeline: { levels: [
        { ways: [{ types: ['event'] }] },
        { ways: [{ via: { relationType: 'emits', direction: 'in' } }] },
      ] },
    },
    {
      id: 'process-warnier',
      label: 'Process (Warnier)',
      group: 'Process',
      description: 'The processes and their steps as Warnier–Orr diagrams: what each is made of, what repeats, what is an alternative and what runs at once.',
      kind: 'warnier',
      pipeline: { levels: [{ ways: [{ types: ['process', 'step'] }] }] },
    },
    {
      id: 'process',
      label: 'Process',
      group: 'Process',
      description: 'One process and its steps as a Warnier–Orr diagram: a view per process.',
      kind: 'warnier',
      subject: { types: ['process'] },
      pipeline: { levels: [{ ways: [{ types: ['process', 'step'] }] }] },
    },
  ]
}
