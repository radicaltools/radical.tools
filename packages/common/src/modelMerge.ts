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
//   other goes. Their order is the one of the side that reordered them (a
//   view folder moved up), theirs when both did, and reported then.
// - A list of ids that is a set (a view's elements, its hidden relations)
//   merges as one: what either side added is in, what either removed is out.
// - An entry's fields merge key by key; a nested object (positions, a view's
//   positions map, a property bag) key by key again.
// - Anything else (a string, another list of ids, a list without ids) is one
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

/** Lists of ids merged as sets (see above). A sequence's `relationIds` are
 *  its steps in order, and may repeat: not one of them. */
const ID_SET_KEYS = new Set(['nodeIds', 'hiddenRelationIds', 'collapsedNodeIds', 'expandedNodeIds', 'focusNodeIds'])

type Plain = Record<string, unknown>

const isPlain = (v: unknown): v is Plain => !!v && typeof v === 'object' && !Array.isArray(v)

/** Two values hold the same (a key whose value is undefined is no key). */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]))
  if (!isPlain(a) || !isPlain(b)) return false
  const keys = (o: Plain) => Object.keys(o).filter((k) => o[k] !== undefined)
  const ka = keys(a)
  return ka.length === keys(b).length && ka.every((k) => same(a[k], b[k]))
}

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
      if (ID_SET_KEYS.has(key) && [b[key], ours[key], theirs[key]].every(isIdSet)) {
        const value = mergeIdSet(b[key] as string[] | undefined, ours[key] as string[] | undefined, theirs[key] as string[] | undefined)
        if (value !== undefined) out[key] = value
        continue
      }
      const value = merge3(b[key], ours[key], theirs[key], [...where, key], ctx, layout || LAYOUT_KEYS.has(key))
      if (value !== undefined) out[key] = value
    }
    return out
  }
  if (!layout) ctx.conflicts.push(where.join(': '))
  return theirs
}

/** Entries of three arrays merged by id, in the order mergeOrder gives. */
function mergeById(base: Plain[], ours: Plain[], theirs: Plain[], where: string[], ctx: Ctx, layout: boolean): Plain[] {
  const index = (list: Plain[]) => new Map(list.map((e) => [e.id as string, e]))
  const b = index(base)
  const o = index(ours)
  const t = index(theirs)
  const ids = mergeOrder([...b.keys()], [...o.keys()], [...t.keys()], where, layout ? null : ctx)
  const out: Plain[] = []
  for (const id of ids) {
    const name = entryName(o.get(id) ?? t.get(id) ?? b.get(id), id)
    // A list of entries is named by its parent; an entry by its name.
    const value = merge3(b.get(id), o.get(id), t.get(id), [...where.slice(0, -1), name], ctx, layout)
    if (value !== undefined) out.push(value as Plain)
  }
  return out
}

/** An absent list, or one of distinct ids. */
const isIdSet = (v: unknown): boolean =>
  v === undefined || (Array.isArray(v) && v.every((id) => typeof id === 'string') && new Set(v).size === v.length)

/** A list of ids merged as a set: base, less what either side removed, plus
 *  what either added; in the order mergeOrder gives. */
function mergeIdSet(base: string[] | undefined, ours: string[] | undefined, theirs: string[] | undefined): string[] | undefined {
  if (same(ours, base)) return theirs
  if (same(theirs, base)) return ours
  const b = new Set(base ?? [])
  const o = new Set(ours ?? [])
  const t = new Set(theirs ?? [])
  const kept = (id: string) => (o.has(id) && t.has(id)) || (o.has(id) && !b.has(id)) || (t.has(id) && !b.has(id))
  return mergeOrder([...b], [...o], [...t], [], null).filter(kept)
}

/** Whether `side` puts the ids it shares with `base` in another order. */
function reordered(base: string[], side: string[]): boolean {
  const inSide = new Set(side)
  const inBase = new Set(base)
  const a = base.filter((id) => inSide.has(id))
  const c = side.filter((id) => inBase.has(id))
  return a.some((id, i) => id !== c[i])
}

/** The ids of both sides in one order: the order of the side that reordered
 *  the list, theirs when neither did or both did (reported to `ctx`, unless
 *  they agree), with the ids only the other side has after the id they
 *  follow there. Which ids stay is the caller's to say. */
function mergeOrder(base: string[], ours: string[], theirs: string[], where: string[], ctx: Ctx | null): string[] {
  const oursFirst = reordered(base, ours) && !reordered(base, theirs)
  if (ctx && !oursFirst && reordered(base, ours)) {
    const inAll = (id: string) => base.includes(id) && ours.includes(id) && theirs.includes(id)
    if (!same(ours.filter(inAll), theirs.filter(inAll))) {
      ctx.conflicts.push([...where.slice(0, -1), `order of ${where[where.length - 1] ?? 'the list'}`].join(': '))
    }
  }
  const [primary, secondary] = oursFirst ? [ours, theirs] : [theirs, ours]
  const out = [...new Set(primary)]
  const placed = new Set(out)
  let after = -1 // where the last id of `secondary` that `out` has stands
  for (const id of secondary) {
    if (placed.has(id)) { after = out.indexOf(id); continue }
    out.splice(after + 1, 0, id)
    placed.add(id)
    after++
  }
  return out
}

/** `ours` and `theirs`, both changed from `base`, merged (see above). */
export function mergeModels(base: DiagramData, ours: DiagramData, theirs: DiagramData): ModelMergeResult {
  const ctx: Ctx = { conflicts: [] }
  const merged = merge3(base, ours, theirs, [], ctx, false) as DiagramData
  return { merged, conflicts: [...new Set(ctx.conflicts)] }
}
