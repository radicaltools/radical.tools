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
// - A sequence's steps (its relations in order, which may repeat, and the
//   note and the way of each) merge as one list of steps, along the steps
//   both sides kept from base: what either side removed is out, what either
//   added is in where it added it, and a note changed or a step turned to
//   run the other way on one side stays on its step.
// - An entry's fields merge key by key; a nested object (positions, a view's
//   positions map, a property bag) key by key again.
// - Anything else (a string, another list of ids, a list without ids) is one
//   value: the side that changed it wins.
// - Both sides changed the same value: theirs (the folder) wins, and the
//   conflict is reported, unless it is layout (positions, sizes, camera,
//   folding), where the last writer winning is expected. An entry one side
//   removed and the other changed only in its layout goes.
// - An empty text, an unticked box and an empty list are no value, as an
//   absent one is (modelValue): the folder writes none of them, so a model
//   read back from it is the same model.
// - A relation one side drew to (or turned to) an element the other side
//   deleted goes, as does a step one side added of a relation the other
//   deleted: the delete wins here too, and the drop is reported (dropStrays).
//
// The merged model may break another rule each side kept on its own;
// validation shows it.

import { trimStepBackward, type DiagramData } from './c4'
import { modelValue } from './model'

export interface ModelMergeResult {
  merged: DiagramData
  /** The values both sides changed, where theirs was kept: "Customer: description". */
  conflicts: string[]
  /** Entries one side deleted and the other changed: the delete won, and
   *  the change `by` that side was dropped. */
  dropped: MergeDrop[]
  /** Containers one side deleted that came back, with their relations and
   *  places, since the other side put an element into them. */
  restored: string[]
}

/** An entry deleted on one side and changed on the other (`by`). */
export interface MergeDrop {
  name: string
  by: 'ours' | 'theirs'
  /** What of `by`'s was dropped, when not a change to the entry itself:
   *  "the relation Shop → Bank made to it". */
  change?: string
}

/** Keys whose values are layout, merged without a report. */
const LAYOUT_KEYS = new Set(['x', 'y', 'width', 'height', 'positions', 'viewport', 'defaultPositions', 'defaultViewport', 'collapsed'])

/** Lists of ids merged as sets (see above). A sequence's `relationIds` are
 *  its steps in order, and may repeat: not one of them. */
const ID_SET_KEYS = new Set(['nodeIds', 'hiddenRelationIds', 'collapsedNodeIds', 'expandedNodeIds', 'focusNodeIds', 'removedViewpoints', 'allowedParents', 'options'])

/** Lists of ids where an empty one means every id (a node type's allowed
 *  parents: any parent): one that the merge alone empties is a conflict. */
const ALL_WHEN_EMPTY_KEYS = new Set(['allowedParents'])

/** A sequence's keys merged together, as its steps (mergeSteps). */
const STEP_KEYS = new Set(['relationIds', 'stepDescriptions', 'stepBackward'])

type Plain = Record<string, unknown>

const isPlain = (v: unknown): v is Plain => !!v && typeof v === 'object' && !Array.isArray(v)

/** Two values hold the same: a key with no value (modelValue: undefined,
 *  null, an empty text, false, an empty list) is no key. Read back from a
 *  folder, an element added with an empty description has none, and Undo
 *  of the add took that for a change made outside Studio and kept it. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  const none = (v: unknown): boolean => modelValue(v) === null
  if (none(a) || none(b)) return none(a) && none(b)
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]))
  if (!isPlain(a) || !isPlain(b)) return false
  const keys = (o: Plain) => Object.keys(o).filter((k) => !none(o[k]))
  const ka = keys(a)
  return ka.length === keys(b).length && ka.every((k) => same(a[k], b[k]))
}

/** Two layout numbers less than a pixel apart. */
const nudged = (a: unknown, b: unknown): boolean =>
  typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.5

/** Two entries that differ in their layout only (LAYOUT_KEYS). */
function sameApartFromLayout(a: unknown, b: unknown): boolean {
  if (!isPlain(a) || !isPlain(b)) return false
  const strip = (o: Plain): Plain => Object.fromEntries(Object.entries(o).filter(([k]) => !LAYOUT_KEYS.has(k)))
  return same(strip(a), strip(b))
}

