// ─── What changed in a model ─────────────────────────────────────────────────
//
// The changes between two versions of a model, for an agent that implements
// them: get_changes over MCP and `radical diff` compare the model folder with
// its version in git. Only the model counts — elements and relations with
// their fields; views, positions, sizes and folding are left out, the same
// definition of a change as compare_milestones (compareModels).

import type { C4Node, C4Relation } from './c4'
import { compareModels, type ModelCopy } from './model'

export interface FieldChange {
  field: string
  before: unknown
  after: unknown
}

/** One end of a relation, or an element a changed element relates to. */
export interface ElementRef {
  id: string
  type: string
  label: string
}

/** A relation of a changed element, seen from that element. */
export interface RelatedElement extends ElementRef {
  relationType: string | null
  /** out: the changed element is the relation's source; in: its target. */
  direction: 'out' | 'in'
}

export interface ElementChange extends ElementRef {
  /** Labels of the element's ancestors, outermost first. */
  path: string[]
  /** Added or removed: the element's fields, layout left out. */
  fields?: Record<string, unknown>
  /** Changed: each field with its old and new value. */
  changes?: FieldChange[]
  /** The element's relations in its version (the new one, the old one when removed). */
  related: RelatedElement[]
}

export interface RelationChange {
  id: string
  relationType: string | null
  label: string | null
  source: ElementRef
  target: ElementRef
  fields?: Record<string, unknown>
  changes?: FieldChange[]
}

export interface ModelChangeReport {
  elements: { added: ElementChange[]; removed: ElementChange[]; changed: ElementChange[] }
  relations: { added: RelationChange[]; removed: RelationChange[]; changed: RelationChange[] }
}

/** Fields of an element or relation that are not the model: identity and layout. */
const NOT_MODEL = new Set(['id', 'x', 'y', 'width', 'height', 'collapsed'])
/** Fields an entry already shows in its heading. */
const SHOWN = new Set(['type', 'label', 'parentId', 'sourceId', 'targetId', 'relationType'])

const present = (value: unknown): boolean => value !== undefined && value !== null && value !== ''

function modelFields(item: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(item).filter(([key, value]) => !NOT_MODEL.has(key) && !SHOWN.has(key) && present(value)))
}

/** The model fields that differ between two versions of an element or
 *  relation, with both values; layout left out. */
export function modelFieldChanges(before: object, after: object): FieldChange[] {
  const a = before as Record<string, unknown>
  const b = after as Record<string, unknown>
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((key) => !NOT_MODEL.has(key) && JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null))
    .sort()
    .map((field) => ({ field, before: a[field] ?? null, after: b[field] ?? null }))
}

function pathOf(node: C4Node, nodes: Record<string, C4Node>): string[] {
  const path: string[] = []
  for (let cur = node.parentId ? nodes[node.parentId] : undefined; cur && path.length < 64; cur = cur.parentId ? nodes[cur.parentId] : undefined) {
    path.unshift(cur.label)
  }
  return path
}

const refOf = (id: string, ...copies: ModelCopy[]): ElementRef => {
  const node = copies.map((copy) => copy.nodes[id]).find(Boolean)
  return node ? { id, type: node.type, label: node.label } : { id, type: '?', label: id }
}

/** The changes from `before` to `after`, each with what an agent needs to
 *  find its place: old and new values, the element's ancestors and relations. */
export function modelChangeReport(before: ModelCopy, after: ModelCopy): ModelChangeReport {
  const changes = compareModels(before, after)
  const relatedIn = (copy: ModelCopy, id: string): RelatedElement[] =>
    Object.values(copy.relations)
      .filter((r) => r.sourceId === id || r.targetId === id)
      .map((r): RelatedElement => {
        const out = r.sourceId === id
        return { ...refOf(out ? r.targetId : r.sourceId, copy), relationType: r.relationType ?? null, direction: out ? 'out' : 'in' }
      })
      .sort((a, b) => (a.relationType ?? '').localeCompare(b.relationType ?? '') || a.label.localeCompare(b.label))
  const element = (copy: ModelCopy, id: string, extra: Partial<ElementChange>): ElementChange => {
    const node = copy.nodes[id]
    return { id, type: node.type, label: node.label, path: pathOf(node, copy.nodes), ...extra, related: relatedIn(copy, id) }
  }
  const fieldChanges = (from: object, to: object, fields: string[]): FieldChange[] =>
    fields.map((field) => ({ field, before: (from as Record<string, unknown>)[field] ?? null, after: (to as Record<string, unknown>)[field] ?? null }))
  const relation = (r: C4Relation, extra: Partial<RelationChange>): RelationChange => ({
    id: r.id,
    relationType: r.relationType ?? null,
    label: r.label ?? null,
    source: refOf(r.sourceId, after, before),
    target: refOf(r.targetId, after, before),
    ...extra,
  })
  const byPlace = (a: ElementChange, b: ElementChange) =>
    [...a.path, a.label].join('\0').localeCompare([...b.path, b.label].join('\0')) || a.id.localeCompare(b.id)
  const byEnds = (a: RelationChange, b: RelationChange) =>
    a.source.label.localeCompare(b.source.label) || a.target.label.localeCompare(b.target.label) || a.id.localeCompare(b.id)
  return {
    elements: {
      added: changes.nodes.added.map((id) => element(after, id, { fields: modelFields(after.nodes[id]) })).sort(byPlace),
      removed: changes.nodes.removed.map((id) => element(before, id, { fields: modelFields(before.nodes[id]) })).sort(byPlace),
      changed: changes.nodes.changed
        .map(({ id, fields }) => element(after, id, { changes: fieldChanges(before.nodes[id], after.nodes[id], fields) }))
        .sort(byPlace),
    },
    relations: {
      added: changes.relations.added.map((id) => relation(after.relations[id], { fields: modelFields(after.relations[id]) })).sort(byEnds),
      removed: changes.relations.removed.map((id) => relation(before.relations[id], { fields: modelFields(before.relations[id]) })).sort(byEnds),
      changed: changes.relations.changed
        .map(({ id, fields }) => relation(after.relations[id], { changes: fieldChanges(before.relations[id], after.relations[id], fields) }))
        .sort(byEnds),
    },
  }
}

