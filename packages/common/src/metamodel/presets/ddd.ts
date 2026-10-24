// ─── DDD layer of the Radical metamodel ─────────────────────────────────────
//
// The base the Radical metamodel (governance.ts) builds on; no longer offered
// on its own, and documents saved with its id load as Radical. Extends the C4
// metamodel with a DDD layer:
//   • Domain — problem space; may live at root and may be nested inside
//     another domain to express subdomains / sub-subdomains arbitrarily deep.
//   • Entity — a domain object (Reservation, Order, Payment); `kind` says
//     whether it is an aggregate root. A part belongs to its aggregate root
//     (`part-of`), aggregates refer to each other (`references`), the C4
//     element that owns its data realises it, and a state machine models its
//     lifecycle (governance).
// The C4 `system` node may now also live inside a domain so it can model
// the technical realisation of that (sub)domain (≈ a Bounded Context).

import { Metamodel, NodeTypeDef, PropertyDef, RelationPair, RelationTypeDef } from '../types'
import { builtInC4Metamodel } from './c4'

export function builtInDddC4Metamodel(): Metamodel {
  const base = builtInC4Metamodel()

  // System may live at root, inside another system, domain, OR group.
  const patchedSystem: NodeTypeDef = {
    ...base.nodeTypes.system,
    allowedParents: ['system', 'domain', 'group'],
    allowedAtRoot: true,
  }

  const domainProps: PropertyDef[] = [
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'vision',      label: 'Vision',      type: 'textarea' },
    {
      key: 'kind',
      label: 'Kind',
      type: 'enum',
      options: ['core', 'supporting', 'generic'],
      default: 'core',
    },
  ]

  const domain: NodeTypeDef = {
    id: 'domain',
    layout: { role: 'element' },
    label: 'Domain',
    description: 'A part of the problem space, in the language of the business rather than of the software.',
    color: '#4c1d95',
    fg: '#fff',
    iconPath: 'M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9Zm1.5 1A.5.5 0 0 0 3 5v6a.5.5 0 0 0 .5.5h9A.5.5 0 0 0 13 11V5a.5.5 0 0 0-.5-.5h-9ZM5 7h2v2H5V7Zm4 0h2v2H9V7Z',
    width: 520,
    height: 360,
    collapsedWidth: 360,
    collapsedHeight: 220,
    // A domain may be nested inside another domain or a group.
    allowedParents: ['domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    properties: domainProps,
  }

  const entity: NodeTypeDef = {
    id: 'entity',
    layout: { role: 'element' },
    label: 'Entity',
    description: 'A thing the domain keeps track of and that has an identity over time: a reservation, an order, a payment.',
    color: '#7e22ce',
    fg: '#fff',
    // A record card with a key
    iconPath: 'M3 2.5A1.5 1.5 0 0 1 4.5 1h7A1.5 1.5 0 0 1 13 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-11ZM4.5 2a.5.5 0 0 0-.5.5V5h8V2.5a.5.5 0 0 0-.5-.5h-7ZM12 6H4v1.5h8V6Zm0 2.5H4V10h8V8.5Zm0 2.5H4v2.5c0 .28.22.5.5.5h7a.5.5 0 0 0 .5-.5V11Z',
    width: 170,
    height: 56,
    allowedParents: ['domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    // The parts of an aggregate list under its root in Table and Wiki views.
    hierarchyRelation: 'part-of',
    properties: [
      {
        key: 'kind',
        label: 'Kind',
        type: 'enum',
        options: ['aggregate-root', 'entity'],
        default: 'aggregate-root',
      },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  }

  // "Realises" — a system implements a domain (Bounded Context mapping), and
  // a C4 element owns (holds the data of) an entity.
  const realises: RelationTypeDef = {
    id: 'realises',
    layout: { flow: 'side' },
    label: 'Realises',
    description: "The software behind a domain or an entity: the bounded context that implements the domain, or the element that owns the entity's data.",
    inverseLabel: 'Realised by',
    allowedPairs: [
      { from: 'system',    to: 'domain' },
      { from: 'container', to: 'domain' },
      ...(['system', 'container', 'component', 'webapp'] as const).map((from) => ({ from, to: 'entity' })),
    ],
    properties: [],
    builtin: true,
  }

  // An entity that lives inside an aggregate → its root (an order line →
  // the order). Aggregates never contain each other: they refer by id.
  const partOf: RelationTypeDef = {
    id: 'part-of',
    layout: { flow: 'reverse', axis: 'vertical' },
    label: 'Part of',
    description: 'A part of an aggregate points to its root.',
    inverseLabel: 'Made up of',
    allowedPairs: [{ from: 'entity', to: 'entity' }],
    properties: [],
    color: '#7e22ce',
    builtin: true,
  }

  // One entity referring to another, across aggregates (a reservation is for
  // a customer).
  const references: RelationTypeDef = {
    id: 'references',
    layout: { flow: 'side', axis: 'horizontal' },
    label: 'References',
    description: 'One aggregate refers to another by id.',
    inverseLabel: 'Referenced by',
    allowedPairs: [{ from: 'entity', to: 'entity' }],
    properties: [
      {
        key: 'cardinality',
        label: 'Cardinality',
        type: 'enum',
        options: ['one', 'many'],
        default: 'one',
      },
      { key: 'description', label: 'Description', type: 'text' },
    ],
    color: '#a855f7',
    builtin: true,
  }

  // Strategic relations between domains. Covers the common DDD
  // context-mapping needs: a domain depends on / collaborates with another
  // domain (or its nested sub-domain).
  const ddPairs: RelationPair[] = [
    { from: 'domain', to: 'domain' },
  ]

  const dependsOn: RelationTypeDef = {
    id: 'depends-on',
    layout: { flow: 'forward' },
    label: 'Depends on',
    description: 'The source domain needs the target to do its work.',
    inverseLabel: 'Depended on by',
    allowedPairs: ddPairs,
    properties: [
      { key: 'description', label: 'Description', type: 'text' },
    ],
    builtin: true,
  }

  const partnership: RelationTypeDef = {
    id: 'partnership',
    layout: { flow: 'side', axis: 'horizontal' },
    label: 'Partnership',
    description: 'How the models of two domains meet, with a context-mapping pattern.',
    forwardLabel: 'Partners with',
    inverseLabel: 'Partners with',
    allowedPairs: ddPairs,
    properties: [
      {
        key: 'pattern',
        label: 'Pattern',
        type: 'enum',
        options: [
          'partnership',
          'shared-kernel',
          'customer-supplier',
          'conformist',
          'anti-corruption-layer',
          'open-host-service',
          'published-language',
          'separate-ways',
        ],
        default: 'partnership',
      },
      { key: 'description', label: 'Description', type: 'text' },
    ],
    builtin: true,
  }

  return {
    id: 'c4-ddd-builtin',
    name: 'C4 + DDD Domains',
    nodeTypes: {
      ...base.nodeTypes,
      system: patchedSystem,
      domain,
      entity,
    },
    relationTypes: {
      ...base.relationTypes,
      realises,
      'part-of': partOf,
      references,
      'depends-on': dependsOn,
      partnership,
    },
  }
}