/** An array that merges by id: one whose items all are objects with an `id`
 *  (or the field `idKey` names: a type's properties have a `key`). */
const byIdArray = (v: unknown, idKey = 'id'): v is Array<Plain & { id: string }> =>
  Array.isArray(v) && v.length > 0 && v.every((item) => isPlain(item) && typeof item[idKey] === 'string')

/** The field a list under `key` merges its entries by. */
const idKeyOf = (key: string | undefined): string => (key === 'properties' ? 'key' : 'id')

/** What a report calls an entry: its label or name; a layout rule (a pin,
 *  a row, a grid) by the elements in it; else its id. An Undo notice named
 *  a pin by its id. */
function entryName(entry: Plain | undefined, id: string, ctx?: Ctx): string {
  const name = entry && (typeof entry.label === 'string' ? entry.label : typeof entry.name === 'string' ? entry.name : '')
  if (name) return name
  if (entry && Array.isArray(entry.nodeIds) && typeof entry.type === 'string') {
    const rule = entry.type === 'pin' ? 'pins' : entry.type === 'grid' ? 'grid' : entry.axis === 'vertical' ? 'column' : 'row'
    const members = (entry.nodeIds as unknown[]).map((n) => ctx?.labels.get(n as string) || String(n))
    return `the ${rule} of ${members.slice(0, 4).join(', ')}${members.length > 4 ? ` and ${members.length - 4} more` : ''}`
  }
  return id
}

interface Ctx {
  conflicts: string[]
  /** The elements' names, for a report (entryName). */
  labels: Map<string, string>
  dropped: MergeDrop[]
}

/** `base`, `ours` and `theirs` of one value merged; `where` names it for a report. */
function merge3(base: unknown, ours: unknown, theirs: unknown, where: string[], ctx: Ctx, layout: boolean): unknown {
  if (same(ours, base)) return theirs
  if (same(theirs, base)) return ours
  if (same(ours, theirs)) return ours
  // A coordinate or size moved by less than a pixel on one side was moved by
  // nobody: the physics settled, or a row was enforced again on a reload.
  // Taken as a change, it kept Undo of "Keep in a row" from putting the row
  // back (the members went back sideways only).
  if (layout && nudged(theirs, base)) return ours
  if (layout && nudged(ours, base)) return theirs
  // An array of entries with ids on either side merges by id.
  const arrays = [base, ours, theirs].filter((v) => v !== undefined)
  const idKey = idKeyOf(where[where.length - 1])
  const entries = (v: unknown) => byIdArray(v, idKey)
  if (arrays.every((v) => Array.isArray(v)) && arrays.some(entries) && arrays.every((v) => (v as unknown[]).length === 0 || entries(v))) {
    return mergeById((base ?? []) as Plain[], (ours ?? []) as Plain[], (theirs ?? []) as Plain[], where, ctx, layout, idKey)
  }
  if (isPlain(ours) && isPlain(theirs) && (base === undefined || isPlain(base))) {
    const b = (base ?? {}) as Plain
    const out: Plain = {}
    const sequence = [b, ours, theirs].some((e) => Array.isArray(e.relationIds))
    const view = [b, ours, theirs].some((e) => Array.isArray(e.nodeIds) && isPlain(e.positions))
    for (const key of new Set([...Object.keys(theirs), ...Object.keys(ours), ...Object.keys(b)])) {
      if (sequence && STEP_KEYS.has(key)) {
        if (key === 'relationIds') {
          const { steps, conflict, dropped } = mergeSteps(b, ours, theirs)
          if (conflict) ctx.conflicts.push([...where, 'steps'].join(': '))
          // A step one side removed and the other changed the note of: the
          // remove won, which "the folder's was kept" did not say.
          for (const d of dropped) ctx.dropped.push({ name: `${where.join(': ')}, step ${d.step + 1}`, by: d.by })
          Object.assign(out, steps)
        }
        continue
      }
      // A view's elements and its `empty` mark merge as one (mergeViewNodes).
      if (view && (key === 'nodeIds' || key === 'empty') && [b.nodeIds, ours.nodeIds, theirs.nodeIds].every(isIdSet)) {
        if (key === 'nodeIds') {
          const { value, conflict } = mergeViewNodes(b, ours, theirs)
          if (conflict) ctx.conflicts.push([...where, 'elements'].join(': '))
          Object.assign(out, value)
        }
        continue
      }
      if (ID_SET_KEYS.has(key) && [b[key], ours[key], theirs[key]].every(isIdSet)) {
        let value = mergeIdSet(b[key] as string[] | undefined, ours[key] as string[] | undefined, theirs[key] as string[] | undefined)
        // Each side narrowed the list, together to none, which would mean any.
        if (ALL_WHEN_EMPTY_KEYS.has(key) && value && value.length === 0 && [ours[key], theirs[key]].every((v) => Array.isArray(v) && v.length > 0)) {
          ctx.conflicts.push([...where, key].join(': '))
          value = theirs[key] as string[]
        }
        if (value !== undefined) out[key] = value
        continue
      }
      const value = merge3(b[key], ours[key], theirs[key], [...where, key], ctx, layout || LAYOUT_KEYS.has(key))
      if (value !== undefined) out[key] = value
    }
    return out
  }
  // Removed on one side, moved or framed anew on the other: it goes. A view
  // whose camera was saved with the folder came back on Undo of its New view.
  if (ours === undefined && sameApartFromLayout(base, theirs)) return undefined
  if (theirs === undefined && sameApartFromLayout(base, ours)) return undefined
  if (!layout) ctx.conflicts.push(where.join(': '))
  return theirs
}

