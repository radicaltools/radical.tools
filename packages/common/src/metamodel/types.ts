// ─── Metamodel: object types + relations + constraints ─────────────────────
//
// A Metamodel describes which kinds of nodes exist, what properties they
// have, who can be whose parent, and which relations are allowed between
// them.
//
// The metamodel is stored per-document and validated softly: violations
// surface in the Issues panel rather than blocking edits.

import type { ViewPipeline } from '../c4'

export type PropertyType = 'text' | 'textarea' | 'boolean' | 'number' | 'enum' | 'ref'

export interface PropertyDef {
  key: string
  label: string
  type: PropertyType
  required?: boolean
  /** Only for `type === 'enum'`. */
  options?: string[]
  /** Only for `type === 'ref'`: the node type the property points at. The
   *  value is that node's id (rename-safe), or with `multiple` an array of
   *  ids. A relation cannot point at a node; a reference property can. */
  refType?: string
  /** Only for `type === 'ref'`: several nodes instead of one. */
  multiple?: boolean
  default?: string | number | boolean
  /** Show this property only when another property has one of the listed values.
   *  E.g. `{ key: 'ears_type', values: ['event-driven', 'complex'] }` means
   *  this field is only visible when `ears_type` is event-driven or complex. */
  visibleWhen?: { key: string; values: string[] }
}

export interface NodeTypeDef {
  id: string
  label: string
  /** What an element of this type is, in a sentence or two. The wiki writes
   *  it under the type's heading and in its glossary, so that a model
   *  explains the words it is written in. */
  description?: string
  color: string
  fg: string
  /** SVG path data (16×16 viewBox). */
  iconPath: string
  width: number
  height: number
  collapsedWidth?: number
  collapsedHeight?: number
  /** Allowed parent node-type ids. `undefined`/empty → no specific parent
   *  type required (combine with `allowedAtRoot` to control root). */
  allowedParents?: string[]
  /** Whether this type may be placed at the canvas root (no parent).
   *  When undefined, defaults to `true` if `allowedParents` is
   *  undefined/empty, `false` otherwise — preserves prior behaviour. */
  allowedAtRoot?: boolean
  /** Min/max instances of this type per document. */
  cardinality?: { min?: number; max?: number }
  /** Custom properties beyond label/parent. */
  properties?: PropertyDef[]
  /** Built-in types come from a metamodel preset and cannot be deleted. */
  builtin?: boolean
  /** Hub-only types are imported from the Hub and should not appear in the
   *  canvas element palette (users cannot create them manually). */
  hubOnly?: boolean
  /** How the table sums up an element of this type in one line, from the
   *  data it has: a template of {property} tokens (nodeSummary.ts). None:
   *  the built-in one for the type's id, else the description's first
   *  sentence. */
  summary?: string
  /** For types that nest via a relation instead of canvas containment (e.g.
   *  a Requirement "derives" from the one it decomposes) — the id of the
   *  RelationTypeDef whose `allowedPairs` has `{from: thisType, to: thisType}`.
   *  A child is any node with an outgoing relation of this type pointing at
   *  the parent. Drives both Table View's per-type tree (instead of a flat
   *  list) and Wiki View's "Contains" section + "Add child" (instead of
   *  requiring `allowedParents` to include this type, which it usually
   *  can't — containment and this kind of relation are different things). */
  hierarchyRelation?: string
  /** Guided, step-by-step form for filling in a node of this type. */
  wizard?: NodeWizardDef
}

// ─── Node wizard ─────────────────────────────────────────────────────────────
//
// A wizard walks the user through a node's properties (and the relations
// that give it meaning — e.g. which elements an ADR constrains) one step at
// a time, instead of leaving them to a wall of fields in the properties
// panel. It is plain data, so custom metamodels get wizards too.

export interface NodeWizardDef {
  /** 'create' — opens whenever the user creates a node of this type (canvas,
   *  table, wiki). 'manual' — only from the properties panel on an existing
   *  node. */
  trigger: 'create' | 'manual'
  /** Values a new node starts with. The string `'{{today}}'` becomes the
   *  current date (YYYY-MM-DD). */
  prefill?: Record<string, string | number | boolean>
  steps: WizardStep[]
}

