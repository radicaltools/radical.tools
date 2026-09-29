// ─── Built-in DDD-extended C4 preset ───────────────────────────────────────
//
// Extends the C4 metamodel with a single DDD-style strategic layer:
//   • Domain — problem space; may live at root and may be nested inside
//     another domain to express subdomains / sub-subdomains arbitrarily deep.
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
    label: 'Domain',
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

  // "Realises" — a system implements a domain (Bounded Context mapping).
  const realises: RelationTypeDef = {
    id: 'realises',
    label: 'Realises',
    allowedPairs: [
      { from: 'system',    to: 'domain' },
      { from: 'container', to: 'domain' },
    ],
    properties: [],
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
    label: 'Depends on',
    allowedPairs: ddPairs,
    properties: [
      { key: 'description', label: 'Description', type: 'text' },
    ],
    builtin: true,
  }

  const partnership: RelationTypeDef = {
    id: 'partnership',
    label: 'Partnership',
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
    },
    relationTypes: {
      ...base.relationTypes,
      realises,
      'depends-on': dependsOn,
      partnership,
    },
  }
}
