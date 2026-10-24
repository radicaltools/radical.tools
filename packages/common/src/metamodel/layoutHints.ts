/**
 * The layout hints of a metamodel's types, with the built-in preset's for
 * a built-in type id that has none: a document keeps a copy of its
 * metamodel, and one saved before the hints existed (or forked to edit a
 * type) still has persons and databases.
 */
import type { LayoutFlow, LayoutRole, Metamodel, NodeLayoutHint, RelationLayoutHint } from './types'
import { builtInGovernanceMetamodel } from './presets/governance'

let preset: Metamodel | null = null
const presetHints = (): Metamodel => (preset ??= builtInGovernanceMetamodel())

export function nodeLayoutHint(typeId: string, mm?: Metamodel | null): NodeLayoutHint {
  return mm?.nodeTypes[typeId]?.layout ?? presetHints().nodeTypes[typeId]?.layout ?? {}
}

/** The role of one element: its type's, or the one its property's value names. */
export function layoutRoleOf(node: { type: string } & Record<string, unknown>, mm?: Metamodel | null): LayoutRole {
  const hint = nodeLayoutHint(node.type, mm)
  if (hint.byProperty) {
    const value = node[hint.byProperty.key]
    const byValue = typeof value === 'string' ? hint.byProperty.roles[value] : undefined
    if (byValue) return byValue
  }
  return hint.role ?? 'element'
}

export const FORWARD: RelationLayoutHint = { flow: 'forward', axis: 'free' }

export function relationLayoutHint(typeId: string | undefined, mm?: Metamodel | null): RelationLayoutHint {
  if (!typeId) return FORWARD
  const hint = mm?.relationTypes[typeId]?.layout ?? presetHints().relationTypes[typeId]?.layout
  return hint ? { axis: 'free', ...hint } : FORWARD
}

export const LAYOUT_ROLES: LayoutRole[] = ['element', 'actor', 'store', 'note', 'start', 'end', 'broker', 'screen']
export const LAYOUT_FLOWS: LayoutFlow[] = ['forward', 'reverse', 'side']
export const LAYOUT_AXES: NonNullable<RelationLayoutHint['axis']>[] = ['free', 'vertical', 'horizontal']
