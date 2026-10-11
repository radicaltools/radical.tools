// ─── Reference properties ──────────────────────────────────────────────────
//
// A property of type 'ref' points at nodes of one type (`refType`) by id, so
// a relation can name a node (a transition its event) without being a node
// itself, and a rename never breaks the link. A single reference is stored
// as the id, a multiple one (`multiple: true`) as an array of ids.

import type { C4Node } from '../c4'
import type { PropertyDef } from './types'

/** The ids a reference value holds: none, one, or several. */
export function refIds(value: unknown): string[] {
  if (typeof value === 'string') return value ? [value] : []
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v !== '')
  return []
}

/** The labels of the nodes a reference value points at; an id with no
 *  node stays as it is, so a dangling reference is still visible. */
export function refLabels(value: unknown, nodes: Record<string, C4Node>): string[] {
  return refIds(value).map((id) => nodes[id]?.label ?? id)
}

/** A reference value as the property wants it stored: one id or an array. */
export function refValue(def: PropertyDef, ids: string[]): string | string[] {
  return def.multiple ? ids : (ids[0] ?? '')
}

/** Why `id` cannot be a value of `def`, or null when it can. */
export function refProblem(def: PropertyDef, id: string, nodes: Record<string, C4Node>): string | null {
  const node = nodes[id]
  if (!node) return `no node has id "${id}"`
  if (def.refType && node.type !== def.refType) return `"${node.label}" is of type ${node.type}, not ${def.refType}`
  return null
}
