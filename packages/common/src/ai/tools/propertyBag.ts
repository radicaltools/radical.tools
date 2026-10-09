// ─── Shared property-bag validation ─────────────────────────────────────────
// Validates an AI-supplied `properties` object against a type's
// `PropertyDef[]` — the same schema TableView.tsx's deriveNodeCols reads to
// build its columns. This is what actually closes the gap the old
// applyPatch.ts had: a governance/custom property (ADR status, Requirement
// ears_type, ...) can now reach the store.

import type { C4Node } from '../../c4'
import { refProblem, refValue, type PropertyDef } from '../../metamodel'

export type PropertyValue = string | number | boolean | string[]

/** What a reference property needs to check its value: the model's nodes,
 *  and tempIds from earlier calls in the run turned into real ids. */
export interface RefContext {
  nodes: Record<string, C4Node>
  resolveId: (id: string) => string
}

export function validateProperties(
  raw: unknown,
  defs: PropertyDef[] | undefined,
  refs?: RefContext,
): { values: Record<string, PropertyValue>; notes: string[] } {
  const values: Record<string, PropertyValue> = {}
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
    } else if (def.type === 'ref') {
      const what = def.multiple ? `an array of ${def.refType ?? 'node'} ids` : `the id of a ${def.refType ?? 'node'}`
      const raw = val === '' || val === null ? [] : Array.isArray(val) ? val : [val]
      if (!raw.every((v) => typeof v === 'string') || (!def.multiple && raw.length > 1)) {
        notes.push(`ignored property "${key}" — must be ${what} (or tempId)`)
        continue
      }
      const ids = (raw as string[]).map((id) => refs?.resolveId(id) ?? id)
      const problems = refs ? ids.map((id) => refProblem(def, id, refs.nodes)).filter(Boolean) : []
      if (problems.length > 0) { notes.push(`ignored property "${key}" — ${problems.join('; ')}`); continue }
      values[key] = refValue(def, ids)
    } else {
      // 'text' | 'textarea'
      if (typeof val !== 'string') { notes.push(`ignored property "${key}" — must be a string`); continue }
      values[key] = val
    }
  }
  return { values, notes }
}
