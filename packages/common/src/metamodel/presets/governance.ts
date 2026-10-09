// ─── Built-in C4 + DDD + Governance preset ──────────────────────────────────
//
// Extends C4 + DDD with two governance node types and three relation types:
//   • adr         — Architecture Decision Record (Nygard / MADR format)
//   • fitness-fn  — Fitness Function (Building Evolutionary Architectures)
//   • constrains  — adr / fitness-fn → any C4 element
//   • supersedes  — adr → adr (replaces an older decision)
//   • implements  — fitness-fn → adr ("this FF verifies ADR-003")
//   • need        — raw free-text input (brief, notes, raw requirements) that
//                   EARS requirements are derived from (requirement → need)
//   • mockup      — a UI screen (design link or AI-generated wireframe),
//                   linked via illustrates / presented-by / navigates-to
//   • state-machine, state, pseudostate, event — event-driven hierarchical
//                   state machines, linked via transition / lifecycle-of / emits

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
    wizard: {
      trigger: 'create',
      prefill: { status: 'proposed', date: '{{today}}' },
      steps: [
        { kind: 'fields', title: 'Title & status', fields: ['label', 'status', 'date'],
          help: 'Name the decision in a few words, e.g. "Use PostgreSQL for order storage".' },
        { kind: 'fields', title: 'Context', fields: ['context'],
          help: 'What forces are at play — the problem, constraints and drivers that make a decision necessary now?' },
        { kind: 'fields', title: 'Decision', fields: ['decision'],
          help: 'What did you decide? State it actively: "We will …".' },
        { kind: 'fields', title: 'Alternatives', fields: ['alternatives'],
          help: 'Which other options did you consider, and why were they rejected?' },
        { kind: 'fields', title: 'Consequences', fields: ['consequences'],
          help: 'What becomes easier or harder? Include the downsides and the risks you accept.' },
        { kind: 'relations', title: 'Affected elements', relationType: 'constrains', direction: 'out',
          help: 'Which parts of the architecture must follow this decision?' },
        { kind: 'relations', title: 'Supersedes', relationType: 'supersedes', direction: 'out',
          help: 'Does this decision replace an earlier one? Leave empty if not.' },
      ],
    },
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
    wizard: {
      trigger: 'create',
      steps: [
        { kind: 'fields', title: 'Name & category', fields: ['label', 'category'],
          help: 'Name the architectural characteristic this function protects, e.g. "Checkout p95 latency".' },
        { kind: 'fields', title: 'What it measures', fields: ['description'],
          help: 'How is the characteristic measured — a test, a metric, a static check?' },
        { kind: 'fields', title: 'Success criteria', fields: ['threshold'],
          help: 'When does it pass? Give a concrete threshold, e.g. "p95 < 300 ms".' },
        { kind: 'relations', title: 'Verified decisions', relationType: 'implements', direction: 'out',
          help: 'Which ADRs does this fitness function verify?' },
        { kind: 'relations', title: 'Guarded elements', relationType: 'constrains', direction: 'out',
          help: 'Which elements does it check?' },
      ],
    },
  }

  // ── Need (ISO/IEC/IEEE 29148 "stakeholder need") ─────────────────────────
  //
  // Raw, unstructured input — a brief, user story, meeting notes, a quoted
  // regulation, raw requirements — kept verbatim as the node's `description`
  // (so it is the Markdown body of its file in an md-folder model). EARS
  // requirements are derived from it (requirement --derives--> need), and a
  // need nests under a broader one the same way (need --derives--> need); it is
  // deliberately not a requirement itself, so nothing `satisfies` or
  // `verifies` it. It has no status: being in the model means it is
  // accepted. Radical Forge stores its input description as one.

  const needProps: PropertyDef[] = [
    { key: 'description', label: 'Text', type: 'textarea' },
    {
      key: 'kind',
      label: 'Kind',
      type: 'enum',
      options: ['brief', 'user-story', 'stakeholder-note', 'meeting-notes', 'regulation', 'other'],
      default: 'brief',
    },
    { key: 'source', label: 'Source (who / where from)', type: 'text' },
  ]

  const need: NodeTypeDef = {
    id: 'need',
    label: 'Need',
    color: '#475569',
    fg: '#fff',
    // Speech bubble with text lines
    iconPath: 'M3 2a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 3 12h1.5v2.5L8 12h5a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13 2H3Zm1.5 3h7v1h-7V5Zm0 2.5h5v1h-5v-1Z',
    width: 200,
    height: 80,
    collapsedWidth: 180,
    collapsedHeight: 80,
    allowedParents: ['system', 'domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    tableTab: true,
    // A need's wiki page and table tab list what derives from it — sub-needs
    // and requirements — as its children; "add child" creates either.
    hierarchyRelation: 'derives',
    properties: needProps,
    wizard: {
      trigger: 'create',
      steps: [
        { kind: 'fields', title: 'Name & kind', fields: ['label', 'kind'],
          help: 'A short name, e.g. "Checkout brief from Sales". Pick what kind of input it is.' },
        { kind: 'fields', title: 'Text', fields: ['description'],
          help: 'Paste the input as-is — a brief, user story, notes or raw requirements. No format needed; Radical Forge or you can turn it into EARS requirements later.' },
        { kind: 'fields', title: 'Source', fields: ['source'],
          help: 'Who it came from or where it lives (a person, meeting, ticket or link).' },
        { kind: 'relations', title: 'Part of', relationType: 'derives', direction: 'out',
          help: 'Is this part of a broader need, e.g. one stakeholder\'s notes within a discovery? Leave empty if not.' },
      ],
    },
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
    // The state the precondition is, when it is one of a state machine's:
    // "While the Reservation is Confirmed". Takes the place of the text.
    { key: 'precondition_state',  label: 'While in state',            type: 'ref',      refType: 'state', visibleWhen: { key: 'ears_type', values: ['state-driven', 'complex'] } },
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
    wizard: {
      trigger: 'create',
      steps: [
        { kind: 'fields', title: 'Name', fields: ['label'],
          help: 'A short name for the requirement, e.g. "Lock account after failed logins".' },
        { kind: 'custom', title: 'Sentence', component: 'ears-quick-entry',
          help: 'Type the requirement as one sentence and press Enter — the EARS fields are filled for you. Or skip and fill them in the next step.' },
        { kind: 'fields', title: 'EARS fields', fields: ['ears_type', 'trigger', 'precondition', 'precondition_state', 'unwanted_condition', 'feature', 'action'],
          help: 'Pick the EARS pattern; only the clauses it uses are shown.' },
        { kind: 'fields', title: 'Rationale', fields: ['rationale'],
          help: 'Why is this requirement needed? Who asked for it?' },
        { kind: 'relations', title: 'Satisfied by', relationType: 'satisfies', direction: 'in',
          help: 'Which elements must satisfy this requirement?' },
        { kind: 'relations', title: 'Derives from', relationType: 'derives', direction: 'out',
          help: 'Is this a refinement of a broader requirement, or derived from a need?' },
        { kind: 'relations', title: 'Traces to', relationType: 'traces-to', direction: 'out',
          help: 'Which decisions or fitness functions follow from it?' },
      ],
    },
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

  // requirement → requirement decomposition, requirement → need (the raw
  // input it was derived from) and need → need (a need within a broader one)
  const derives: RelationTypeDef = {
    id: 'derives',
    label: 'Derives from',
    allowedPairs: [
      { from: 'requirement', to: 'requirement' },
      { from: 'requirement', to: 'need' },
      { from: 'need', to: 'need' },
    ],
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
    wizard: {
      trigger: 'create',
      steps: [
        { kind: 'fields', title: 'Name', fields: ['label'],
          help: 'Name the behaviour, e.g. "Card payment declined".' },
        { kind: 'fields', title: 'Given', fields: ['given'],
          help: 'The starting state: who is involved and what is already true.' },
        { kind: 'fields', title: 'When', fields: ['when'],
          help: 'The single action or event under test.' },
        { kind: 'fields', title: 'Then', fields: ['then', 'gherkin'],
          help: 'The observable outcome. Add And/But steps below if needed.' },
        { kind: 'relations', title: 'Verified requirements', relationType: 'verifies', direction: 'out',
          help: 'Which requirements does this scenario verify?' },
      ],
    },
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
    wizard: {
      trigger: 'create',
      steps: [
        { kind: 'fields', title: 'Screen', fields: ['label', 'screen', 'description'],
          help: 'Which screen is this, and what does the user do on it?' },
        { kind: 'fields', title: 'Design link', fields: ['link'],
          help: 'A Figma / Penpot link, if the design exists. You can generate a wireframe from the properties panel later.' },
        { kind: 'relations', title: 'Illustrates', relationType: 'illustrates', direction: 'out',
          help: 'Which requirements or scenarios does this screen show?' },
        { kind: 'relations', title: 'Presented by', relationType: 'presented-by', direction: 'out',
          help: 'Which part of the system renders it?' },
      ],
    },
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

  // ── States: event-driven hierarchical state machines ─────────────────
  //
  // Statecharts with SCXML / XState semantics. A state machine holds states;
  // a state with child states is compound, and one of kind `parallel` has
  // its child states active at once (each child is a region). Nesting is
  // canvas containment, as for systems and containers. Every compound state
  // and the machine itself enter through an `initial` pseudostate, whose one
  // transition points at the default child. A transition points at its
  // trigger (`event`) and at the events it raises (`raises`) with reference
  // properties: a relation cannot point at a node, a property can.

  const stateMachine: NodeTypeDef = {
    id: 'state-machine',
    label: 'State Machine',
    color: '#3730a3',
    fg: '#fff',
    // Two states joined by a transition
    iconPath: 'M1 3.5A1.5 1.5 0 0 1 2.5 2h3A1.5 1.5 0 0 1 7 3.5v2A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-2Zm8 7A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 12.5v-2ZM3.5 8h1v3h2.8v-1l2 1.5-2 1.5v-1H3.5V8Z',
    width: 560,
    height: 380,
    collapsedWidth: 200,
    collapsedHeight: 64,
    allowedParents: ['system', 'domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    tableTab: true,
    properties: [
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  }

  const state: NodeTypeDef = {
    id: 'state',
    label: 'State',
    color: '#4f46e5',
    fg: '#fff',
    // Rounded rectangle
    iconPath: 'M3.5 3h9A2.5 2.5 0 0 1 15 5.5v5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 10.5v-5A2.5 2.5 0 0 1 3.5 3Zm0 1.5a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1h-9Z',
    width: 320,
    height: 220,
    collapsedWidth: 170,
    collapsedHeight: 72,
    allowedParents: ['state-machine', 'state'],
    allowedAtRoot: false,
    builtin: true,
    tableTab: true,
    properties: [
      {
        key: 'kind',
        label: 'Kind',
        type: 'enum',
        options: ['normal', 'parallel', 'final'],
        default: 'normal',
      },
      { key: 'entry', label: 'Entry actions', type: 'text', visibleWhen: { key: 'kind', values: ['normal', 'parallel'] } },
      { key: 'exit',  label: 'Exit actions',  type: 'text', visibleWhen: { key: 'kind', values: ['normal', 'parallel'] } },
      { key: 'do',    label: 'Do (ongoing activity)', type: 'text', visibleWhen: { key: 'kind', values: ['normal'] } },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  }

  const pseudostate: NodeTypeDef = {
    id: 'pseudostate',
    label: 'Pseudostate',
    color: '#1e1b4b',
    fg: '#fff',
    // Filled dot (initial)
    iconPath: 'M8 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
    width: 36,
    height: 36,
    allowedParents: ['state-machine', 'state'],
    allowedAtRoot: false,
    builtin: true,
    properties: [
      {
        key: 'kind',
        label: 'Kind',
        type: 'enum',
        options: ['initial', 'shallow-history', 'deep-history', 'choice'],
        default: 'initial',
      },
    ],
  }

  const event: NodeTypeDef = {
    id: 'event',
    label: 'Event',
    color: '#c2410c',
    fg: '#fff',
    // Lightning bolt
    iconPath: 'M9.5 1 3 9h4l-1 6 6.5-8h-4l1-6Z',
    width: 170,
    height: 52,
    allowedParents: ['state-machine', 'system', 'domain', 'group'],
    allowedAtRoot: true,
    builtin: true,
    tableTab: true,
    properties: [
      {
        key: 'source',
        label: 'Source',
        type: 'enum',
        options: ['external', 'internal', 'timer'],
        default: 'external',
      },
      { key: 'payload', label: 'Payload', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  }

  const stateNodeTypes = ['state', 'pseudostate'] as const
  const transition: RelationTypeDef = {
    id: 'transition',
    label: 'Transition',
    allowedPairs: stateNodeTypes.flatMap(from => stateNodeTypes.map(to => ({ from, to }))),
    properties: [
      { key: 'event',   label: 'Event (trigger; none = completion)', type: 'ref', refType: 'event' },
      { key: 'guard',   label: 'Guard [condition]', type: 'text' },
      { key: 'actions', label: 'Actions (/ effect)', type: 'text' },
      { key: 'raises',  label: 'Raises (events it publishes)', type: 'ref', refType: 'event', multiple: true },
      {
        key: 'kind',
        label: 'Kind',
        type: 'enum',
        options: ['external', 'internal'],
        default: 'external',
      },
    ],
    color: '#6366f1',
    builtin: true,
  }

  // state machine → the domain entity whose lifecycle it models (one machine
  // per entity: two lifecycles of one thing are regions of a parallel state).
  // The C4 elements that run it `implements` the machine.
  const lifecycleOf: RelationTypeDef = {
    id: 'lifecycle-of',
    label: 'Lifecycle of',
    allowedPairs: [{ from: 'state-machine', to: 'entity' }],
    properties: [],
    color: '#3730a3',
    builtin: true,
  }

  // element → event it publishes. A state raises it from its entry, exit or
  // do activity (SCXML <raise>/<send> in onentry/onexit); a machine when it
  // is not yet known which state does. A transition cannot be a source (a
  // relation cannot start at a relation): it lists them in `raises`.
  const emits: RelationTypeDef = {
    id: 'emits',
    label: 'Emits',
    allowedPairs: (['person', 'system', 'container', 'component', 'webapp', 'queue', 'state-machine', 'state'] as const).map(from => ({ from, to: 'event' })),
    properties: [
      {
        key: 'on',
        label: 'On (for a state: entry, exit or do)',
        type: 'enum',
        options: ['entry', 'exit', 'do'],
        default: 'entry',
      },
    ],
    color: '#ea580c',
    builtin: true,
  }

  implements_.allowedPairs.push(...(['system', 'container', 'component', 'webapp'] as const).map(from => ({ from, to: 'state-machine' })))
  satisfies.allowedPairs.push({ from: 'state-machine', to: 'requirement' }, { from: 'entity', to: 'requirement' })
  verifies.allowedPairs.push({ from: 'scenario', to: 'state-machine' })
  illustrates.allowedPairs.push({ from: 'mockup', to: 'state' })

  return {
    id: 'c4-ddd-governance-builtin',
    name: 'C4 + DDD + Governance',
    nodeTypes: {
      ...base.nodeTypes,
      adr,
      'fitness-fn': fitnessFn,
      need,
      requirement,
      scenario,
      blueprint,
      mockup,
      'state-machine': stateMachine,
      state,
      pseudostate,
      event,
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
      transition,
      'lifecycle-of': lifecycleOf,
      emits,
    },
  }
}
