import { mkdir, readdir, realpath, stat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { buildToolDefs, runTool, type ToolDef, type ToolRunContext } from '@radical/common/ai/tools'
import { createModelFacade } from '@radical/common/ai/modelFacade'
import { buildMetamodelMessage } from '@radical/common/ai/metamodelContext'
import { deserializeFromMdFolder, isMdFolder, isOwnedMdFolderFile, serializeToMdFolder, serializeToMdFolderWithPaths, type FolderFiles } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { builtInC4Metamodel, builtInDddC4Metamodel, builtInGovernanceMetamodel, validateModel, type Metamodel } from '@radical/common/metamodel'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { fitAncestors, placeNewNode } from '@radical/layout/geometry'
import { runSmartLayoutCore } from '@radical/layout/smartLayout'
import { viewLayoutInput, applyAlignments, applyLayoutPositions, resizeParentsBottomUp } from '@radical/layout/viewInput'
import type { C4Node, DiagramData, NodePosition } from '@radical/common/c4'
import { documentMetamodel } from '@radical/common/model'
import { FORGE_READ_ONLY, FORGE_TOOL_DEFS, FORGE_TOOLS, Forge, type ForgeResult } from './forge'

/** The shared AI catalogue minus its Studio-only tools: set_active_view and
 *  focus_node drive the canvas, and reset_diagram is too destructive for an
 *  external client. */
const EXCLUDED_TOOLS = new Set(['set_active_view', 'focus_node', 'reset_diagram'])
const READ_ONLY = new Set(['get_model_summary', 'search_model'])
const JSON_FILES = ['_layout.json', 'relations.json', 'views.json', 'sequences.json', 'snapshots.json', 'presentations.json', 'metamodel.json', 'hubTemplates.json']

const SERVER_TOOL_DEFS: ToolDef[] = [
  {
    name: 'get_model_summary',
    description: "Call this first. Shows counts, the views, sequences and presentations in the bound Radical model folder, plus the metamodel context message: each type's valid properties keys and enum options, allowed parents, cardinality and relation allowedPairs.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
]

/** Read-only tools, for MCP annotations. */
export const READ_ONLY_TOOLS = new Set([...READ_ONLY, ...FORGE_READ_ONLY])

const buildTools = (metamodel: Metamodel | undefined): ToolDef[] => [
  ...SERVER_TOOL_DEFS,
  ...buildToolDefs(metamodel).filter((tool) => !EXCLUDED_TOOLS.has(tool.name)),
  ...FORGE_TOOL_DEFS,
]

/** Per call: progress for a client that asked for it, and the client's cancel. */
export interface CallOptions {
  onProgress?: (progress: { progress: number; message: string }) => void
  signal?: AbortSignal
}

const CANCELLED = 'The client cancelled the call; nothing was written.'

export interface CallOutcome {
  ok: boolean
  text: string
  /** The metamodel changed and `tools` were rebuilt; re-advertise their schemas. */
  toolsChanged?: boolean
}

/** Metamodels a new folder can start with (`--metamodel`). */
export const PRESETS = {
  c4: builtInC4Metamodel,
  'c4-ddd': builtInDddC4Metamodel,
  governance: builtInGovernanceMetamodel,
} as const
export type PresetName = keyof typeof PRESETS

export interface OpenOptions {
  /** Metamodel for a folder that holds no model yet; Governance by default, as in Studio. */
  metamodel?: PresetName
}

function checkFiles(files: FolderFiles): void {
  if (!isMdFolder(files)
    || !/^radicalFormat:\s*["']?md-folder["']?\s*$/m.test(files['radical.md'])
    || !/^version:\s*1\s*$/m.test(files['radical.md'])) {
    throw new Error('Folder is missing a valid radical.md Markdown-folder manifest. Point --folder at an empty or new folder to start a model there.')
  }
  for (const path of JSON_FILES) {
    if (!(path in files)) continue
    try { JSON.parse(files[path]) }
    catch { throw new Error(`Malformed JSON in ${path}`) }
  }
}

function checkData(data: DiagramData): void {
  if (!Array.isArray(data.nodes) || !Array.isArray(data.relations) || (data.views && !Array.isArray(data.views))) {
    throw new Error('Malformed model: nodes, relations and views must be arrays')
  }
  for (const [kind, items] of [['node', data.nodes], ['relation', data.relations]] as const) {
    const ids = new Set<string>()
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) {
        throw new Error(`Malformed model: missing or duplicate ${kind} ID`)
      }
      ids.add(item.id)
    }
  }
  for (const node of data.nodes) {
    if (!node.type || !node.label || ![node.x, node.y, node.width, node.height].every(Number.isFinite)) {
      throw new Error(`Malformed node ${node.id}: invalid type, label or geometry`)
    }
  }
}

const byId = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]))

