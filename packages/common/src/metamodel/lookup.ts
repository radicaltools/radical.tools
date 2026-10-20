// ─── Metamodel lookup helpers (with safe fallback for unknown types) ───────

import { Metamodel, NodeTypeDef, PropertyDef } from './types'

/** Check whether a property should be visible given the node's current values. */
export function isPropertyVisible(prop: PropertyDef, node: Record<string, unknown>): boolean {
  if (!prop.visibleWhen) return true
  const cur = String(node[prop.visibleWhen.key] ?? '')
  return prop.visibleWhen.values.includes(cur)
}

export function getNodeTypeDef(metamodel: Metamodel | undefined, typeId: string): NodeTypeDef | undefined {
  return metamodel?.nodeTypes[typeId]
}

/**
 * Returns true when a relation from `fromType` to `toType` is permitted by
 * the metamodel. Mirrors the validator's logic: if any relation type allows
 * "any pair" (empty allowedPairs), everything is permitted; otherwise the
 * pair must be explicitly listed by at least one relation type.
 */
export function isRelationAllowed(
  metamodel: Metamodel | undefined,
  fromType: string,
  toType: string,
): boolean {
  if (!metamodel) return true
  const rts = Object.values(metamodel.relationTypes)
  if (rts.length === 0) return true
  if (rts.some(rt => rt.allowedPairs.length === 0)) return true
  return rts.some(rt => rt.allowedPairs.some(p => p.from === fromType && p.to === toType))
}

/**
 * Returns the id of the unique restricted relation type that permits the
 * given (fromType, toType) pair, or `undefined` when zero or multiple types
 * match.  "Restricted" means the type's `allowedPairs` list is non-empty.
 * Catch-all types (empty allowedPairs) are ignored so that e.g. the `uses`
 * type does not shadow a more specific one.
 */
export function inferRelationType(
  metamodel: Metamodel | undefined,
  fromType: string,
  toType: string,
): string | undefined {
  if (!metamodel) return undefined
  const matches = Object.values(metamodel.relationTypes).filter(
    rt => rt.allowedPairs.length > 0 && rt.allowedPairs.some(p => p.from === fromType && p.to === toType),
  )
  return matches.length === 1 ? matches[0].id : undefined
}

/**
 * Returns true when a node of `childType` may be placed inside a parent of
 * `parentType` (or at the root, when `parentType` is undefined).
 * Unknown child types are permitted (they surface as a separate Issue).
 */
export function isParentAllowed(
  metamodel: Metamodel | undefined,
  childType: string,
  parentType: string | undefined,
): boolean {
  if (!metamodel) return true
  const def = metamodel.nodeTypes[childType]
  if (!def) return true
  const allowed = def.allowedParents
  if (parentType == null) {
    // Root placement. Honour explicit `allowedAtRoot`; otherwise default to
    // allowed when no specific parent types are required.
    if (def.allowedAtRoot !== undefined) return def.allowedAtRoot
    return !allowed || allowed.length === 0
  }
  return !!allowed && allowed.includes(parentType)
}

/** The type that only gathers other elements and says nothing about them. */
export const GROUP_TYPE = 'group'

/** What placing a node needs to know of the nodes around it. */
export interface PlacedNode {
  type: string
  parentId?: string | null
}

/** The element a group stands in: its nearest ancestor that is not a group
 *  (itself, for anything but a group), or undefined at the top of the model. */
export function placeOf<N extends PlacedNode>(node: N | undefined, nodes: Record<string, N>): N | undefined {
  const seen = new Set<N>()
  let cur = node
  while (cur && cur.type === GROUP_TYPE && !seen.has(cur)) {
    seen.add(cur)
    cur = cur.parentId ? nodes[cur.parentId] : undefined
  }
  return cur && cur.type !== GROUP_TYPE ? cur : undefined
}

