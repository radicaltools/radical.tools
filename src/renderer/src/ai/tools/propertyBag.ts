// ─── Shared property-bag validation ─────────────────────────────────────────
// Validates an AI-supplied `properties` object against a type's
// `PropertyDef[]` — the same schema TableView.tsx's deriveNodeCols reads to
// build its columns. This is what actually closes the gap the old
// applyPatch.ts had: a governance/custom property (ADR status, Requirement
// ears_type, ...) can now reach the store.

import type { PropertyDef } from '../../types/metamodel'

export function validateProperties(
  raw: unknown,
  defs: PropertyDef[] | undefined,
): { values: Record<string, string | number | boolean>; notes: string[] } {
  const values: Record<string, string | number | boolean> = {}
  const notes: string[] = []
  if (!raw || typeof raw !== 'object') return { values, notes }
  const byKey = new Map((defs ?? []).map((d) => [d.key, d]))
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const def = byKey.get(key)
    if (!def) {
      notes.push(`ignored property "${key}" — not defined on this type`)
      continue
    }
    if (def.type === 'enum') {
      if (typeof val !== 'string' || !(def.options ?? []).includes(val)) {
        notes.push(`ignored property "${key}" — must be one of: ${(def.options ?? []).join(', ')}`)
        continue
      }
      values[key] = val
    } else if (def.type === 'boolean') {
      if (typeof val !== 'boolean') { notes.push(`ignored property "${key}" — must be a boolean`); continue }
      values[key] = val
    } else if (def.type === 'number') {
      if (typeof val !== 'number') { notes.push(`ignored property "${key}" — must be a number`); continue }
      values[key] = val
    } else {
      // 'text' | 'textarea'
      if (typeof val !== 'string') { notes.push(`ignored property "${key}" — must be a string`); continue }
      values[key] = val
    }
  }
  return { values, notes }
}
