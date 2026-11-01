// ─── A federation of models ──────────────────────────────────────────────────
//
// Each repository keeps the model of what it implements, and names in
// deps.json the models it depends on. `radical federation open` composes one
// model folder from it under .radical/federation/: the repository's own
// elements and relations as they are, and every dependency's marked with its
// origin ("orders@abc1234"), which makes them read-only in Studio and the MCP
// server (model.ts, originOf). `sync` splits the composed folder again: what
// has no origin goes home, every change to what has one is refused and named.
// Fetching from git is the CLI's (node-files/gitDeps); this file is pure.

import type { C4Node, C4Relation, DiagramData } from './c4'
import { originOf } from './model'
import { modelFieldChanges, type FieldChange } from './modelChanges'

/** The file in a model folder that names its dependencies. */
export const DEPS_FILE = 'deps.json'
/** Where the composed folder lives, inside the model folder (git-ignored). */
export const FEDERATION_DIR = '.radical/federation'
/** What the composed folder was made from, inside it. */
export const FEDERATION_FILE = '.radical/federation.json'

export interface Dependency {
  /** The model's name, as its elements' origin names it. */
  name: string
  /** Its git repository: an address, or a path relative to the model folder. */
  repo: string
  /** The model folder in that repository. */
  path: string
  /** The branch, tag or commit it is pinned to. */
  ref: string
}