export const countModelChanges = (report: ModelChangeReport): number =>
  [report.elements, report.relations].reduce((sum, group) => sum + group.added.length + group.removed.length + group.changed.length, 0)

/** At most this many relations of one element in the text. */
const MAX_RELATED = 12
/** A changed text longer than this shows its old and new value on lines of their own. */
const LONG_TEXT = 60

/** The report as text an agent or a person reads: one entry per change, each
 *  field on its own line, multi-line values indented under it. */
export function formatModelChanges(report: ModelChangeReport, before: ModelCopy, after: ModelCopy): string {
  const lines: string[] = []
  const name = (ref: ElementRef) => `${ref.type} "${ref.label}" (${ref.id})`
  const value = (v: unknown): string => {
    if (!present(v)) return '(none)'
    return typeof v === 'string' ? v : JSON.stringify(v)
  }
  const field = (indent: string, key: string, v: string) => {
    const [first, ...rest] = v.split('\n')
    lines.push(`${indent}${key}: ${first}`, ...rest.map((line) => `${indent}  ${line}`))
  }
  const parentLabel = (id: unknown, copy: ModelCopy) => {
    if (typeof id !== 'string' || !id) return '(root)'
    const node = copy.nodes[id]
    return node ? [...pathOf(node, copy.nodes), node.label].join(' › ') : id
  }
  const element = (change: ElementChange) => {
    lines.push(`- ${name(change)}${change.path.length ? ` in ${change.path.join(' › ')}` : ''}`)
    for (const [key, v] of Object.entries(change.fields ?? {})) field('    ', key, value(v))
    for (const c of change.changes ?? []) {
      if (c.field === 'parentId') { lines.push(`    moved: ${parentLabel(c.before, before)} → ${parentLabel(c.after, after)}`); continue }
      // Long texts on two lines, so the old and the new one read one under the other.
      const long = [c.before, c.after].some((v) => typeof v === 'string' && (v.includes('\n') || v.length > LONG_TEXT))
      if (long) { field('    ', `${c.field} before`, value(c.before)); field('    ', `${c.field} now`, value(c.after)) }
      else lines.push(`    ${c.field}: ${value(c.before)} → ${value(c.after)}`)
    }
    if (change.related.length) {
      lines.push('    relations:')
      for (const r of change.related.slice(0, MAX_RELATED)) {
        lines.push(`      ${r.direction === 'out' ? '→' : '←'} ${r.relationType ?? 'relation'} ${name(r)}`)
      }
      if (change.related.length > MAX_RELATED) lines.push(`      …and ${change.related.length - MAX_RELATED} more (search_model: GET NEIGHBORS OF ${change.id})`)
    }
  }
  const relation = (change: RelationChange) => {
    lines.push(`- ${name(change.source)} → ${name(change.target)} [${change.relationType ?? 'relation'}]${change.label ? ` "${change.label}"` : ''} (${change.id})`)
    for (const [key, v] of Object.entries(change.fields ?? {})) if (key !== 'label') field('    ', key, value(v))
    for (const c of change.changes ?? []) lines.push(`    ${c.field}: ${value(c.before)} → ${value(c.after)}`)
  }
  const section = <T>(title: string, items: T[], write: (item: T) => void) => {
    if (!items.length) return
    if (lines.length) lines.push('')
    lines.push(`${title} (${items.length}):`)
    items.forEach(write)
  }
  section('Elements added', report.elements.added, element)
  section('Elements changed', report.elements.changed, element)
  section('Elements removed', report.elements.removed, element)
  section('Relations added', report.relations.added, relation)
  section('Relations changed', report.relations.changed, relation)
  section('Relations removed', report.relations.removed, relation)
  return lines.join('\n')
}
