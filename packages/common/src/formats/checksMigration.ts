// ─── Models from before `metrics` ────────────────────────────────────────────
//
// Scenarios and fitness functions named their tests in a `tests` property
// (one `<file> › <title>` per line), and a fitness function stated its
// success criteria as text in `threshold`. Both are conditions in `metrics`
// now: each test id becomes a `test(<id>) passed` line, and a threshold,
// which is prose more often than a value to compare, goes to the end of the
// description, where the person who turns it into a condition reads it.
//
// A fitness function had a `category` (structural, operational, process,
// holistic), which mixed what it protects with how much it takes in. It is
// classified now as Building Evolutionary Architectures does: a holistic one
// gets scope holistic, a structural one the characteristic maintainability,
// and one checked by tests alone runs triggered on pull requests, automated.
// What cannot be told from the old value stays empty, for radical check to
// ask for.
//
// The model is brought up to date where it is read, so every editor, the
// CLI and the MCP server see one format, and the next save writes it.

import type { C4Node, DiagramData } from '../c4'
import type { Metamodel, NodeTypeDef } from '../metamodel/types'
import { FITNESS_CLASSIFICATION_PROPERTIES, METRICS_PROPERTIES } from '../metamodel/presets/governance'

const CHECKED_TYPES = new Set(['scenario', 'fitness-fn'])
const OLD_KEYS = ['tests', 'threshold'] as const

type Fields = Record<string, unknown>

const text = (v: unknown): string => typeof v === 'string' ? v.trim() : ''

const needsMigration = (node: Fields): boolean =>
  CHECKED_TYPES.has(String(node.type)) && (OLD_KEYS.some((k) => k in node) || (node.type === 'fitness-fn' && 'category' in node))

const onlyTests = (metrics: string): boolean => {
  const lines = metrics.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  return lines.length > 0 && lines.every((l) => /^test\(.*\)\s+passed$/.test(l))
}

/** A fitness function's `category` turned into its classification. */
function classify(next: Fields): void {
  const category = text(next.category)
  delete next.category
  if (category === 'holistic' && !next.scope) next.scope = 'holistic'
  if (category === 'structural' && !next.characteristic) next.characteristic = 'maintainability'
  if (!next.cadence && !next.invocation && onlyTests(text(next.metrics))) {
    next.cadence = 'triggered'
    next.trigger = 'pull-request'
    next.invocation = 'automated'
  }
}

/** One node, or a Hub template's node, with `tests` and `threshold` moved:
 *  the same object when it has neither. */
export function migrateCheckFields<T extends Fields>(node: T): T {
  if (!needsMigration(node)) return node
  const next: Fields = { ...node }
  const tests = text(node.tests).split('\n').map((l) => l.trim()).filter(Boolean)
    .map((line) => line.startsWith('#') ? line : `test(${line}) passed`)
  if (tests.length) next.metrics = [text(node.metrics), ...tests].filter(Boolean).join('\n')
  const threshold = text(node.threshold)
  if (threshold) {
    const description = text(node.description)
    next.description = description ? `${description}\n\nThreshold: ${threshold}` : `Threshold: ${threshold}`
  }
  for (const key of OLD_KEYS) delete next[key]
  if (node.type === 'fitness-fn' && 'category' in node) classify(next)
  return next as T
}

/** A node type of a metamodel saved with the model, its properties and
 *  wizard brought to `metrics`: the same object when it has no old key. */
function migrateNodeType(def: NodeTypeDef): NodeTypeDef {
  return migrateCategory(migrateOldKeys(def))
}

/** A fitness-function type saved with its `category`: the classification
 *  in its place, in the properties and the wizard. */
function migrateCategory(def: NodeTypeDef): NodeTypeDef {
  if (def.id !== 'fitness-fn' || !def.properties?.some((p) => p.key === 'category')) return def
  const at = def.properties.findIndex((p) => p.key === 'category')
  const kept = def.properties.filter((p) => p.key !== 'category')
  const missing = FITNESS_CLASSIFICATION_PROPERTIES.filter((p) => !kept.some((k) => k.key === p.key))
  const properties = [...kept.slice(0, at), ...missing, ...kept.slice(at)]
  const wizard = def.wizard && {
    ...def.wizard,
    steps: def.wizard.steps.map((step) => step.kind === 'fields' && step.fields.includes('category')
      ? { ...step, fields: [...new Set(step.fields.map((f) => f === 'category' ? 'characteristic' : f))] }
      : step),
  }
  return { ...def, properties, ...(wizard ? { wizard } : {}) }
}

