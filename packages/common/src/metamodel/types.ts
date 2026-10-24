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

// ─── Layout hints ────────────────────────────────────────────────────────────
//
// What an element of a type is to a layout (Smart Layout's Tidy), so that
// the conventions of a notation hold without an engine per notation: an
// actor goes above what it uses, a store beside its user, a start above
// the states, screens in a row; a relation type says which way it reads.

/** What the layout takes an element for. */
export type LayoutRole =
  /** Placed by its lines alone. */
  | 'element'
  /** Above what it uses (a person). */
  | 'actor'
  /** Beside its one user, on the right (a database). */
  | 'store'
  /** Beside its one anchor, on the left (an ADR, a requirement at the element it is about). */
  | 'note'
  /** Above what it leads to (an initial pseudostate). */
  | 'start'
  /** Below what leads to it (a final state). */
  | 'end'
  /** Between the two sides it joins (a queue between producer and consumer). */
  | 'broker'
  /** In a row with the screens it navigates to. */
  | 'screen'
export type LayoutSide = 'top' | 'bottom' | 'left' | 'right'
export interface NodeLayoutHint {
  role?: LayoutRole
  /** Where the role is placed, when it is not the role's own side. */
  side?: LayoutSide
  /** Roles by a property's value: a pseudostate of kind "initial" is a start. */
  byProperty?: { key: string; roles: Record<string, LayoutRole> }
}
/** Which way a relation type reads in a drawing: forward from source to
 *  target (down, or right on the horizontal axis), reverse (the target
 *  above the source: a requirement derives from the need above it), or
 *  side (no direction: a decision beside what it constrains). */
export type LayoutFlow = 'forward' | 'reverse' | 'side'
export interface RelationLayoutHint {
  flow: LayoutFlow
  /** The axis the relation reads along: vertical (a transition runs down,
   *  a flat one is off), horizontal (screens navigate to the right), or
   *  free (the default: down or across, only backwards is against it). */
  axis?: 'vertical' | 'horizontal' | 'free'
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
  /** What an element of this type is to a layout; none: the built-in
   *  preset's hint for a built-in id, else an element (layoutHints.ts). */
  layout?: NodeLayoutHint
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
  /** A governance relation: it ties a requirement, decision, check or
   *  screen to the element it is about (satisfies, constrains, verifies)
   *  rather than saying how the model is built (uses, part of). Containment
   *  says nothing of that, so one may join an element and what holds it (a
   *  requirement inside the system that satisfies it), and a move into that
   *  element keeps it; a structural relation there is refused, and goes on
   *  such a move (relationRefusal, relationsToNewHolders). */
  governance?: boolean
  /** Optional visual hint for the relation. */
  color?: string
  builtin?: boolean
  /** Which way a relation of this type reads in a drawing; none: the
   *  built-in preset's hint for a built-in id, else forward (layoutHints.ts). */
  layout?: RelationLayoutHint
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