/** Entries of three arrays merged by id, in the order mergeOrder gives. An
 *  entry one side deleted and the other changed goes: the delete wins, and
 *  the change is reported as dropped. */
function mergeById(base: Plain[], ours: Plain[], theirs: Plain[], where: string[], ctx: Ctx, layout: boolean, idKey = 'id'): Plain[] {
  const index = (list: Plain[]) => new Map(list.map((e) => [e[idKey] as string, e]))
  const b = index(base)
  const o = index(ours)
  const t = index(theirs)
  const ids = byTime(mergeOrder([...b.keys()], [...o.keys()], [...t.keys()], where, layout ? null : ctx), b, (id) => o.get(id) ?? t.get(id))
  const out: Plain[] = []
  for (const id of ids) {
    const name = entryName(t.get(id) ?? o.get(id) ?? b.get(id), id, ctx)
    const kept = o.get(id) ?? t.get(id)
    if (b.has(id) && !(o.has(id) && t.has(id))) {
      if (!layout && kept && !sameApartFromLayout(b.get(id), kept)) ctx.dropped.push({ name, by: o.has(id) ? 'ours' : 'theirs' })
      continue
    }
    // A list of entries is named by its parent; an entry by its name, the
    // folder's where both renamed it (the one the screen shows then).
    const value = merge3(b.get(id), o.get(id), t.get(id), [...where.slice(0, -1), name], ctx, layout)
    if (value !== undefined) out.push(value as Plain)
  }
  return out
}

/** Entries with a time (milestones) that both sides added at one place in
 *  the list stand in the order they were made: the side that was not the
 *  folder's went first, and the user's milestone made before the agent's
 *  came after it. Each run of entries `base` lacks is sorted by `timestamp`
 *  (stable); other lists stay as they are. */
function byTime(ids: string[], base: Map<string, Plain>, entry: (id: string) => Plain | undefined): string[] {
  const time = (id: string): number | null => {
    const t = entry(id)?.timestamp
    return typeof t === 'number' ? t : null
  }
  const out = [...ids]
  for (let i = 0; i < out.length;) {
    let j = i
    while (j < out.length && !base.has(out[j]) && time(out[j]) !== null) j++
    if (j - i > 1) {
      const run = out.slice(i, j).sort((a, c) => time(a)! - time(c)!)
      out.splice(i, j - i, ...run)
    }
    i = Math.max(j, i + 1)
  }
  return out
}

