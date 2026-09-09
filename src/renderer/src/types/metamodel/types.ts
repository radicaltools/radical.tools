// ─── Metamodel: object types + relations + constraints ─────────────────────
//
// A Metamodel describes which kinds of nodes exist, what properties they
// have, who can be whose parent, and which relations are allowed between
// them.
//
// The metamodel is stored per-document and validated softly: violations
// surface in the Issues panel rather than blocking edits.

export type PropertyType = 'text' | 'textarea' | 'boolean' | 'number' | 'enum'

export interface PropertyDef {
  key: string
  label: string
  type: PropertyType
  required?: boolean
  /** Only for `type === 'enum'`. */
  options?: string[]
  default?: string | number | boolean
  /** Show this property only when another property has one of the listed values.
   *  E.g. `{ key: 'ears_type', values: ['event-driven', 'complex'] }` means
   *  this field is only visible when `ears_type` is event-driven or complex. */
  visibleWhen?: { key: string; values: string[] }
}

export interface NodeTypeDef {
  id: string
  label: string
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
  /** Record-like types (ADRs, requirements, …) get their own Table View tab
   *  with columns derived from `properties`, instead of only showing up in
   *  the generic "All Nodes" tree. */
  tableTab?: boolean
}

export interface RelationPair {
  /** Source node-type id. */
  from: string
  /** Target node-type id. */
  to: string
  /** Optional cardinality on this pair. */
  min?: number
  max?: number
}

export interface RelationTypeDef {
  id: string
  label: string
  /** Empty list ⇒ "any pair allowed". */
  allowedPairs: RelationPair[]
  properties?: PropertyDef[]
  /** Optional visual hint for the relation. */
  color?: string
  builtin?: boolean
}

export interface Metamodel {
  id: string
  name: string
  nodeTypes: Record<string, NodeTypeDef>
  relationTypes: Record<string, RelationTypeDef>
}

export interface MetamodelPreset {
  id: string
  name: string
  description: string
  build: () => Metamodel
}