const depth = (node: C4Node, nodes: Record<string, C4Node>): number => {
  let d = 0
  for (let cur = node.parentId ? nodes[node.parentId] : undefined; cur && d < 64; cur = cur.parentId ? nodes[cur.parentId] : undefined) d++
  return d
}

/** Refits every parent whose children a change added, moved or removed, and
 *  keeps defaultPositions in step with node geometry: Studio restores them
 *  when you switch back to All elements, so stale entries would undo the
 *  change. Mutates `after`. */
function settleGeometry(before: DiagramData, after: DiagramData): void {
  const old = byId(before.nodes)
  const nodes = byId(after.nodes)
  const parents = new Set<string>()
  const touch = (id: string | undefined): void => { if (id && nodes[id]) parents.add(id) }
  for (const node of after.nodes) {
    const prev = old[node.id]
    if (!prev) touch(node.parentId)
    else if (prev.parentId !== node.parentId) { touch(prev.parentId); touch(node.parentId) }
  }
  for (const node of before.nodes) if (!nodes[node.id]) touch(node.parentId)
  for (const id of [...parents].sort((a, b) => depth(nodes[b], nodes) - depth(nodes[a], nodes))) fitAncestors(nodes, id)

  if (!after.defaultPositions) return
  for (const node of after.nodes) {
    const prev = old[node.id]
    if (prev && prev.x === node.x && prev.y === node.y && prev.width === node.width && prev.height === node.height) continue
    after.defaultPositions[node.id] = { x: node.x, y: node.y, width: node.width, height: node.height }
  }
}

export class FolderModel {
  private readonly tempIds = new Map<string, string>()
  private readonly forge = new Forge()
  private readonly folder: string
  private metamodelKey: string
  /** Every tool the server offers; node/relation schemas follow the metamodel. */
  tools: ToolDef[]
  private tail: Promise<unknown> = Promise.resolve()

  private constructor(folder: string, metamodel: Metamodel | undefined) {
    this.folder = folder
    this.tools = buildTools(metamodel)
    this.metamodelKey = JSON.stringify(metamodel)
  }

  /** Rebuilds the tool schemas when `metamodel` differs from the one they
   *  were built for. True when they changed. */
  private refreshTools(metamodel: Metamodel | undefined): boolean {
    const key = JSON.stringify(metamodel)
    if (key === this.metamodelKey) return false
    this.metamodelKey = key
    this.tools = buildTools(metamodel)
    return true
  }

  /** Opens the model in `folder` (relative to the working directory, created
   *  when missing). An empty folder becomes a new model, written as Studio's
   *  Save as folder writes one. */
  static async open(folder: string, options: OpenOptions = {}): Promise<FolderModel> {
    if (!folder) throw new Error('--folder is required')
    const path = resolve(folder)
    await mkdir(path, { recursive: true })
    const canonical = await realpath(path)
    if (!(await stat(canonical)).isDirectory()) throw new Error(`Not a directory: ${folder}`)
    const session = new MdFolderSession(diskFolderStorage(canonical))
    let files = await session.readAll()
    // Dot entries (.git, .DS_Store) don't count: a fresh repo folder is still empty.
    if ((await readdir(canonical)).every((name) => name.startsWith('.'))) {
      const metamodel = PRESETS[options.metamodel ?? 'governance']()
      const created = await session.write(serializeToMdFolder({ nodes: [], relations: [], metamodel }, basename(canonical)))
      if (!created.ok) throw new Error(`Could not start a model in ${canonical}: it changed while being written`)
      files = await session.readAll()
    }
    checkFiles(files)
    const data = deserializeFromMdFolder(files).data
    checkData(data)
    return new FolderModel(canonical, createModelFacade(data).getMetamodel?.())
  }

  /** Resolves once every queued call has finished. */
  idle(): Promise<void> {
    return this.tail.then(() => undefined)
  }

  call(name: string, input: unknown, options: CallOptions = {}): Promise<CallOutcome> {
    const run = this.tail.then(() => this.run(name, input, options))
    this.tail = run.catch(() => {})
    return run
  }

  private async run(name: string, input: unknown, options: CallOptions): Promise<CallOutcome> {
    if (!this.tools.some((tool) => tool.name === name)) return { ok: false, text: `Unknown tool ${name}` }
    if (options.signal?.aborted) return { ok: false, text: CANCELLED }
    try {
      const session = new MdFolderSession(diskFolderStorage(this.folder))
      const before = await session.readAll()
      checkFiles(before)
      const data = deserializeFromMdFolder(before).data
      checkData(data)
      const facade = createModelFacade(data, {
        runLayout: async (doc, viewId) => {
          const layout = await this.smartLayout(doc, documentMetamodel(doc.metamodel), viewId, options)
          return { ok: layout.ok, text: layout.text, data: layout.changed }
        },
      })
      // Someone (Studio, another client) changed the metamodel: re-advertise
      // the schemas, and still run this call — every handler validates input.
      const toolsChanged = this.refreshTools(facade.getMetamodel?.())
      const outcome = await this.dispatch(name, input, session, before, data, facade)
      return toolsChanged || outcome.toolsChanged ? { ...outcome, toolsChanged: true } : outcome
    } catch (error) {
      return { ok: false, text: (error as Error).message }
    }
  }