export interface Deps {
  /** This model's name. */
  name: string
  dependencies: Dependency[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/** The dependencies in a deps.json; throws with what is wrong in it. */
export function parseDeps(text: string): Deps {
  let raw: unknown
  try { raw = JSON.parse(text) } catch (error) { throw new Error(`${DEPS_FILE} does not parse: ${(error as Error).message}`) }
  if (!isRecord(raw)) throw new Error(`${DEPS_FILE} must hold an object with "name" and "dependencies".`)
  const { name, dependencies } = raw
  if (typeof name !== 'string' || !NAME.test(name)) throw new Error(`${DEPS_FILE}: "name" must be this model's name (letters, digits, ".", "_" or "-").`)
  if (!Array.isArray(dependencies)) throw new Error(`${DEPS_FILE}: "dependencies" must be a list.`)
  const seen = new Set([name])
  const deps = dependencies.map((entry, i): Dependency => {
    const where = `${DEPS_FILE}: dependency ${i + 1}`
    if (!isRecord(entry)) throw new Error(`${where} must be an object with name, repo, path and ref.`)
    const dep = { name: entry.name, repo: entry.repo, path: entry.path ?? '.', ref: entry.ref }
    if (typeof dep.name !== 'string' || !NAME.test(dep.name)) throw new Error(`${where}: "name" must be the model's name (letters, digits, ".", "_" or "-").`)
    if (seen.has(dep.name)) throw new Error(`${where}: the name "${dep.name}" is used twice.`)
    seen.add(dep.name)
    if (typeof dep.repo !== 'string' || !dep.repo.trim()) throw new Error(`${where} (${dep.name}): "repo" must be a git address or a path.`)
    if (typeof dep.path !== 'string' || dep.path.split('/').includes('..') || dep.path.startsWith('/')) {
      throw new Error(`${where} (${dep.name}): "path" must be the model folder in the repository, relative to its top.`)
    }
    if (typeof dep.ref !== 'string' || !dep.ref.trim() || dep.ref.startsWith('-')) throw new Error(`${where} (${dep.name}): "ref" must be a branch, tag or commit.`)
    return dep as Dependency
  })
  return { name, dependencies: deps }
}

/** A dependency as fetched: the commit its ref named, and its model then. */
export interface FetchedDependency extends Dependency {
  commit: string
  data: Pick<DiagramData, 'nodes' | 'relations'>
}

/** The origin of a dependency's elements: its name and short commit. */
export const originFor = (name: string, commit: string): string => `${name}@${commit.slice(0, 7)}`

export interface Federation {
  data: DiagramData
  /** What did not fit, for the reader: an id two models have, a type the
   *  metamodel lacks, relations to models not composed. */
  notes: string[]
}

/** The folder's own model with every dependency's elements and relations,
 *  each marked with its origin. The own model keeps its views, metamodel,
 *  milestones and layout; what it has wins over a dependency's. A
 *  dependency's relations to elements no composed model has (its own
 *  dependencies) are left out. */
export function composeFederation(own: DiagramData, deps: FetchedDependency[]): Federation {
  const notes: string[] = []
  const nodes = new Map<string, C4Node>(own.nodes.map((n) => [n.id, n]))
  const relations = new Map<string, C4Relation>(own.relations.map((r) => [r.id, r]))
  const ownerOf = new Map<string, string>(own.nodes.map((n) => [n.id, 'this model']))
  for (const dep of deps) {
    const origin = originFor(dep.name, dep.commit)
    for (const node of dep.data.nodes) {
      const owner = ownerOf.get(node.id)
      if (owner) { notes.push(`${dep.name}: element "${node.label}" (${node.id}) is left out: ${owner} has an element with its id.`); continue }
      ownerOf.set(node.id, dep.name)
      nodes.set(node.id, { ...node, origin })
    }
  }
  for (const dep of deps) {
    const origin = originFor(dep.name, dep.commit)
    let dangling = 0
    for (const rel of dep.data.relations) {
      if (relations.has(rel.id)) { notes.push(`${dep.name}: relation ${rel.id} is left out: another model has a relation with its id.`); continue }
      if (!nodes.has(rel.sourceId) || !nodes.has(rel.targetId)) { dangling++; continue }
      relations.set(rel.id, { ...rel, origin })
    }
    if (dangling) notes.push(`${dep.name}: ${dangling} relation${dangling === 1 ? '' : 's'} to elements of models not composed here ${dangling === 1 ? 'is' : 'are'} left out.`)
  }
  const types = own.metamodel?.nodeTypes
  if (types) {
    for (const dep of deps) {
      const missing = [...new Set(dep.data.nodes.filter((n) => !types[n.type] && ownerOf.get(n.id) === dep.name).map((n) => n.type))]
      if (missing.length) notes.push(`${dep.name} has elements of type ${missing.join(', ')}, which this model's metamodel does not have.`)
    }
  }
  return { data: { ...own, nodes: [...nodes.values()], relations: [...relations.values()] }, notes }
}

/** A change to another model's element or relation, kept out of this model. */
export interface RefusedChange {
  kind: 'element' | 'relation'
  id: string
  /** The element's label, or the relation's "source → target". */
  label: string
  origin: string
  change: 'changed' | 'removed' | 'added'
  /** Changed: the fields that differ, layout left out. */
  fields?: FieldChange[]
}

export interface FederationSplit {
  /** The folder's own model: everything without an origin. */
  own: DiagramData
  refused: RefusedChange[]
}

/** Splits an edited composed model (`workspace`) into the folder's own model
 *  and the changes to other models' elements and relations, which stay out:
 *  `composed` is the federation as it was composed, which says what was theirs. */
export function splitFederation(workspace: DiagramData, composed: DiagramData): FederationSplit {
  const refused: RefusedChange[] = []
  const theirs = <T extends { id: string; origin?: string }>(items: T[]) => new Map(items.filter((item) => originOf(item)).map((item) => [item.id, item]))
  const theirNodes = theirs(composed.nodes)
  const theirRelations = theirs(composed.relations)
  const labelOf = (id: string) => workspace.nodes.find((n) => n.id === id)?.label ?? theirNodes.get(id)?.label ?? id
  const relationLabel = (rel: C4Relation) => `${labelOf(rel.sourceId)} → ${labelOf(rel.targetId)}`

  const nodes = workspace.nodes.filter((node) => {
    const was = theirNodes.get(node.id)
    if (was) {
      const fields = modelFieldChanges(was, node)
      if (fields.length) refused.push({ kind: 'element', id: node.id, label: was.label, origin: was.origin!, change: 'changed', fields })
      return false
    }
    const origin = originOf(node)
    if (origin) { refused.push({ kind: 'element', id: node.id, label: node.label, origin, change: 'added' }); return false }
    return true
  })
  const relations = workspace.relations.filter((rel) => {
    const was = theirRelations.get(rel.id)
    if (was) {
      const fields = modelFieldChanges(was, rel)
      if (fields.length) refused.push({ kind: 'relation', id: rel.id, label: relationLabel(was), origin: was.origin!, change: 'changed', fields })
      return false
    }
    const origin = originOf(rel)
    if (origin) { refused.push({ kind: 'relation', id: rel.id, label: relationLabel(rel), origin, change: 'added' }); return false }
    return true
  })
  const kept = new Set([...workspace.nodes.map((n) => n.id), ...workspace.relations.map((r) => r.id)])
  for (const node of theirNodes.values()) if (!kept.has(node.id)) refused.push({ kind: 'element', id: node.id, label: node.label, origin: node.origin!, change: 'removed' })
  for (const rel of theirRelations.values()) if (!kept.has(rel.id)) refused.push({ kind: 'relation', id: rel.id, label: relationLabel(rel), origin: rel.origin!, change: 'removed' })
  return { own: { ...workspace, nodes, relations }, refused }
}

/** One line per refused change, for the terminal. */
export function formatRefused(refused: RefusedChange[]): string[] {
  return refused.map((r) => {
    const what = `${r.kind === 'element' ? 'element' : 'relation'} "${r.label}" of ${r.origin}`
    if (r.change === 'removed') return `Kept: the deletion of ${what}; delete it in that model's repository.`
    if (r.change === 'added') return `Left out: ${what}, which ${r.origin} does not have; only radical federation gives an origin.`
    return `Kept out: the change to ${what} (${(r.fields ?? []).map((f) => f.field).join(', ')}); change it in that model's repository.`
  })
}
