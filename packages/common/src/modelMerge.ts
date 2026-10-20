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
//   note of each) merge as one list of steps, along the steps both sides
//   kept from base: what either side removed is out, what either added is in
//   where it added it, and a note changed on one side stays on its step.
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

/** A sequence's keys merged together, as its steps (mergeSteps). */
const STEP_KEYS = new Set(['relationIds', 'stepDescriptions'])

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
    const sequence = [b, ours, theirs].some((e) => Array.isArray(e.relationIds))
    for (const key of new Set([...Object.keys(theirs), ...Object.keys(ours), ...Object.keys(b)])) {
      if (sequence && STEP_KEYS.has(key)) {
        if (key === 'relationIds') {
          const { steps, conflict } = mergeSteps(b, ours, theirs)
          if (conflict) ctx.conflicts.push([...where, 'steps'].join(': '))
          Object.assign(out, steps)
        }
        continue
      }
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
    const name = entryName(t.get(id) ?? o.get(id) ?? b.get(id), id)
    // A list of entries is named by its parent; an entry by its name, the
    // folder's where both renamed it (the one the screen shows then).
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

// ─── A sequence's steps ─────────────────────────────────────────────────────

/** A sequence's steps: what mergeSteps reads and gives. */
export interface SequenceSteps {
  relationIds: string[]
  stepDescriptions?: (string | undefined)[]
}

type Step = { rel: string; note: string | undefined }

const stepsOf = (seq: Partial<SequenceSteps> | Plain | undefined): Step[] => {
  const rels = Array.isArray(seq?.relationIds) ? (seq!.relationIds as string[]) : []
  const notes = Array.isArray(seq?.stepDescriptions) ? (seq!.stepDescriptions as unknown[]) : []
  return rels.map((rel, i) => ({ rel, note: typeof notes[i] === 'string' && notes[i] ? (notes[i] as string) : undefined }))
}

/** For each step of `a`, the index of the step of `b` it is (-1: none), along
 *  the longest run of relations both have in the same order. */
function alignSteps(a: Step[], b: Step[]): number[] {
  const n = a.length, m = b.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i].rel === b[j].rel ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const out = new Array<number>(n).fill(-1)
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i].rel === b[j].rel) { out[i++] = j++ }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++
    else j++
  }
  return out
}

/** The steps `ours` and `theirs` made of `base`'s merged: the steps of base
 *  that both kept, in base's order, with the note the side that changed it
 *  gave it (theirs where both did: a conflict); a step one side removed is
 *  out (a conflict where the other changed its note); the steps each side
 *  added sit after the step of base they follow there, theirs first. A step
 *  moved is one removed and one added. */
export function mergeSteps(
  base: Partial<SequenceSteps> | Plain | undefined,
  ours: Partial<SequenceSteps> | Plain | undefined,
  theirs: Partial<SequenceSteps> | Plain | undefined,
): { steps: SequenceSteps; conflict: boolean } {
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
      out.push({ rel: step.rel, note })
    } else if ((so && so.note !== step.note) || (st && st.note !== step.note)) {
      conflict = true
    }
    insert(i)
  })
  const notes = out.map((s) => s.note)
  while (notes.length > 0 && notes[notes.length - 1] === undefined) notes.pop()
  const keepsNotes = notes.length > 0 || [ours, theirs].some((s) => Array.isArray(s?.stepDescriptions))
  return { steps: { relationIds: out.map((s) => s.rel), ...(keepsNotes ? { stepDescriptions: notes } : {}) }, conflict }
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
    if (lists.every((v) => Array.isArray(v) && (v.length === 0 || byIdArray(v))) && lists.some(byIdArray)) {
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