function migrateOldKeys(def: NodeTypeDef): NodeTypeDef {
  if (!CHECKED_TYPES.has(def.id) || !def.properties?.some((p) => (OLD_KEYS as readonly string[]).includes(p.key))) return def
  const at = def.properties.findIndex((p) => (OLD_KEYS as readonly string[]).includes(p.key))
  const kept = def.properties.filter((p) => !(OLD_KEYS as readonly string[]).includes(p.key))
  const missing = METRICS_PROPERTIES.filter((p) => !kept.some((k) => k.key === p.key))
  const properties = [...kept.slice(0, at), ...missing, ...kept.slice(at)]
  const wizard = def.wizard && {
    ...def.wizard,
    steps: def.wizard.steps.map((step) => step.kind === 'fields' && step.fields.some((f) => (OLD_KEYS as readonly string[]).includes(f))
      ? { ...step, fields: [...new Set(step.fields.map((f) => (OLD_KEYS as readonly string[]).includes(f) ? 'metrics' : f))] }
      : step),
  }
  return { ...def, properties, ...(wizard ? { wizard } : {}) }
}

function migrateMetamodel(metamodel: Metamodel): Metamodel {
  let changed = false
  const nodeTypes: Metamodel['nodeTypes'] = {}
  for (const [id, def] of Object.entries(metamodel.nodeTypes)) {
    nodeTypes[id] = migrateNodeType(def)
    if (nodeTypes[id] !== def) changed = true
  }
  return changed ? { ...metamodel, nodeTypes } : metamodel
}

const migrateRecord = (nodes: Record<string, C4Node>): Record<string, C4Node> => {
  if (!Object.values(nodes).some((n) => needsMigration(n as unknown as Fields))) return nodes
  return Object.fromEntries(Object.entries(nodes).map(([id, n]) => [id, migrateCheckFields(n as unknown as Fields) as unknown as C4Node]))
}

/** `data` with every scenario and fitness function (the live model, the
 *  milestones, the slides' copies, the Hub templates) and the metamodel
 *  brought to `metrics`; the same object when nothing had to move. */
export function migrateChecks(data: DiagramData): DiagramData {
  const nodes = data.nodes.some((n) => needsMigration(n as unknown as Fields))
    ? data.nodes.map((n) => migrateCheckFields(n as unknown as Fields) as unknown as C4Node)
    : data.nodes
  const metamodel = data.metamodel ? migrateMetamodel(data.metamodel) : undefined
  const snapshots = data.snapshots?.map((s) => {
    const next = migrateRecord(s.nodes)
    return next === s.nodes ? s : { ...s, nodes: next }
  })
  const presentations = data.presentations?.map((p) => {
    const slides = p.slides.map((slide) => {
      if (!slide.modelSnapshot) return slide
      const next = migrateRecord(slide.modelSnapshot.nodes)
      return next === slide.modelSnapshot.nodes ? slide : { ...slide, modelSnapshot: { ...slide.modelSnapshot, nodes: next } }
    })
    return slides.some((s, i) => s !== p.slides[i]) ? { ...p, slides } : p
  })
  const hubTemplates = data.hubTemplates && Object.fromEntries(Object.entries(data.hubTemplates).map(([id, record]) => {
    const originals = Object.fromEntries(Object.entries(record.originalNodes).map(([nid, n]) => [nid, migrateCheckFields(n)]))
    return [id, Object.entries(originals).some(([nid, n]) => n !== record.originalNodes[nid]) ? { ...record, originalNodes: originals } : record]
  }))
  const changed = nodes !== data.nodes || metamodel !== data.metamodel
    || snapshots?.some((s, i) => s !== data.snapshots![i]) || presentations?.some((p, i) => p !== data.presentations![i])
    || (hubTemplates && Object.entries(hubTemplates).some(([id, r]) => r !== data.hubTemplates![id]))
  if (!changed) return data
  return {
    ...data, nodes,
    ...(metamodel ? { metamodel } : {}),
    ...(snapshots ? { snapshots } : {}),
    ...(presentations ? { presentations } : {}),
    ...(hubTemplates ? { hubTemplates } : {}),
  }
}