  private async dispatch(
    name: string, input: unknown, session: MdFolderSession, before: FolderFiles,
    data: DiagramData, facade: ReturnType<typeof createModelFacade>,
  ): Promise<CallOutcome> {
    let priorTempIds: Map<string, string> | undefined
    try {
      if (name === 'get_model_summary') {
        const metamodel = facade.getMetamodel?.()
        const summary = JSON.stringify({
          folder: this.folder,
          nodes: data.nodes.length,
          relations: data.relations.length,
          views: (data.views ?? []).map((view) => ({
            id: view.id, name: view.name, kind: view.kind ?? 'static',
            ...(view.sequenceId ? { sequenceId: view.sequenceId } : {}),
            ...(view.layoutConstraints?.length ? { alignments: view.layoutConstraints } : {}),
          })),
          ...(data.defaultLayoutConstraints?.length ? { allElementsAlignments: data.defaultLayoutConstraints } : {}),
          sequences: (data.sequences ?? []).map((sequence) => ({ id: sequence.id, name: sequence.name, steps: sequence.relationIds.length })),
          presentations: (data.presentations ?? []).map((presentation) => ({
            id: presentation.id,
            name: presentation.name,
            slides: presentation.slides.map((slide) => ({ id: slide.id, name: slide.name, viewId: slide.viewId ?? null })),
          })),
          metamodel: { id: metamodel?.id, name: metamodel?.name },
          nodeTypes: Object.keys(metamodel?.nodeTypes ?? {}),
          relationTypes: Object.keys(metamodel?.relationTypes ?? {}),
        })
        // The other tools' descriptions point at "the metamodel context
        // message" for property keys and pairing rules; MCP clients get it here.
        return { ok: true, text: `${summary}\n\n${buildMetamodelMessage(metamodel)}` }
      }
      priorTempIds = new Map(this.tempIds)
      const ctx: ToolRunContext = {
        diagram: facade,
        resolveId: (id) => this.tempIds.get(id) ?? id,
        registerTempId: (tempId, realId) => { this.tempIds.set(tempId, realId) },
        resetTempIds: () => this.tempIds.clear(),
        placeNext: (parentId) => placeNewNode(facade.getNodes(), parentId),
      }
      const result: ForgeResult = FORGE_TOOLS.has(name)
        ? await this.forge.call(name, input, ctx, facade)
        : await runTool(name, input, ctx)
      if (!result.ok || facade.lastError) {
        this.restoreTempIds(priorTempIds)
        return { ok: false, text: facade.lastError ?? result.resultText }
      }
      if (READ_ONLY.has(name) || result.readOnly) {
        result.commit?.()
        return { ok: true, text: result.resultText }
      }

      const changed = result.data ?? facade.toDiagramData()
      settleGeometry(data, changed)
      const metamodel = facade.getMetamodel?.()
      const outcome = await this.commit(session, before, data, changed, metamodel, result.resultText)
      if (!outcome.ok) {
        this.restoreTempIds(priorTempIds)
        return outcome
      }
      result.commit?.()
      // A metamodel tool changed the types: re-advertise the schemas.
      if (this.refreshTools(metamodel)) return { ...outcome, toolsChanged: true }
      return outcome
    } catch (error) {
      if (priorTempIds) this.restoreTempIds(priorTempIds)
      return { ok: false, text: (error as Error).message }
    }
  }

