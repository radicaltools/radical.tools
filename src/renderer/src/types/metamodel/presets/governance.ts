// ─── Built-in C4 + DDD + Governance preset ──────────────────────────────────
//
// Extends C4 + DDD with two governance node types and three relation types:
//   • adr         — Architecture Decision Record (Nygard / MADR format)
//   • fitness-fn  — Fitness Function (Building Evolutionary Architectures)
//   • constrains  — adr / fitness-fn → any C4 element
//   • supersedes  — adr → adr (replaces an older decision)
//   • implements  — fitness-fn → adr ("this FF verifies ADR-003")

import { COLLAPSED_HEIGHT, COLLAPSED_WIDTH, NODE_SIZES, TYPE_ICON_PATHS } from '../../c4'
import { Metamodel, NodeTypeDef, PropertyDef, RelationPair, RelationTypeDef } from '../types'
import { builtInDddC4Metamodel } from './ddd'

export function builtInGovernanceMetamodel(): Metamodel {
  const base = builtInDddC4Metamodel()

  const adrProps: PropertyDef[] = [
    {
      key: 'status',
      label: 'Status',
      type: 'enum',
      options: ['proposed', 'accepted', 'deprecated', 'superseded'],
      default: 'proposed',
    },
    { key: 'date',         label: 'Date',                   type: 'text' },
    { key: 'context',      label: 'Context',                type: 'textarea' },
    { key: 'decision',     label: 'Decision',               type: 'textarea' },
    { key: 'consequences', label: 'Consequences',           type: 'textarea' },
    { key: 'alternatives', label: 'Alternatives considered', type: 'textarea' },
  ]

  const adr: NodeTypeDef = {
    id: 'adr',
    label: 'ADR',
    color: '#92400e',
    fg: '#fff',
    iconPath: TYPE_ICON_PATHS['adr'],
    width: NODE_SIZES['adr'].width,
    height: NODE_SIZES['adr'].height,
    collapsedWidth: COLLAPSED_WIDTH['adr'],
    collapsedHeight: COLLAPSED_HEIGHT['adr'],
    allowedParents: ['system', 'domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    properties: adrProps,
  }

  const fitnessFnProps: PropertyDef[] = [
    { key: 'description', label: 'Description', type: 'textarea' },
    {
      key: 'category',
      label: 'Category',
      type: 'enum',
      options: ['structural', 'operational', 'process', 'holistic'],
      default: 'structural',
    },
    { key: 'threshold', label: 'Threshold / Success criteria', type: 'text' },
  ]

  const fitnessFn: NodeTypeDef = {
    id: 'fitness-fn',
    label: 'Fitness Function',
    color: '#5b21b6',
    fg: '#fff',
    iconPath: TYPE_ICON_PATHS['fitness-fn'],
    width: NODE_SIZES['fitness-fn'].width,
    height: NODE_SIZES['fitness-fn'].height,
    collapsedWidth: COLLAPSED_WIDTH['fitness-fn'],
    collapsedHeight: COLLAPSED_HEIGHT['fitness-fn'],
    allowedParents: ['system', 'domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    properties: fitnessFnProps,
  }

  // ── EARS Requirement ──────────────────────────────────────────────────────

  const requirementProps: PropertyDef[] = [
    {
      key: 'ears_type',
      label: 'EARS type',
      type: 'enum',
      options: ['ubiquitous', 'event-driven', 'state-driven', 'unwanted-behaviour', 'optional', 'complex'],
      default: 'ubiquitous',
    },
    { key: 'trigger',             label: 'When (trigger)',            type: 'text',     visibleWhen: { key: 'ears_type', values: ['event-driven', 'complex'] } },
    { key: 'precondition',        label: 'While (precondition)',      type: 'text',     visibleWhen: { key: 'ears_type', values: ['state-driven', 'complex'] } },
    { key: 'unwanted_condition',  label: 'If (unwanted condition)',   type: 'text',     visibleWhen: { key: 'ears_type', values: ['unwanted-behaviour', 'complex'] } },
    { key: 'feature',             label: 'Where (feature)',           type: 'text',     visibleWhen: { key: 'ears_type', values: ['optional', 'complex'] } },
    { key: 'action',              label: 'The system shall (action)', type: 'textarea' },
    { key: 'rationale',           label: 'Rationale',                 type: 'textarea' },
  ]

  const requirement: NodeTypeDef = {
    id: 'requirement',
    label: 'Requirement',
    color: '#0e7490',
    fg: '#fff',
    iconPath: TYPE_ICON_PATHS['requirement'],
    width: NODE_SIZES['requirement'].width,
    height: NODE_SIZES['requirement'].height,
    collapsedWidth: COLLAPSED_WIDTH['requirement'],
    collapsedHeight: COLLAPSED_HEIGHT['requirement'],
    allowedParents: ['system', 'domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    properties: requirementProps,
  }

  const constraintSources = ['adr', 'fitness-fn', 'requirement'] as const
  const constraintTargets = ['person', 'system', 'domain', 'container', 'component', 'database', 'webapp', 'queue'] as const
  const constrainsPairs: RelationPair[] = constraintSources.flatMap(from =>
    constraintTargets.map(to => ({ from, to })),
  )

  const constrains: RelationTypeDef = {
    id: 'constrains',
    label: 'Constrains',
    allowedPairs: constrainsPairs,
    properties: [
      { key: 'description', label: 'Note', type: 'text' },
    ],
    color: '#dc2626',
    builtin: true,
  }

  const supersedes: RelationTypeDef = {
    id: 'supersedes',
    label: 'Supersedes',
    allowedPairs: [{ from: 'adr', to: 'adr' }],
    properties: [],
    color: '#f59e0b',
    builtin: true,
  }

  const implements_: RelationTypeDef = {
    id: 'implements',
    label: 'Implements',
    allowedPairs: [{ from: 'fitness-fn', to: 'adr' }],
    properties: [],
    color: '#7c3aed',
    builtin: true,
  }

  // requirement → element: the element satisfies this requirement
  const satisfiesTargets = ['person', 'system', 'domain', 'container', 'component', 'database', 'webapp', 'queue'] as const
  const satisfies: RelationTypeDef = {
    id: 'satisfies',
    label: 'Satisfies',
    allowedPairs: satisfiesTargets.map(to => ({ from: to, to: 'requirement' })),
    properties: [
      { key: 'description', label: 'Note', type: 'text' },
    ],
    color: '#0891b2',
    builtin: true,
  }

  // requirement → requirement decomposition
  const derives: RelationTypeDef = {
    id: 'derives',
    label: 'Derives from',
    allowedPairs: [{ from: 'requirement', to: 'requirement' }],
    properties: [],
    color: '#0d9488',
    builtin: true,
  }

  // requirement → ADR traceability
  const tracesTo: RelationTypeDef = {
    id: 'traces-to',
    label: 'Traces to',
    allowedPairs: [
      { from: 'requirement', to: 'adr' },
      { from: 'requirement', to: 'fitness-fn' },
    ],
    properties: [],
    color: '#06b6d4',
    builtin: true,
  }

  // ── Blueprint ─────────────────────────────────────────────────────────────

  const blueprintProps: PropertyDef[] = [
    { key: 'description', label: 'Description', type: 'textarea' },
    {
      key: 'status',
      label: 'Status',
      type: 'enum',
      options: ['draft', 'reviewed', 'approved', 'deprecated'],
      default: 'draft',
    },
    { key: 'domain',   label: 'Domain / Context',  type: 'text' },
    { key: 'rationale', label: 'Rationale', type: 'textarea' },
  ]

  const blueprint: NodeTypeDef = {
    id: 'blueprint',
    label: 'Blueprint',
    color: '#1e3a5f',
    fg: '#fff',
    iconPath: TYPE_ICON_PATHS['blueprint'],
    width: NODE_SIZES['blueprint'].width,
    height: NODE_SIZES['blueprint'].height,
    collapsedWidth: COLLAPSED_WIDTH['blueprint'],
    collapsedHeight: COLLAPSED_HEIGHT['blueprint'],
    allowedParents: ['domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    hubOnly: true,
    properties: blueprintProps,
  }

  return {
    id: 'c4-ddd-governance-builtin',
    name: 'C4 + DDD + Governance',
    nodeTypes: {
      ...base.nodeTypes,
      adr,
      'fitness-fn': fitnessFn,
      requirement,
      blueprint,
    },
    relationTypes: {
      ...base.relationTypes,
      constrains,
      supersedes,
      implements: implements_,
      satisfies,
      derives,
      'traces-to': tracesTo,
    },
  }
}
