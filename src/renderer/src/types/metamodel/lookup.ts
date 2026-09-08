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
