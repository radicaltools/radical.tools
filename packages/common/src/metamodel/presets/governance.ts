// ─── Built-in C4 + DDD + Governance preset ──────────────────────────────────
//
// Extends C4 + DDD with two governance node types and three relation types:
//   • adr         — Architecture Decision Record (Nygard / MADR format)
//   • fitness-fn  — Fitness Function (Building Evolutionary Architectures)
//   • constrains  — adr / fitness-fn → any C4 element
//   • supersedes  — adr → adr (replaces an older decision)
//   • implements  — fitness-fn → adr ("this FF verifies ADR-003")
//   • mockup      — a UI screen (design link or AI-generated wireframe),
//                   linked via illustrates / presented-by / navigates-to

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
    // ADR: document with text lines
    iconPath: 'M4.5 1C3.67 1 3 1.67 3 2.5v11c0 .83.67 1.5 1.5 1.5h7c.83 0 1.5-.67 1.5-1.5V6L9 1H4.5ZM9 2l3 3.5H9V2ZM5 8h6v1H5V8Zm0 2.5h6v1H5v-1Zm0 2.5h3.5v1H5V13Z',
    width: 180,
    height: 52,
    collapsedWidth: 160,
    collapsedHeight: 52,
    allowedParents: ['system', 'domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    tableTab: true,
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
    // Concentric circles (target / gauge)
    iconPath: 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Zm0 1.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9ZM8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm0 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z',
    width: 180,
    height: 52,
    collapsedWidth: 160,
    collapsedHeight: 52,
    allowedParents: ['system', 'domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    tableTab: true,
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
    // Checklist / clipboard with checkmark
    iconPath: 'M5 1a1 1 0 0 0-1 1H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-1a1 1 0 0 0-1-1H5Zm0 1h6v1H5V2ZM4 5.5h1.5v1.5H4V5.5Zm3 .25h5v1H7v-1ZM4 9h1.5v1.5H4V9Zm3 .25h5v1H7v-1Z',
    width: 200,
    height: 80,
    collapsedWidth: 180,
    collapsedHeight: 80,
    allowedParents: ['system', 'domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    tableTab: true,
    hierarchyRelation: 'derives',
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

  // ── Gherkin Scenario ─────────────────────────────────────────────────────

  const scenarioProps: PropertyDef[] = [
    { key: 'given',   label: 'Given', type: 'textarea' },
    { key: 'when',    label: 'When',  type: 'textarea' },
    { key: 'then',    label: 'Then',  type: 'textarea' },
    { key: 'gherkin', label: 'Extra steps (And/But, raw Gherkin)', type: 'textarea' },
  ]

  const scenario: NodeTypeDef = {
    id: 'scenario',
    label: 'Scenario',
    color: '#166534',
    fg: '#fff',
    // Play/run triangle in a rounded frame
    iconPath: 'M3 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H3Zm3.5 2.5 5 3.5-5 3.5v-7Z',
    width: 200,
    height: 80,
    collapsedWidth: 180,
    collapsedHeight: 80,
    allowedParents: ['system', 'domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    tableTab: true,
    properties: scenarioProps,
  }

  // scenario → requirement: this scenario verifies that requirement
  const verifiesTargets = ['requirement'] as const
  const verifies: RelationTypeDef = {
    id: 'verifies',
    label: 'Verifies',
    allowedPairs: verifiesTargets.map(to => ({ from: 'scenario', to })),
    properties: [],
    color: '#16a34a',
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
    // Blueprint grid / technical drawing
    iconPath: 'M2 2h12v12H2V2Zm1 1v2h2V3H3Zm3 0v2h2V3H6Zm3 0v2h2V3H9Zm3 0v2h1V3h-1ZM3 6v2h2V6H3Zm3 0v2h2V6H6Zm3 0v2h2V6H9Zm3 0v2h1V6h-1ZM3 9v2h2V9H3Zm3 0v2h2V9H6Zm3 0v2h2V9H9Zm3 0v2h1V9h-1ZM3 12v1h2v-1H3Zm3 0v1h2v-1H6Zm3 0v1h2v-1H9Zm3 0v1h1v-1h-1Z',
    width: 520,
    height: 360,
    collapsedWidth: 360,
    collapsedHeight: 220,
    allowedParents: ['domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    hubOnly: true,
    tableTab: true,
    properties: blueprintProps,
  }

  // ── Mockup ────────────────────────────────────────────────────────────────
  //
  // A screen of the user-facing product: either a link to an external design
  // (Figma, Penpot, …) or a low-fi SVG wireframe generated by AI from the
  // requirements / scenarios it illustrates. The wireframe lives on the node
  // as `wireframe` (SVG markup) but is deliberately not a PropertyDef — it is
  // edited through the dedicated Mockup section, not a raw textarea / table
  // column.

  const mockupProps: PropertyDef[] = [
    { key: 'description', label: 'Description',  type: 'textarea' },
    { key: 'screen',      label: 'Screen / route', type: 'text' },
    { key: 'link',        label: 'Design link',  type: 'text' },
  ]

  const mockup: NodeTypeDef = {
    id: 'mockup',
    label: 'Mockup',
    color: '#be185d',
    fg: '#fff',
    // Browser window with a header bar and content blocks
    iconPath: 'M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5v-11ZM3 5v8.5c0 .28.22.5.5.5h9a.5.5 0 0 0 .5-.5V5H3Zm1 1.5h8v2H4v-2Zm0 3h3.5V13H4V9.5Zm4.5 0H12v1H8.5v-1Zm0 2H12v1H8.5v-1Z',
    width: 220,
    height: 190,
    collapsedWidth: 220,
    collapsedHeight: 190,
    allowedParents: ['system', 'domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    tableTab: true,
    properties: mockupProps,
  }

  // mockup → requirement / scenario: this screen illustrates that behaviour
  const illustrates: RelationTypeDef = {
    id: 'illustrates',
    label: 'Illustrates',
    allowedPairs: [
      { from: 'mockup', to: 'requirement' },
      { from: 'mockup', to: 'scenario' },
    ],
    properties: [],
    color: '#db2777',
    builtin: true,
  }

  // mockup → container: which part of the system renders this screen
  const presentedBy: RelationTypeDef = {
    id: 'presented-by',
    label: 'Presented by',
    allowedPairs: (['webapp', 'container', 'component', 'system'] as const).map(to => ({ from: 'mockup', to })),
    properties: [],
    color: '#be185d',
    builtin: true,
  }

  // mockup → mockup: screen flow
  const navigatesTo: RelationTypeDef = {
    id: 'navigates-to',
    label: 'Navigates to',
    allowedPairs: [{ from: 'mockup', to: 'mockup' }],
    properties: [
      { key: 'description', label: 'Trigger', type: 'text' },
    ],
    color: '#f472b6',
    builtin: true,
  }

  return {
    id: 'c4-ddd-governance-builtin',
    name: 'C4 + DDD + Governance',
    nodeTypes: {
      ...base.nodeTypes,
      adr,
      'fitness-fn': fitnessFn,
      requirement,
      scenario,
      blueprint,
      mockup,
    },
    relationTypes: {
      ...base.relationTypes,
      constrains,
      supersedes,
      implements: implements_,
      satisfies,
      derives,
      'traces-to': tracesTo,
      verifies,
      illustrates,
      'presented-by': presentedBy,
      'navigates-to': navigatesTo,
    },
  }
}
