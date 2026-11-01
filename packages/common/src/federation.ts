// ─── A federation of models ──────────────────────────────────────────────────
//
// Each repository keeps the model of what it implements, and names in
// deps.json the models it depends on. `radical federation fetch` fetches
// them (theirs too) and writes their elements and relations, each marked
// with its origin ("orders@abc1234"), into the model folder's
// .radical/federation.json. Studio and the MCP server open the model folder
// itself, add those (withOtherModels) and never write them back (ownModel in
// model.ts, applied by the serializer); every change to them is refused
// (model.ts, originOf). Fetching from git is the CLI's (node-files/gitDeps);
// this file is pure.

import { normalizeViewFolder, type C4Node, type C4Relation, type DiagramData, type DiagramView, type ModelPin } from './c4'
import { originModel, originOf } from './model'

/** The file in a model folder that names its dependencies. */
export const DEPS_FILE = 'deps.json'
/** The other models' elements and relations as fetched, inside the model
 *  folder and out of git (FederationFile). */
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
  data: Pick<DiagramData, 'nodes' | 'relations' | 'views'>
  /** Its own deps.json at that commit, when it has one. */
  deps?: Deps
  /** Its model folder on disk, when its repository is a path: what a path
   *  in its own deps.json is relative to. */
  home?: string
  /** The model whose deps.json pinned it (absent: this model's own). */
  via?: string
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
 *  milestones and layout; what it has wins over a dependency's. The
 *  dependencies come in transitively (their own dependencies too), so a
 *  dependency's relations to another hold; one to an element no composed
 *  model has is left out. */
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

/** What `radical federation fetch` writes into the model folder, out of
 *  git: the other models' elements and relations, each with its origin, and
 *  what they were fetched from. Studio and the MCP server add them to the
 *  model they read (withOtherModels) and never write them back. */
export interface FederationFile {
  version: 2
  /** This model's name, from its deps.json. */
  name: string
  /** When they were fetched (ISO 8601). */
  fetchedAt: string
  /** Each model fetched, at the commit its pin named; `via` names the model
   *  whose deps.json pinned it, absent for this model's own. */
  dependencies: Array<Dependency & { commit: string; via?: string; dependsOn?: string[] }>
  /** What was left out: a pin farther away, an id two models have. */
  notes: string[]
  nodes: C4Node[]
  relations: C4Relation[]
  /** Their views, each with its origin and the folder it has there. */
  views?: DiagramView[]
  /** The versions of them the model's milestones keep (DiagramSnapshot
   *  .otherModels), by origin, where they are not the current ones. */
  atCommits?: Record<string, { nodes: C4Node[]; relations: C4Relation[] }>
}

export function serializeFederationFile(file: FederationFile): string {
  return JSON.stringify(file, null, 2) + '\n'
}

/** The file's content, or null when it is no federation file this version reads. */
export function parseFederationFile(text: string | null | undefined): FederationFile | null {
  if (!text) return null
  try {
    const raw = JSON.parse(text) as Partial<FederationFile>
    if (raw.version !== 2 || !Array.isArray(raw.nodes) || !Array.isArray(raw.relations) || !Array.isArray(raw.dependencies)) return null
    return { notes: [], name: '', fetchedAt: '', ...raw } as FederationFile
  } catch { return null }
}

/** The model read from its folder with the other models' elements and
 *  relations added, each with its origin. The model's own win where an id is
 *  both; a relation of theirs to an element none has is left out. An element
 *  of theirs is placed where the model's layout keeps it. */
export function withOtherModels<T extends DiagramData>(data: T, file: FederationFile | null): T {
  if (!file) return data
  // Even with nothing current, it holds what milestones need.
  if (!file.nodes.length && !file.relations.length && !file.views?.length) return { ...data, federation: file }
  const ownNodes = new Set(data.nodes.map((n) => n.id))
  const ownRelations = new Set(data.relations.map((r) => r.id))
  const nodes = file.nodes.filter((n) => !ownNodes.has(n.id) && originOf(n)).map((n) => {
    const at = data.defaultPositions?.[n.id]
    return at ? { ...n, x: at.x, y: at.y, ...(at.width ? { width: at.width } : {}), ...(at.height ? { height: at.height } : {}) } : n
  })
  const all = new Set([...ownNodes, ...nodes.map((n) => n.id)])
  const relations = file.relations.filter((r) => !ownRelations.has(r.id) && originOf(r) && all.has(r.sourceId) && all.has(r.targetId))
  // Their views, each in a folder named after its model (two models' views
  // of one name stay apart), showing that model's elements and those of the
  // models it depends on.
  const ownViews = new Set((data.views ?? []).map((v) => v.id))
  const dependsOn = new Map(file.dependencies.map((d) => [d.name, d.dependsOn ?? []]))
  const scopeOf = (name: string): string[] => {
    const scope = new Set<string>()
    const walk = (n: string) => { if (scope.has(n)) return; scope.add(n); for (const d of dependsOn.get(n) ?? []) walk(d) }
    walk(name)
    return [...scope]
  }
  const views = (file.views ?? []).filter((v) => !ownViews.has(v.id) && originOf(v)).map((v): DiagramView => {
    const model = originModel(v.origin!)
    return { ...v, folder: normalizeViewFolder(v.folder ? `${model}/${v.folder}` : model), originScope: scopeOf(model) }
  })
  return {
    ...data,
    nodes: [...data.nodes, ...nodes],
    relations: [...data.relations, ...relations],
    ...(views.length ? { views: [...(data.views ?? []), ...views] } : {}),
    federation: file,
  }
}

/** The other models' elements and relations a milestone shows: at the
 *  commits it keeps, from the current fetch or the versions fetched for
 *  milestones; as fetched now for one made before that keeps none. `missing`
 *  names the versions not fetched. */
export function otherModelsAt(file: FederationFile | null, pins: ModelPin[] | undefined): { nodes: C4Node[]; relations: C4Relation[]; missing: ModelPin[] } {
  if (!file) return { nodes: [], relations: [], missing: pins ?? [] }
  if (!pins) return { nodes: file.nodes, relations: file.relations, missing: [] }
  const nodes: C4Node[] = []
  const relations: C4Relation[] = []
  const missing: ModelPin[] = []
  for (const pin of pins) {
    const origin = originFor(pin.name, pin.commit)
    const current = file.dependencies.some((d) => d.name === pin.name && d.commit === pin.commit)
    const at = current ? { nodes: file.nodes.filter((n) => n.origin === origin), relations: file.relations.filter((r) => r.origin === origin) } : file.atCommits?.[origin]
    if (!at) { missing.push(pin); continue }
    nodes.push(...at.nodes)
    relations.push(...at.relations)
  }
  const ids = new Set(nodes.map((n) => n.id))
  return { nodes, relations: relations.filter((r) => ids.has(r.sourceId) && ids.has(r.targetId)), missing }
}

/** Another model's view as it is kept in .radical/federation.json: what it
 *  shows, its filter, places and settings, without what this model cannot
 *  have of it (its sequence, its exploration). */
export function otherModelView(view: DiagramView, origin: string): DiagramView | null {
  if (view.kind === 'explore') return null
  const { sequenceId: _sequence, explore: _explore, partOf: _partOf, ...kept } = view
  return { ...kept, origin }
}

/** The dependencies with their commits, for a line of output. */
export const describeFetched = (deps: FederationFile['dependencies']): string =>
  deps.map((d) => `${originFor(d.name, d.commit)}${d.ref === d.commit ? '' : ` (${d.ref})`}${d.via ? ` via ${d.via}` : ''}`).join(', ')