  /** Runs Smart Layout the way Studio does for one view (undefined = All
   *  elements) and returns the laid-out model, or no model when nothing
   *  changes. A view's result goes to its own saved positions, like the
   *  positions Studio keeps per view. */
  private async smartLayout(
    data: DiagramData, metamodel: Metamodel | undefined, viewId: string | undefined, options: CallOptions = {},
  ): Promise<{ ok: boolean; text: string; changed?: DiagramData }> {
    const changed = JSON.parse(JSON.stringify(data)) as DiagramData
    const view = viewId === undefined ? undefined : changed.views?.find((v) => v.id === viewId)
    if (viewId !== undefined && !view) return { ok: false, text: `smart_layout: unknown view id "${viewId}"` }
    if (view?.kind && view.kind !== 'static' && view.kind !== 'dynamic') {
      return { ok: false, text: `smart_layout: "${view.name}" is a ${view.kind} view; only static and dynamic views have a canvas layout.` }
    }
    // The canvas the view shows: its saved positions over the model's.
    const nodes = byId(view ? (JSON.parse(JSON.stringify(changed.nodes)) as C4Node[]) : changed.nodes)
    for (const [id, pos] of Object.entries(view?.positions ?? {})) {
      const node = nodes[id]
      if (node) Object.assign(node, { x: pos.x, y: pos.y, width: pos.width, height: pos.height })
    }
    const constraints = view ? view.layoutConstraints : changed.defaultLayoutConstraints
    const input = viewLayoutInput(view, nodes, byId(changed.relations), constraints)
    if (!Object.keys(input.nodes).length) return { ok: true, text: 'Smart Layout: there are no nodes to lay out.' }
    // Large models take minutes: report each step, and stop at the next one
    // once the client has cancelled (or gone away) rather than finish unseen.
    let step = 0
    const result = await runSmartLayoutCore(input.nodes, input.relations, metamodel, (p) => {
      if (options.signal?.aborted) throw new Error(CANCELLED)
      const count = 'done' in p ? ` ${p.done}/${p.total}` : ''
      options.onProgress?.({ progress: ++step, message: `Smart Layout: ${p.phase}${count}` })
    }, { alignments: input.alignments })
    if (options.signal?.aborted) return { ok: false, text: CANCELLED }
    if (!result.candidates.length) return { ok: false, text: 'Smart Layout: no candidate produced a result.' }
    if (result.keptCurrent) return { ok: true, text: 'Smart Layout: the current layout already scores best; nothing changed.' }
    applyLayoutPositions(nodes, result.winner.positions, input)
    resizeParentsBottomUp(nodes, input)
    // The refit knows nothing of the alignments; put them back.
    applyAlignments(nodes, viewLayoutInput(view, nodes, byId(changed.relations), constraints))
    // All elements writes the nodes themselves (settleGeometry then syncs
    // defaultPositions); a view keeps its own positions.
    if (view) {
      view.positions = Object.fromEntries(Object.values(nodes).map((node): [string, NodePosition] =>
        [node.id, { x: node.x, y: node.y, width: node.width, height: node.height }]))
    }
    const before = result.baseline
    const after = result.winner.metrics
    return {
      ok: true,
      changed,
      text: `Smart Layout${view ? ` (${view.name})` : ''}: ${result.winner.name}; crossings ${before.crossings} -> ${after.crossings}, overdraws ${before.overdraws} -> ${after.overdraws}.`,
    }
  }

  /** Validates `changed` against the metamodel and writes the files that
   *  differ from `before`, unless the folder changed in the meantime. */
  private async commit(
    session: MdFolderSession, before: FolderFiles, data: DiagramData, changed: DiagramData,
    metamodel: Metamodel | undefined, resultText: string,
  ): Promise<CallOutcome> {
    checkData(changed)
    if (!metamodel) throw new Error('Model has no metamodel')
    const previousErrors = new Set(validateModel(
      Object.fromEntries(data.nodes.map((node) => [node.id, node])),
      Object.fromEntries(data.relations.map((relation) => [relation.id, relation])),
      metamodel,
    ).filter((issue) => issue.severity === 'error').map((issue) => issue.id))
    const newError = validateModel(
      Object.fromEntries(changed.nodes.map((node) => [node.id, node])),
      Object.fromEntries(changed.relations.map((relation) => [relation.id, relation])),
      metamodel,
    ).find((issue) => issue.severity === 'error' && !previousErrors.has(issue.id))
    if (newError) return { ok: false, text: newError.message }
    const next = serializeToMdFolderWithPaths(changed).files
    // Preserve the user's manifest prose/name. The format codec only needs
    // to rewrite model-owned sidecars and node Markdown.
    next['radical.md'] = before['radical.md']
    const paths = [...new Set([...Object.keys(before), ...Object.keys(next)])]
      .filter((path) => before[path] !== next[path]
        && (path in next || isOwnedMdFolderFile(path, before[path])))
      .sort()
    if (!paths.length) return { ok: true, text: `${resultText} No files changed.` }
    const write = await session.write(next)
    if (!write.ok) return { ok: false, text: `Folder changed before write; no files written. Conflicts: ${write.conflict.join(', ')}` }
    const revision = createHash('sha256').update(paths.map((path) => `${path}\0${next[path] ?? ''}`).join('\0')).digest('hex').slice(0, 12)
    const createdRelation = changed.relations.find((relation) => !data.relations.some((old) => old.id === relation.id))?.id
    return { ok: true, text: `${resultText}${createdRelation ? ` Relation ID: ${createdRelation}.` : ''} Changed: ${paths.join(', ')}. Revision: ${revision}.` }
  }

  private restoreTempIds(previous: Map<string, string>): void {
    this.tempIds.clear()
    for (const [temp, real] of previous) this.tempIds.set(temp, real)
  }
}