/** A view's elements (`nodeIds`, `empty`) merged: an empty list not marked
 *  `empty` is every element, so it does not merge as an empty set. Every
 *  element against a list changed on the other side is every element when
 *  that side only added (they are in it), else a conflict, theirs kept; two
 *  lists made of every element keep what both kept; a list the merge
 *  empties is marked `empty` (a deleted element, a hidden one). */
function mergeViewNodes(base: Plain, ours: Plain, theirs: Plain): { value: Plain; conflict: boolean } {
  const list = (e: Plain): string[] | null => {
    const ids = Array.isArray(e.nodeIds) ? (e.nodeIds as string[]) : []
    return ids.length > 0 || e.empty === true ? ids : null
  }
  const as = (ids: string[] | null): Plain => (ids === null ? { nodeIds: [] } : ids.length ? { nodeIds: ids } : { nodeIds: [], empty: true })
  const lb = list(base), lo = list(ours), lt = list(theirs)
  const eq = (x: string[] | null, y: string[] | null) => (x === null || y === null ? x === y : same(x, y))
  if (eq(lo, lb)) return { value: as(lt), conflict: false }
  if (eq(lt, lb)) return { value: as(lo), conflict: false }
  if (eq(lo, lt)) return { value: as(lt), conflict: false }
  if (lo === null || lt === null) {
    const other = (lo === null ? lt : lo)!
    if (lb !== null && lb.every((id) => other.includes(id))) return { value: as(null), conflict: false }
    return { value: as(lt), conflict: true }
  }
  if (lb === null) return { value: as(lt.filter((id) => lo.includes(id))), conflict: false }
  return { value: as(mergeIdSet(lb, lo, lt) ?? []), conflict: false }
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

// ─── A sequence's steps ─────────────────────────────────────────────────────

/** A sequence's steps: what mergeSteps reads and gives. */
export interface SequenceSteps {
  relationIds: string[]
  stepDescriptions?: (string | undefined)[]
  stepBackward?: boolean[]
}

/** A step: its relation, its note, and whether it runs the relation backward. */
type Step = { rel: string; note: string | undefined; back: boolean }

const stepsOf = (seq: Partial<SequenceSteps> | Plain | undefined): Step[] => {
  const rels = Array.isArray(seq?.relationIds) ? (seq!.relationIds as string[]) : []
  const notes = Array.isArray(seq?.stepDescriptions) ? (seq!.stepDescriptions as unknown[]) : []
  const back = Array.isArray(seq?.stepBackward) ? (seq!.stepBackward as unknown[]) : []
  return rels.map((rel, i) => ({ rel, note: typeof notes[i] === 'string' && notes[i] ? (notes[i] as string) : undefined, back: back[i] === true }))
}

/** For each step of `a`, the index of the step of `b` it is (-1: none), along
 *  the longest run of relations both have in the same order; of the runs as
 *  long, the one whose steps keep the most notes and ways (a relation used
 *  by two steps: the step removed is the one whose note went, not the
 *  first). */
function alignSteps(a: Step[], b: Step[]): number[] {
  const n = a.length, m = b.length
  // A step paired weighs more than every note and way kept together.
  const pair = 2 * (n + m) + 1
  const weight = (i: number, j: number) => (a[i].rel !== b[j].rel ? 0 : pair + (a[i].note === b[j].note ? 1 : 0) + (a[i].back === b[j].back ? 1 : 0))
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const w = weight(i, j)
      lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1], w ? lcs[i + 1][j + 1] + w : 0)
    }
  }
  const out = new Array<number>(n).fill(-1)
  for (let i = 0, j = 0; i < n && j < m;) {
    const w = weight(i, j)
    if (w && lcs[i][j] === lcs[i + 1][j + 1] + w) { out[i++] = j++ }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++
    else j++
  }
  return out
}