/**
 * True when a node of `childType` has a place under an element of
 * `placeType` (or at the top of the model, when undefined), with any number
 * of groups in between: directly, or deeper down by the allowedParents of
 * the types in between. A component has a place under a system, whose
 * containers hold components; it has none at the top of the model.
 */
export function hasPlaceUnder(metamodel: Metamodel | undefined, childType: string, placeType: string | undefined): boolean {
  if (!metamodel || !metamodel.nodeTypes[childType]) return true
  if (placeType == null) return isParentAllowed(metamodel, childType, undefined)
  const seen = new Set<string>()
  const queue = [childType]
  while (queue.length > 0) {
    for (const parent of metamodel.nodeTypes[queue.pop()!]?.allowedParents ?? []) {
      if (parent === placeType) return true
      if (parent === GROUP_TYPE || seen.has(parent)) continue
      seen.add(parent)
      queue.push(parent)
    }
  }
  return false
}

/** A final state of a state machine: the machine (or its region) ends
 *  there, and it holds nothing (SCXML). Its type lists itself among the
 *  allowed parents of states, for compound ones, so allowedParents alone
 *  lets a state go into it. */
export function isFinalState(node: PlacedNode | undefined): boolean {
  return node?.type === 'state' && (node as { kind?: unknown }).kind === 'final'
}

/**
 * Returns true when a node of `childType` may be placed inside `parent` (or
 * at the root, when undefined) of a model with these `nodes`.
 *
 * It is `isParentAllowed`, and two things more: a final state holds
 * nothing (`isFinalState`), and a group gives no place that
 * the element could not have without it. A type that lists the group among
 * its allowedParents may sit in a group only where the group stands (see
 * `placeOf`) has a place for it (`hasPlaceUnder`). So a group at the top of
 * the model holds what may be at the top, and a group inside a system holds
 * the parts of a system.
 */
export function isPlacementAllowed<N extends PlacedNode>(
  metamodel: Metamodel | undefined,
  childType: string,
  parent: N | undefined,
  nodes: Record<string, N>,
): boolean {
  if (!isParentAllowed(metamodel, childType, parent?.type)) return false
  if (isFinalState(parent)) return false
  if (!parent || parent.type !== GROUP_TYPE) return true
  return hasPlaceUnder(metamodel, childType, placeOf(parent, nodes)?.type)
}

/**
 * Returns true when adding one more node of `typeId` would NOT exceed the
 * type's cardinality.max constraint. `currentCount` is the number of nodes
 * of that type that already exist.
 */
export function canAddMoreOfType(
  metamodel: Metamodel | undefined,
  typeId: string,
  currentCount: number,
): boolean {
  if (!metamodel) return true
  const def = metamodel.nodeTypes[typeId]
  if (!def?.cardinality?.max) return true
  return currentCount < def.cardinality.max
}

/**
 * Keys a property of a type cannot have. A property's value is a plain
 * field of the element (or relation), next to the fields every one has: a
 * property keyed `type` edited the element's type from the properties
 * panel, and `parentId`, `x` or `id` were open the same way. (`label`,
 * `description`, `technology` and `external` are fields the built-in types
 * themselves list as properties.)
 */
const RESERVED_PROPERTY_KEYS = {
  node: new Set(['id', 'type', 'parentId', 'x', 'y', 'width', 'height', 'collapsed']),
  relation: new Set(['id', 'sourceId', 'targetId', 'relationType']),
}

export function isReservedPropertyKey(key: string, of: 'node' | 'relation'): boolean {
  return RESERVED_PROPERTY_KEYS[of].has(key)
}

/** Why a type's property cannot have this key, or null. */
export function propertyKeyProblem(key: string, of: 'node' | 'relation'): string | null {
  if (!isReservedPropertyKey(key, of)) return null
  return `"${key}" is a field every ${of === 'node' ? 'element' : 'relation'} has (${[...RESERVED_PROPERTY_KEYS[of]].join(', ')}): give the property another key.`
}
