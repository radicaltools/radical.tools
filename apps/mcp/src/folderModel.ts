import { mkdir, readdir, realpath, stat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { buildToolDefs, runTool, type ToolDef, type ToolRunContext } from '@radical/common/ai/tools'
import { createModelFacade } from '@radical/common/ai/modelFacade'
import { buildMetamodelMessage } from '@radical/common/ai/metamodelContext'
import { AI_MODELLING_RULES } from '@radical/common/ai/systemPrompt'
import { MD_FOLDER_JSON_FILES, deserializeFromMdFolder, isOwnedMdFolderFile, isValidMdFolderManifest, serializeToMdFolder, serializeToMdFolderWithPaths, type FolderFiles } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { builtInC4Metamodel, builtInGovernanceMetamodel, validateModel, type Issue, type Metamodel } from '@radical/common/metamodel'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import { modelChangesSince } from '@radical/node-files/gitModel'
import { readEditorStateFile, readSelectionFile, writeEditorStateFile, writeForgeRunFile } from '@radical/node-files/selectionFile'
import { MODEL_BASE_FILE, forgeModelBase, mayReplaceWithForgeBase } from '@radical/common/formats/modelBase'
import { serializeForgeRun } from '@radical/common/formats/forgeRunStatus'
import { runModelQuery } from '@radical/common/ai/queryLanguage'
import { fitAncestors, placeNewNode } from '@radical/layout/geometry'
import { runSmartLayoutCore } from '@radical/layout/smartLayout'
import { viewLayoutInput, applyAlignments, applyLayoutPositions, fitAndSeparateBottomUp, resizeParentsBottomUp } from '@radical/layout/viewInput'
import { applyTreeLayout } from '@radical/layout/elkLayout'
import { pinnedNodeIds, viewCanvasPositions, withCanvasPositions, type C4Node, type DiagramData, type LayoutConstraint, type NodePosition } from '@radical/common/c4'
import { documentMetamodel } from '@radical/common/model'
import { FORGE_READ_ONLY, FORGE_TOOL_DEFS, FORGE_TOOLS, Forge, type ForgeResult } from './forge'

/** The shared AI catalogue minus its Studio-only tools: set_active_view and
 *  focus_node drive the canvas, and reset_diagram is too destructive for an
 *  external client. */
const EXCLUDED_TOOLS = new Set(['set_active_view', 'focus_node', 'reset_diagram'])
const READ_ONLY = new Set(['get_model_summary', 'get_selection', 'get_issues', 'get_changes', 'search_model', 'list_milestones', 'compare_milestones'])

const SERVER_TOOL_DEFS: ToolDef[] = [
  {
    name: 'get_model_summary',
    description: "Call this first. Shows counts, the views, sequences, milestones and presentations in the bound Radical model folder, the modelling rules (how to build requirements, needs, state machines, …), plus the metamodel context message: each type's valid properties keys and enum options, allowed parents, cardinality and relation allowedPairs.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_issues',
    description: 'What breaks the rules in the model now, as the Validation list in Studio\'s metamodel editor shows it: errors (wrong parent, relation the metamodel does not allow, unknown type) and warnings (missing required properties, references to no node, and state machine rules: a machine or compound state without one initial pseudostate, a parallel state with fewer than two regions, a final state with outgoing transitions, unreachable states, unguarded transitions competing for one event). Call it after building or changing a state machine, and before you report work as done.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_selection',
    description: 'What the user has selected on Studio\'s canvas for this model folder: the view on screen and each selected node in full (properties, parents, children, relations, views) plus selected relations. Call it whenever the user refers to "the selected", "this", "zaznaczony" element, mockup or view instead of naming it. updatedAt tells how fresh it is; an empty selection means nothing is selected or Studio left the model.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_changes',
    description: 'What changed in the model since its version in git: the elements and relations added, removed and changed, uncommitted edits included, each changed field with its old and new value, and each element with its place in the model and its relations (the component that satisfies a requirement, the ADRs that constrain it, the scenarios and the tests they name). Only the model is compared; views, positions, sizes and folding are left out. Call it when you are asked to implement what was changed in the model, and again before you report the work as done. It writes no model file; without since it saves the base to .radical/base.json, for Studio to show the same changes.',
    inputSchema: {
      type: 'object',
      properties: {
        since: { type: 'string', description: 'The git branch, tag or commit to compare with, e.g. "HEAD" for the last commit. Default: where the current branch left the default branch (the merge base with origin/main), so every model change on the branch counts.' },
      },
      additionalProperties: false,
    },
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
  radical: builtInGovernanceMetamodel,
  c4: builtInC4Metamodel,
} as const
export type PresetName = keyof typeof PRESETS

export interface OpenOptions {
  /** Metamodel for a folder that holds no model yet; Radical by default, as in Studio. */
  metamodel?: PresetName
}

function checkFiles(files: FolderFiles): void {
  if (!isValidMdFolderManifest(files['radical.md'])) {
    throw new Error('Folder is missing a valid radical.md Markdown-folder manifest. Point --folder at an empty or new folder to start a model there.')
  }
  for (const path of MD_FOLDER_JSON_FILES) {
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

/** Creates `path` when missing and, when it holds nothing but dot entries
 *  (.git, .DS_Store, Studio's .radical), writes a new model with the
 *  `preset` metamodel into it. */
async function startIfEmpty(path: string, preset: PresetName): Promise<void> {
  await mkdir(path, { recursive: true })
  if (!(await readdir(path)).every((name) => name.startsWith('.'))) return
  const session = new MdFolderSession(diskFolderStorage(path))
  const created = await session.write(serializeToMdFolder({ nodes: [], relations: [], metamodel: PRESETS[preset]() }, basename(path)))
  if (!created.ok) throw new Error(`Could not start a model in ${path}: it changed while being written`)
}

const byId = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((item) => [item.id, item]))

/** At most this many new warnings go into a write's result. */
const MAX_WARNINGS = 8

const issuesOf = (data: DiagramData, metamodel: Metamodel): Issue[] =>
  validateModel(byId(data.nodes), byId(data.relations), metamodel)

const formatIssue = (issue: Issue): string =>
  `${issue.severity}: ${issue.message}${issue.nodeId ? ` (node ${issue.nodeId})` : issue.relationId ? ` (relation ${issue.relationId})` : ''}`

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

  private constructor(folder: string, private readonly preset: PresetName, metamodel: Metamodel | undefined) {
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
    const preset = options.metamodel ?? 'radical'
    await startIfEmpty(path, preset)
    const canonical = await realpath(path)
    if (!(await stat(canonical)).isDirectory()) throw new Error(`Not a directory: ${folder}`)
    const files = await new MdFolderSession(diskFolderStorage(canonical)).readAll()
    checkFiles(files)
    const data = deserializeFromMdFolder(files).data
    checkData(data)
    return new FolderModel(canonical, preset, createModelFacade(data).getMetamodel?.())
  }

  /** The MCP client's name (claude-code, …), for the Forge run status. */
  clientName: () => string | undefined = () => undefined

  /** Writes where the agent's Forge run stands for Studio to show. A failed
   *  write never fails the call: the status is a convenience. */
  private async writeForgeStatus(closing = false): Promise<void> {
    const status = this.forge.status(closing)
    if (!status) return
    try {
      await writeForgeRunFile(this.folder, serializeForgeRun({ ...status, ...(this.clientName() ? { client: this.clientName() } : {}) }))
    } catch {
      // Read-only folder or a symlinked .radical: Studio just shows nothing.
    }
  }

  /** Saves `content` (the model before a Forge run) as the folder's base
   *  unless git saved one; a line for the answer when it did. A failed write
   *  never fails the call. */
  private async saveForgeBase(content: string): Promise<string> {
    try {
      if (!mayReplaceWithForgeBase(await readEditorStateFile(this.folder, MODEL_BASE_FILE))) return ''
      await writeEditorStateFile(this.folder, MODEL_BASE_FILE, content)
      return '\n\nSaved the model as it was before this run to .radical/base.json (no base from git): Studio\'s Changes on branch shows what the run changes.'
    } catch {
      return ''
    }
  }

  /** The server is shutting down: an unfinished run shows as paused in
   *  Studio right away instead of after FORGE_RUN_STALE_MS. */
  async close(): Promise<void> {
    await this.idle()
    const status = this.forge.status()
    if (status?.state === 'active') await this.writeForgeStatus(true)
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
      // The folder was emptied (or deleted) while the server ran, e.g. to try
      // again from scratch: start over there, as on startup.
      await startIfEmpty(this.folder, this.preset)
      const session = new MdFolderSession(diskFolderStorage(this.folder))
      const before = await session.readAll()
      checkFiles(before)
      const data = deserializeFromMdFolder(before).data
      checkData(data)
      // Older folders kept every node's position in each view; a view keeps
      // those it draws, so the first write trims views.json.
      if (data.views) data.views = withCanvasPositions(data.views, Object.fromEntries(data.nodes.map((n) => [n.id, n])))
      const facade = createModelFacade(data, {
        runLayout: async (doc, viewId) => {
          const layout = await this.smartLayout(doc, documentMetamodel(doc.metamodel, doc.nodes), viewId, options)
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

  /** The canvas selection Studio wrote into the folder, resolved against
   *  the model as it is now. */
  private async selection(facade: ReturnType<typeof createModelFacade>): Promise<string> {
    const selection = await readSelectionFile(this.folder)
    if (!selection) {
      return 'No selection: Studio has not had this folder open with a selection yet. Open the same folder in Studio and select something, or ask the user which element they mean.'
    }
    const query = {
      nodes: facade.getNodes(),
      relations: facade.getRelations(),
      views: facade.getViews?.(),
      sequences: facade.getSequences?.(),
    }
    const view = selection.viewId ? query.views?.[selection.viewId] : undefined
    const missing = [...selection.nodeIds, ...selection.relationIds].filter((id) => !query.nodes[id] && !query.relations[id])
    const result = {
      updatedAt: selection.updatedAt,
      secondsAgo: Math.max(0, Math.round((Date.now() - Date.parse(selection.updatedAt)) / 1000)),
      view: view ? { id: view.id, name: view.name, kind: view.kind ?? 'static' } : { id: null, name: 'All elements' },
      nodes: selection.nodeIds.filter((id) => query.nodes[id]).map((id) => runModelQuery(`GET NODE "${id}"`, query).result),
      relations: selection.relationIds.map((id) => query.relations[id]).filter(Boolean)
        .map(({ id, relationType, label, sourceId, targetId, technology }) => ({
          id, relationType: relationType ?? null, label: label ?? null, technology: technology ?? null,
          source: { id: sourceId, label: query.nodes[sourceId]?.label },
          target: { id: targetId, label: query.nodes[targetId]?.label },
        })),
      ...(missing.length ? { missing } : {}),
    }
    const empty = result.nodes.length === 0 && result.relations.length === 0
    return empty ? `Nothing is selected in Studio. ${JSON.stringify(result)}` : JSON.stringify(result)
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
            ...(view.folder ? { folder: view.folder } : {}),
            ...(view.edgeStyle ? { edgeStyle: view.edgeStyle } : {}),
            ...(view.sequenceId ? { sequenceId: view.sequenceId } : {}),
            ...(view.layoutConstraints?.length ? { alignments: view.layoutConstraints } : {}),
          })),
          ...(data.defaultLayoutConstraints?.length ? { allElementsAlignments: data.defaultLayoutConstraints } : {}),
          sequences: (data.sequences ?? []).map((sequence) => ({ id: sequence.id, name: sequence.name, steps: sequence.relationIds.length })),
          presentations: (data.presentations ?? []).map((presentation) => ({
            id: presentation.id,
            name: presentation.name,
            slides: presentation.slides.map((slide) => ({
              id: slide.id, name: slide.name, viewId: slide.viewId ?? null,
              ...(slide.snapshotId ? { milestone: slide.snapshotId } : {}),
              ...(slide.focusNodeIds?.length ? { focus: slide.focusNodeIds } : {}),
            })),
          })),
          milestones: (data.snapshots ?? []).map((milestone) => ({ id: milestone.id, name: milestone.name })),
          metamodel: { id: metamodel?.id, name: metamodel?.name },
          nodeTypes: Object.keys(metamodel?.nodeTypes ?? {}),
          relationTypes: Object.keys(metamodel?.relationTypes ?? {}),
        })
        // The other tools' descriptions point at "the metamodel context
        // message" for property keys and pairing rules; MCP clients get it here,
        // with the modelling rules Studio's chat and Forge follow.
        const rules = `Modelling rules:\n${AI_MODELLING_RULES.map((rule) => `- ${rule}`).join('\n')}`
        return { ok: true, text: `${summary}\n\n${rules}\n\n${buildMetamodelMessage(metamodel)}` }
      }
      if (name === 'get_issues') {
        const mm = facade.getMetamodel?.()
        const issues = mm ? issuesOf(data, mm) : []
        return { ok: true, text: issues.length ? issues.map(formatIssue).join('\n') : 'No issues: the model follows its metamodel.' }
      }
      if (name === 'get_selection') return { ok: true, text: await this.selection(facade) }
      if (name === 'get_changes') {
        const { since } = (input ?? {}) as { since?: unknown }
        if (since !== undefined && typeof since !== 'string') return { ok: false, text: 'get_changes: since must be a git branch, tag or commit' }
        // The default base is the one Studio shows: keep its copy fresh.
        return { ok: true, text: (await modelChangesSince(this.folder, data, since, { saveBase: since === undefined })).text }
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
      // A run starting on a folder git saved no base for: the model before it.
      const forgeBase = name === 'forge_start' ? forgeModelBase(data.nodes, data.relations) : null
      if (READ_ONLY.has(name) || result.readOnly) {
        result.commit?.()
        if (FORGE_TOOLS.has(name)) await this.writeForgeStatus()
        return { ok: true, text: result.resultText + (forgeBase ? await this.saveForgeBase(forgeBase) : '') }
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
      if (FORGE_TOOLS.has(name)) await this.writeForgeStatus()
      if (forgeBase) outcome.text += await this.saveForgeBase(forgeBase)
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
    // A view set to "Hierarchical nested tree" is laid out as a tree, as
    // Studio's layout button does on it.
    if (view?.layoutMode === 'tree') return this.treeLayout(changed, nodes, view, input, constraints)
    let step = 0
    const result = await runSmartLayoutCore(input.nodes, input.relations, metamodel, (p) => {
      if (options.signal?.aborted) throw new Error(CANCELLED)
      const count = 'done' in p ? ` ${p.done}/${p.total}` : ''
      options.onProgress?.({ progress: ++step, message: `Smart Layout: ${p.phase}${count}` })
    }, { alignments: input.alignments, edgeStyle: view?.edgeStyle ?? changed.defaultEdgeStyle ?? 'curved' })
    if (options.signal?.aborted) return { ok: false, text: CANCELLED }
    if (!result.candidates.length) return { ok: false, text: 'Smart Layout: no candidate produced a result.' }
    if (result.keptCurrent) return { ok: true, text: 'Smart Layout: the current layout already scores best; nothing changed.' }
    applyLayoutPositions(nodes, result.winner.positions, input)
    resizeParentsBottomUp(nodes, input)
    // Every element has a new place: pins (elements a Studio user dropped
    // after a drag) go with the old ones.
    const unpinned = pinnedNodeIds(constraints).length
    if (view) view.layoutConstraints = view.layoutConstraints?.filter((c) => c.type !== 'pin')
    else changed.defaultLayoutConstraints = changed.defaultLayoutConstraints?.filter((c) => c.type !== 'pin')
    // The refit knows nothing of the alignments; put them back.
    applyAlignments(nodes, viewLayoutInput(view, nodes, byId(changed.relations), constraints))
    // All elements writes the nodes themselves (settleGeometry then syncs
    // defaultPositions); a view keeps its own positions.
    if (view) view.positions = viewCanvasPositions(view, nodes, positionsOf(nodes))
    const before = result.baseline
    const after = result.winner.metrics
    return {
      ok: true,
      changed,
      text: `Smart Layout${view ? ` (${view.name})` : ''}: ${result.winner.name}; crossings ${before.crossings} -> ${after.crossings}, overdraws ${before.overdraws} -> ${after.overdraws}.${unpinned ? ` Unpinned ${unpinned} element${unpinned === 1 ? '' : 's'}.` : ''}`,
    }
  }

  /** Tree Layout of a view whose layout mode is "tree": the same engine and
   *  refit as Studio's (applyTreeLayout, fitAndSeparateBottomUp). */
  private async treeLayout(
    changed: DiagramData, nodes: Record<string, C4Node>, view: NonNullable<DiagramData['views']>[number],
    input: ReturnType<typeof viewLayoutInput>, constraints: LayoutConstraint[] | undefined,
  ): Promise<{ ok: boolean; text: string; changed?: DiagramData }> {
    const positions = await applyTreeLayout(input.nodes, input.relations)
    applyLayoutPositions(nodes, positions, input)
    fitAndSeparateBottomUp(nodes, input)
    const unpinned = pinnedNodeIds(constraints).length
    view.layoutConstraints = view.layoutConstraints?.filter((c) => c.type !== 'pin')
    applyAlignments(nodes, viewLayoutInput(view, nodes, byId(changed.relations), constraints))
    view.positions = viewCanvasPositions(view, nodes, positionsOf(nodes))
    return {
      ok: true,
      changed,
      text: `Tree Layout (${view.name}): the view is set to a hierarchical nested tree, so it was laid out as one.${unpinned ? ` Unpinned ${unpinned} element${unpinned === 1 ? '' : 's'}.` : ''}`,
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
    const previous = new Set(issuesOf(data, metamodel).map((issue) => issue.id))
    const fresh = issuesOf(changed, metamodel).filter((issue) => !previous.has(issue.id))
    const newError = fresh.find((issue) => issue.severity === 'error')
    if (newError) return { ok: false, text: newError.message }
    // Warnings do not stop a write (a machine is incomplete while it is being
    // built), but the agent hears about the ones its change brought in.
    const warnings = fresh.filter((issue) => issue.severity === 'warning')
    const warned = warnings.length
      ? ` New warnings (fine while you are still building; fix them before you finish, see get_issues):${warnings.slice(0, MAX_WARNINGS).map((issue) => `\n- ${issue.message}`).join('')}${warnings.length > MAX_WARNINGS ? `\n- …and ${warnings.length - MAX_WARNINGS} more` : ''}`
      : ''
    const next = serializeToMdFolderWithPaths(changed).files
    // Preserve the user's manifest prose/name. The format codec only needs
    // to rewrite model-owned sidecars and node Markdown.
    next['radical.md'] = before['radical.md']
    const paths = [...new Set([...Object.keys(before), ...Object.keys(next)])]
      .filter((path) => before[path] !== next[path]
        && (path in next || isOwnedMdFolderFile(path, before[path])))
      .sort()
    if (!paths.length) return { ok: true, text: `${resultText} No files changed.${warned}` }
    const write = await session.write(next)
    if (!write.ok) return { ok: false, text: `Folder changed before write; no files written. Conflicts: ${write.conflict.join(', ')}` }
    const revision = createHash('sha256').update(paths.map((path) => `${path}\0${next[path] ?? ''}`).join('\0')).digest('hex').slice(0, 12)
    const createdRelation = changed.relations.find((relation) => !data.relations.some((old) => old.id === relation.id))?.id
    return { ok: true, text: `${resultText}${createdRelation ? ` Relation ID: ${createdRelation}.` : ''} Changed: ${paths.join(', ')}. Revision: ${revision}.${warned}` }
  }

  private restoreTempIds(previous: Map<string, string>): void {
    this.tempIds.clear()
    for (const [temp, real] of previous) this.tempIds.set(temp, real)
  }
}

/** Where the nodes are, by id. */
function positionsOf(nodes: Record<string, C4Node>): Record<string, NodePosition> {
  return Object.fromEntries(Object.values(nodes).map((node): [string, NodePosition] =>
    [node.id, { x: node.x, y: node.y, width: node.width, height: node.height }]))
}