/** The steps `ours` and `theirs` made of `base`'s merged: the steps of base
 *  that both kept, in base's order, with the note and the way the side that
 *  changed it gave it (theirs where both did: a conflict); a step one side
 *  removed is out (`dropped`, by the side whose change went, where the other
 *  changed its note or turned it); the steps each side added sit after the step of base they follow
 *  there, theirs first. A step moved is one removed and one added. */
export function mergeSteps(
  base: Partial<SequenceSteps> | Plain | undefined,
  ours: Partial<SequenceSteps> | Plain | undefined,
  theirs: Partial<SequenceSteps> | Plain | undefined,
): { steps: SequenceSteps; conflict: boolean; dropped: Array<{ step: number; by: MergeDrop['by'] }> } {
  const b = stepsOf(base), o = stepsOf(ours), t = stepsOf(theirs)
  const toO = alignSteps(b, o), toT = alignSteps(b, t)
  /** The steps a side added, by the index of the step of base they follow (-1: first). */
  const added = (side: Step[], to: number[]) => {
    const kept = new Map<number, number>() // index in side → index in base
    to.forEach((j, i) => { if (j >= 0) kept.set(j, i) })
    const out = new Map<number, Step[]>()
    let after = -1
    side.forEach((step, j) => {
      if (kept.has(j)) { after = kept.get(j)!; return }
      out.set(after, [...(out.get(after) ?? []), step])
    })
    return out
  }
  const addedO = added(o, toO), addedT = added(t, toT)
  let conflict = false
  const dropped: Array<{ step: number; by: MergeDrop['by'] }> = []
  const out: Step[] = []
  const insert = (after: number) => {
    const fromT = addedT.get(after) ?? [], fromO = addedO.get(after) ?? []
    out.push(...fromT)
    if (!same(fromO, fromT)) out.push(...fromO)
  }
  insert(-1)
  b.forEach((step, i) => {
    const so = toO[i] >= 0 ? o[toO[i]] : undefined
    const st = toT[i] >= 0 ? t[toT[i]] : undefined
    if (so && st) {
      const note = so.note === step.note ? st.note : st.note === step.note ? so.note : st.note
      if (so.note !== step.note && st.note !== step.note && so.note !== st.note) conflict = true
      // A flag: where both changed it, they changed it alike.
      out.push({ rel: step.rel, note, back: so.back === step.back ? st.back : so.back })
    } else if (so && (so.note !== step.note || so.back !== step.back)) {
      dropped.push({ step: i, by: 'ours' })
    } else if (st && (st.note !== step.note || st.back !== step.back)) {
      dropped.push({ step: i, by: 'theirs' })
    }
    insert(i)
  })
  const notes = out.map((s) => s.note)
  while (notes.length > 0 && notes[notes.length - 1] === undefined) notes.pop()
  const keepsNotes = notes.length > 0 || [ours, theirs].some((s) => Array.isArray(s?.stepDescriptions))
  const back = trimStepBackward(out.map((s) => s.back))
  return { steps: { relationIds: out.map((s) => s.rel), ...(keepsNotes ? { stepDescriptions: notes } : {}), ...(back ? { stepBackward: back } : {}) }, conflict, dropped }
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

/** `ours` and `theirs`, both changed from `base`, merged (see above).
 *  `keepParents: false` leaves a container deleted on one side deleted,
 *  where an element the other side put into it is left without one, and
 *  a relation or a step to what one side deleted in place: Undo keeps what
 *  was built on since and leaves the rest out itself (item 127). */
export function mergeModels(base: DiagramData, ours: DiagramData, theirs: DiagramData, opts?: { keepParents?: boolean }): ModelMergeResult {
  const labels = new Map<string, string>()
  for (const side of [base, ours, theirs]) for (const n of side.nodes ?? []) if (n.label) labels.set(n.id, n.label)
  const ctx: Ctx = { conflicts: [], labels, dropped: [] }
  const merged = merge3(base, ours, theirs, [], ctx, false) as DiagramData
  const restored = opts?.keepParents === false ? [] : restoreParents(merged, ours, theirs)
  if (opts?.keepParents !== false) dropStrays(merged, base, ours, theirs, ctx)
  followFolderRenames(merged, base, ours, theirs)
  const dropped = ctx.dropped.filter((d, i) => !restored.includes(d.name) && ctx.dropped.findIndex((e) => e.name === d.name && e.by === d.by && e.change === d.change) === i)
  return { merged, conflicts: [...new Set(ctx.conflicts)], dropped, restored }
}

/** What a merge dropped and brought back, in sentences; `where` says where
 *  each side's edits were made: { ours: 'in Studio', theirs: 'outside Studio' }. */
export function mergeNotices(result: { dropped?: MergeDrop[]; restored?: string[] }, where: { ours: string; theirs: string }): string[] {
  const other = (by: MergeDrop['by']) => (by === 'ours' ? 'theirs' : 'ours')
  return [
    ...(result.dropped ?? []).map((d) => `${d.name} was deleted ${where[other(d.by)]}; ${d.change ?? 'the change made to it'} ${where[d.by]} was dropped`),
    ...(result.restored ?? []).map((name) => `${name}, deleted on one side, came back with its relations: an element was put into it on the other`),
  ]
}

/** View folders one side renamed (every view of the folder, and of those
 *  in it, moved to another path), followed in `merged` (in place) by the
 *  views the other side filed under the old path: the old folder came back
 *  with only those. */
function followFolderRenames(merged: DiagramData, base: DiagramData, ours: DiagramData, theirs: DiagramData): void {
  const path = (folder: string | undefined) => (folder ?? '').split('/').map((p) => p.trim()).filter(Boolean)
  const under = (folder: string[], prefix: string[]) => prefix.length > 0 && prefix.every((p, i) => folder[i] === p)
  const renames = new Map<string, string[]>()
  for (const side of [ours, theirs]) {
    const now = new Map((side.views ?? []).map((v) => [v.id, path(v.folder)]))
    for (const view of base.views ?? []) {
      const from = path(view.folder)
      const to = now.get(view.id)
      if (!to || !from.length || from.join('/') === to.join('/')) continue
      // The folder renamed: the path less the segments both end in.
      const f = [...from], t = [...to]
      while (f.length > 1 && t.length > 1 && f[f.length - 1] === t[t.length - 1]) { f.pop(); t.pop() }
      if ([...now.values()].some((folder) => under(folder, f))) continue
      const key = f.join('/')
      if (renames.has(key) && renames.get(key)!.join('/') !== t.join('/')) renames.set(key, f) // two renames: none
      else renames.set(key, t)
    }
  }
  const prefixes = [...renames].filter(([from, to]) => from !== to.join('/')).sort((a, b) => b[0].length - a[0].length)
  if (!prefixes.length) return
  merged.views = merged.views?.map((view) => {
    const folder = path(view.folder)
    const hit = prefixes.find(([from]) => under(folder, from.split('/')))
    return hit ? { ...view, folder: [...hit[1], ...folder.slice(hit[0].split('/').length)].join('/') } : view
  })
}

/** Containers one side deleted while the other put an element into them,
 *  brought back into `merged` (in place) from the side that kept them: the
 *  container, the ones around it, their relations to what is left, and
 *  their places on the views that side shows them on. Returns their names. */
function restoreParents(merged: DiagramData, ours: DiagramData, theirs: DiagramData): string[] {
  if (!Array.isArray(merged.nodes)) return []
  const nodes = new Map(merged.nodes.map((n) => [n.id, n]))
  const back: Array<{ id: string; side: DiagramData }> = []
  const sideOf = (id: string) => [ours, theirs].find((d) => d.nodes?.some((n) => n.id === id))
  for (let i = 0; i < merged.nodes.length; i++) {
    const parentId = merged.nodes[i].parentId
    if (!parentId || nodes.has(parentId)) continue
    const side = sideOf(parentId)
    const parent = side?.nodes.find((n) => n.id === parentId)
    if (!side || !parent) continue
    // Pushed onto the list it walks: a restored container's own parent next.
    merged.nodes.push(parent)
    nodes.set(parentId, parent)
    back.push({ id: parentId, side })
  }
  if (!back.length) return []
  const relationIds = new Set((merged.relations ?? []).map((r) => r.id))
  for (const { id, side } of back) {
    for (const r of side.relations ?? []) {
      if ((r.sourceId === id || r.targetId === id) && nodes.has(r.sourceId) && nodes.has(r.targetId) && !relationIds.has(r.id)) {
        merged.relations.push(r)
        relationIds.add(r.id)
      }
    }
    // Copies: a view the merge took whole is the side's own object.
    merged.views = merged.views?.map((view) => {
      const was = side.views?.find((v) => v.id === view.id)
      if (!was || !was.nodeIds.includes(id) || view.nodeIds.includes(id)) return view
      // An empty list not marked empty shows every element, this one too.
      if (view.nodeIds.length === 0 && !view.empty) return view
      const { empty: _empty, ...rest } = view
      const place = was.positions?.[id] && !view.positions?.[id] ? { [id]: was.positions[id] } : {}
      return { ...rest, nodeIds: [...view.nodeIds, id], positions: { ...view.positions, ...place } }
    })
  }
  return back.map(({ id }) => entryName(nodes.get(id) as unknown as Plain, id))
}

/** Relations to an element one side deleted, which the other side drew or
 *  turned to it, and the steps one side added of a relation the other side
 *  deleted, taken out of `merged` (in place): the delete wins, as it does
 *  for an element one side deleted and the other changed (mergeById). Each
 *  is reported as dropped, by the side that made it; a step of a relation
 *  dropped here goes with it, without a word of its own. An end or a
 *  relation no side had is left as it is: the merge did not break it. They
 *  stayed in the folder, which get_issues flagged while the canvas did not
 *  draw them (item 234). */
function dropStrays(merged: DiagramData, base: DiagramData, ours: DiagramData, theirs: DiagramData, ctx: Ctx): void {
  if (!Array.isArray(merged.nodes) || !Array.isArray(merged.relations)) return
  const sides = [base, ours, theirs]
  const nodes = new Set(merged.nodes.map((n) => n.id))
  const hadNode = (id: string) => sides.some((d) => d.nodes?.some((n) => n.id === id))
  const label = (id: string) => ctx.labels.get(id) || id
  const gone = new Set<string>()
  merged.relations = merged.relations.filter((r) => {
    const end = [r.sourceId, r.targetId].find((id) => !nodes.has(id) && hadNode(id))
    if (end === undefined) return true
    // The side that still has the element drew the relation to it.
    const by = ours.nodes?.some((n) => n.id === end) ? 'ours' : 'theirs'
    ctx.dropped.push({ name: label(end), by, change: `the relation ${label(r.sourceId)} → ${label(r.targetId)} made to it` })
    gone.add(r.id)
    return false
  })
  const relations = new Set(merged.relations.map((r) => r.id))
  const relationOf = (id: string) => sides.map((d) => d.relations?.find((r) => r.id === id)).find(Boolean)
  merged.sequences = merged.sequences?.map((seq) => {
    const keep = seq.relationIds.map((id) => relations.has(id) || (!gone.has(id) && !relationOf(id)))
    if (keep.every(Boolean)) return seq
    for (const id of new Set(seq.relationIds.filter((id, i) => !keep[i] && !gone.has(id)))) {
      const r = relationOf(id)!
      const by = ours.relations?.some((x) => x.id === id) ? 'ours' : 'theirs'
      // Only steps the side that deleted the relation did not have are news
      // (a file from before deletes took the steps along keeps them).
      const count = (ids: string[] | undefined) => (ids ?? []).filter((x) => x === id).length
      const deleter = (by === 'ours' ? theirs : ours).sequences?.find((q) => q.id === seq.id)
      if (count(seq.relationIds) <= count(deleter?.relationIds)) continue
      ctx.dropped.push({ name: r.label || `${label(r.sourceId)} → ${label(r.targetId)}`, by, change: `the step of ${seq.name} made with it` })
    }
    const notes = seq.stepDescriptions?.filter((_, i) => keep[i])
    const back = trimStepBackward(seq.relationIds.map((_, i) => !!seq.stepBackward?.[i]).filter((_, i) => keep[i]))
    const { stepBackward: _was, ...rest } = seq
    return { ...rest, relationIds: seq.relationIds.filter((_, i) => keep[i]), ...(notes ? { stepDescriptions: notes } : {}), ...(back ? { stepBackward: back } : {}) }
  })
  if (gone.size) {
    merged.views = merged.views?.map((view) =>
      view.hiddenRelationIds?.some((id) => gone.has(id)) ? { ...view, hiddenRelationIds: view.hiddenRelationIds.filter((id) => !gone.has(id)) } : view)
  }
}

// ─── Edits kept apart ────────────────────────────────────────────────────────
// Edits not written yet when the page goes away (Studio holding its saves for
// an agent) are kept in browser storage and merged into the folder's model
// when it is opened again. A model may be megabytes, browser storage holds a
// few: what is kept is only what `ours` changed from `base`.

/** What `ours` changed from `base`, per key of the model: of a list of
 *  entries with ids, the entries that differ (null where one is absent) and
 *  the order of each side's ids; of anything else, both values. */
export type ModelEdits = Record<string,
  | { entries: true; baseOrder: string[]; oursOrder: string[]; base: Record<string, Plain | null>; ours: Record<string, Plain | null> }
  | { entries?: undefined; base: unknown; ours: unknown }>

/** What `ours` changed from `base` (ModelEdits); empty when nothing. */
export function modelEdits(base: DiagramData, ours: DiagramData): ModelEdits {
  const b = base as unknown as Plain
  const o = ours as unknown as Plain
  const edits: ModelEdits = {}
  for (const key of new Set([...Object.keys(b), ...Object.keys(o)])) {
    if (same(b[key], o[key])) continue
    const lists = [b[key], o[key]].filter((v) => v !== undefined)
    if (lists.every((v) => Array.isArray(v) && (v.length === 0 || byIdArray(v))) && lists.some((v) => byIdArray(v))) {
      const bl = (b[key] ?? []) as Plain[]
      const ol = (o[key] ?? []) as Plain[]
      const bi = new Map(bl.map((e) => [e.id as string, e]))
      const oi = new Map(ol.map((e) => [e.id as string, e]))
      const entry = { entries: true as const, baseOrder: [...bi.keys()], oursOrder: [...oi.keys()], base: {} as Record<string, Plain | null>, ours: {} as Record<string, Plain | null> }
      for (const id of new Set([...bi.keys(), ...oi.keys()])) {
        if (same(bi.get(id), oi.get(id))) continue
        entry.base[id] = bi.get(id) ?? null
        entry.ours[id] = oi.get(id) ?? null
      }
      edits[key] = entry
    } else {
      edits[key] = { base: b[key], ours: o[key] }
    }
  }
  return edits
}

/** `edits` (modelEdits) merged into `theirs` as mergeModels merges: the
 *  model they were made on and the one they made are `theirs` with only
 *  the edited parts as they were and became. */
export function mergeModelEdits(edits: ModelEdits, theirs: DiagramData): ModelMergeResult {
  const t = theirs as unknown as Plain
  const base: Plain = { ...t }
  const ours: Plain = { ...t }
  for (const [key, edit] of Object.entries(edits)) {
    if (!edit.entries) {
      base[key] = edit.base
      ours[key] = edit.ours
      continue
    }
    const now = new Map(((Array.isArray(t[key]) ? t[key] : []) as Plain[]).map((e) => [e.id as string, e]))
    const side = (order: string[], changed: Record<string, Plain | null>): Plain[] =>
      order.flatMap((id) => (id in changed ? (changed[id] ? [changed[id]!] : []) : now.has(id) ? [now.get(id)!] : []))
    base[key] = side(edit.baseOrder, edit.base)
    ours[key] = side(edit.oursOrder, edit.ours)
  }
  return mergeModels(base as unknown as DiagramData, ours as unknown as DiagramData, theirs)
}
