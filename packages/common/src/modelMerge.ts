// ─── Three-way merge of a model ─────────────────────────────────────────────
// Two writers of one model folder (Studio and an agent over MCP, an editor,
// git) each change the model they read. When one writes after the other, its
// change and the other's are merged here, as git merges text, but along the
// model's structure: `base` is the model the writer read, `ours` its model
// now, `theirs` the folder's model now.
//
// - Elements, relations, views, sequences, presentations, milestones and the
//   like (arrays of objects with an `id`) merge entry by entry, by id: one
//   added on one side stays; one removed on one side and untouched on the
//   other goes.
// - An entry's fields merge key by key; a nested object (positions, a view's
//   positions map, a property bag) key by key again.
// - Anything else (a string, an array of ids, a list without ids) is one
//   value: the side that changed it wins.
// - Both sides changed the same value: theirs (the folder) wins, and the
//   conflict is reported, unless it is layout (positions, sizes, camera,
//   folding), where the last writer winning is expected.
//
// The merged model may break a rule each side kept on its own (a relation to
// an element the other side deleted); validation shows it.

import type { DiagramData } from './c4'

export interface ModelMergeResult {
  merged: DiagramData
  /** The values both sides changed, where theirs was kept: "Customer: description". */
  conflicts: string[]
}

/** Keys whose values are layout, merged without a report. */
const LAYOUT_KEYS = new Set(['x', 'y', 'width', 'height', 'positions', 'viewport', 'defaultPositions', 'defaultViewport', 'collapsed'])

type Plain = Record<string, unknown>

const isPlain = (v: unknown): v is Plain => !!v && typeof v === 'object' && !Array.isArray(v)

/** JSON with object keys sorted, so two values compare by what they hold. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (isPlain(value)) {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`
  }
  return value === undefined ? 'undefined' : JSON.stringify(value)
}

const same = (a: unknown, b: unknown): boolean => a === b || canonical(a) === canonical(b)

/** An array that merges by id: one whose items all are objects with an `id`. */
const byIdArray = (v: unknown): v is Array<Plain & { id: string }> =>
  Array.isArray(v) && v.length > 0 && v.every((item) => isPlain(item) && typeof item.id === 'string')

/** What a report calls an entry: its label or name, else its id. */
function entryName(entry: Plain | undefined, id: string): string {
  const name = entry && (typeof entry.label === 'string' ? entry.label : typeof entry.name === 'string' ? entry.name : '')
  return name || id
}

interface Ctx {
  conflicts: string[]
}

/** `base`, `ours` and `theirs` of one value merged; `where` names it for a report. */
function merge3(base: unknown, ours: unknown, theirs: unknown, where: string[], ctx: Ctx, layout: boolean): unknown {
  if (same(ours, base)) return theirs
  if (same(theirs, base)) return ours
  if (same(ours, theirs)) return ours
  // An array of entries with ids on either side merges by id.
  const arrays = [base, ours, theirs].filter((v) => v !== undefined)
  if (arrays.every((v) => Array.isArray(v)) && arrays.some(byIdArray) && arrays.every((v) => (v as unknown[]).length === 0 || byIdArray(v))) {
    return mergeById((base ?? []) as Plain[], (ours ?? []) as Plain[], (theirs ?? []) as Plain[], where, ctx, layout)
  }
  if (isPlain(ours) && isPlain(theirs) && (base === undefined || isPlain(base))) {
    const b = (base ?? {}) as Plain
    const out: Plain = {}
    for (const key of new Set([...Object.keys(theirs), ...Object.keys(ours), ...Object.keys(b)])) {
      const value = merge3(b[key], ours[key], theirs[key], [...where, key], ctx, layout || LAYOUT_KEYS.has(key))
      if (value !== undefined) out[key] = value
    }
    return out
  }
  if (!layout) ctx.conflicts.push(where.join(': '))
  return theirs
}

/** Entries of three arrays merged by id: theirs' order, then those only ours added. */
function mergeById(base: Plain[], ours: Plain[], theirs: Plain[], where: string[], ctx: Ctx, layout: boolean): Plain[] {
  const index = (list: Plain[]) => new Map(list.map((e) => [e.id as string, e]))
  const b = index(base)
  const o = index(ours)
  const t = index(theirs)
  const ids = [...theirs.map((e) => e.id as string), ...ours.map((e) => e.id as string).filter((id) => !t.has(id))]
  const out: Plain[] = []
  for (const id of new Set(ids)) {
    const name = entryName(o.get(id) ?? t.get(id) ?? b.get(id), id)
    // A list of entries is named by its parent; an entry by its name.
    const value = merge3(b.get(id), o.get(id), t.get(id), [...where.slice(0, -1), name], ctx, layout)
    if (value !== undefined) out.push(value as Plain)
  }
  return out
}

/** `ours` and `theirs`, both changed from `base`, merged (see above). */
export function mergeModels(base: DiagramData, ours: DiagramData, theirs: DiagramData): ModelMergeResult {
  const ctx: Ctx = { conflicts: [] }
  const merged = merge3(base, ours, theirs, [], ctx, false) as DiagramData
  return { merged, conflicts: [...new Set(ctx.conflicts)] }
}