export type WizardStep = WizardFieldsStep | WizardRelationsStep | WizardCustomStep

interface WizardStepBase {
  title: string
  /** Guidance shown above the step's inputs. */
  help?: string
}

export interface WizardFieldsStep extends WizardStepBase {
  kind: 'fields'
  /** Keys of the type's `properties`, plus the built-ins `label` and
   *  `description`. Hidden properties (`visibleWhen`) are skipped. */
  fields: string[]
}

export interface WizardRelationsStep extends WizardStepBase {
  kind: 'relations'
  /** RelationTypeDef id; its `allowedPairs` decide which nodes are offered. */
  relationType: string
  /** 'out' — the wizard's node is the source; 'in' — it is the target. */
  direction: 'out' | 'in'
}

export interface WizardCustomStep extends WizardStepBase {
  kind: 'custom'
  /** A built-in editor the generic field/relation steps can't express. */
  component: 'ears-quick-entry'
}

export interface RelationPair {
  /** Source node-type id. */
  from: string
  /** Target node-type id. */
  to: string
  /** Optional cardinality on this pair. */
  min?: number
  max?: number
  /** How a relation of this pair reads from its source, where it differs
   *  from the type's forwardLabel ("Delivers to" for Interacts to a person). */
  forwardLabel?: string
  /** How it reads from its target, where it differs from the type's
   *  inverseLabel ("Receives from"). */
  inverseLabel?: string
}

export interface RelationTypeDef {
  id: string
  /** The type's name, which the properties panel and the metamodel editor
   *  show. The canvas draws each relation's own label, never this one. */
  label: string
  /** What a relation of this type says about its two ends, in a sentence or
   *  two. The wiki writes it in its glossary and as a hint on the sentences
   *  it builds from the type. */
  description?: string
  /** How the relation reads in a sentence from source to target, when the
   *  label is a name rather than a verb: "Uses" for "Interacts". Defaults to
   *  `label`. Only prose uses it (the wiki). */
  forwardLabel?: string
  /** How it reads from target to source: "Constrained by" for "Constrains".
   *  Only prose uses it (the wiki), for the relations that end at a page's
   *  element. */
  inverseLabel?: string
  /** Empty list ⇒ "any pair allowed". */
  allowedPairs: RelationPair[]
  properties?: PropertyDef[]
  /** Optional visual hint for the relation. */
  color?: string
  builtin?: boolean
}

/** The kinds of view a viewpoint of the metamodel can be built on (a flow
 *  view plays a sequence, which a viewpoint cannot name). */
export type ViewpointKind = 'static' | 'table' | 'treemap' | 'matrix' | 'wiki' | 'warnier'

/** A viewpoint of the metamodel: a kind of view and its filter chain under a
 *  name ("Traceability": a table of needs, the requirements refined from
 *  them, the scenarios that verify those). A view of this type
 *  (DiagramView.viewpoint) has its kind and chain, and follows the viewpoint when
 *  it changes; changing the view's kind or chain leaves the viewpoint. */
export interface ViewpointDef {
  id: string
  label: string
  /** The concern it serves (C4, Requirements, …): New view and the
   *  Viewpoint list show the viewpoints under it, in the order of the list. */
  group?: string
  description?: string
  kind: ViewpointKind
  pipeline: ViewPipeline
  /** A viewpoint that draws one element: a view of it is of one element of
   *  these types (DiagramView.subject), its first level kept to that element
   *  and what lies inside it. None: a view of the whole model. */
  subject?: { types: string[] }
}

export interface Metamodel {
  id: string
  name: string
  nodeTypes: Record<string, NodeTypeDef>
  relationTypes: Record<string, RelationTypeDef>
  /** Viewpoints, in the order they are offered. A document on a built-in
   *  preset keeps its own list when the preset is swapped in on load; with
   *  none, it gets the preset's. */
  viewpoints?: ViewpointDef[]
  /** Ids of the preset's viewpoints the document deleted: on load the
   *  preset's viewpoints come back but these (documentMetamodel). */
  removedViewpoints?: string[]
}

export interface MetamodelPreset {
  id: string
  name: string
  description: string
  build: () => Metamodel
}
