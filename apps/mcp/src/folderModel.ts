import { realpath, stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { buildToolDefs, buildToolHandlers, type ToolDef, type ToolRunContext } from '@radical/common/ai/tools'
import { createModelFacade } from '@radical/common/ai/modelFacade'
import { deserializeFromMdFolder, isMdFolder, isOwnedMdFolderFile, serializeToMdFolderWithPaths, type FolderFiles } from '@radical/common/formats/mdFolder'
import { MdFolderSession } from '@radical/common/formats/mdFolderSync'
import { validateModel } from '@radical/common/metamodel'
import { diskFolderStorage } from '@radical/node-files/diskFolderStorage'
import type { DiagramData } from '@radical/common/c4'

const TOOL_NAMES = new Set([
  'search_model', 'add_node', 'update_node', 'delete_node',
  'add_relation', 'update_relation', 'delete_relation',
])
const MUTATIONS = new Set([...TOOL_NAMES].filter((name) => name !== 'search_model'))
const JSON_FILES = ['_layout.json', 'relations.json', 'views.json', 'sequences.json', 'snapshots.json', 'presentations.json', 'metamodel.json', 'hubTemplates.json']

export interface CallOutcome {
  ok: boolean
  text: string
}

function checkFiles(files: FolderFiles): void {
  if (!isMdFolder(files)
    || !/^radicalFormat:\s*["']?md-folder["']?\s*$/m.test(files['radical.md'])
    || !/^version:\s*1\s*$/m.test(files['radical.md'])) {
    throw new Error('Folder is missing a valid radical.md Markdown-folder manifest')
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

export class FolderModel {
  private readonly handlers = buildToolHandlers()
  private readonly tempIds = new Map<string, string>()
  private readonly folder: string
  private readonly metamodelKey: string
  readonly tools: ToolDef[]
  private tail: Promise<unknown> = Promise.resolve()

  private constructor(folder: string, tools: ToolDef[], metamodelKey: string) {
    this.folder = folder
    this.tools = tools
    this.metamodelKey = metamodelKey
  }

  static async open(folder: string): Promise<FolderModel> {
    if (!folder || !isAbsolute(folder)) throw new Error('--folder must be an absolute path')
    const canonical = await realpath(resolve(folder))
    if (!(await stat(canonical)).isDirectory()) throw new Error(`Not a directory: ${folder}`)
    const files = await new MdFolderSession(diskFolderStorage(canonical)).readAll()
    checkFiles(files)
    const data = deserializeFromMdFolder(files).data
    checkData(data)
    const metamodel = createModelFacade(data).getMetamodel?.()
    const defs = buildToolDefs(metamodel).filter((tool) => TOOL_NAMES.has(tool.name))
    return new FolderModel(canonical, defs, JSON.stringify(metamodel))
  }

  call(name: string, input: unknown): Promise<CallOutcome> {
    const run = this.tail.then(() => this.run(name, input))
    this.tail = run.catch(() => {})
    return run
  }

  private async run(name: string, input: unknown): Promise<CallOutcome> {
    if (name !== 'get_model_summary' && !TOOL_NAMES.has(name)) return { ok: false, text: `Unknown tool ${name}` }
    let priorTempIds: Map<string, string> | undefined
    try {
      const session = new MdFolderSession(diskFolderStorage(this.folder))
      const before = await session.readAll()
      checkFiles(before)
      const data = deserializeFromMdFolder(before).data
      checkData(data)
      const facade = createModelFacade(data)
      if (JSON.stringify(facade.getMetamodel?.()) !== this.metamodelKey) {
        return { ok: false, text: 'The metamodel changed; restart the MCP server to refresh tool schemas.' }
      }
      if (name === 'get_model_summary') {
        return { ok: true, text: JSON.stringify({
          folder: this.folder,
          nodes: data.nodes.length,
          relations: data.relations.length,
          views: data.views?.length ?? 0,
          nodeTypes: Object.keys(facade.getMetamodel?.()?.nodeTypes ?? {}),
          relationTypes: Object.keys(facade.getMetamodel?.()?.relationTypes ?? {}),
        }) }
      }
      const handler = this.handlers.get(name)
      if (!handler) return { ok: false, text: `No handler for ${name}` }
      priorTempIds = new Map(this.tempIds)
      const ctx: ToolRunContext = {
        diagram: facade,
        resolveId: (id) => this.tempIds.get(id) ?? id,
        registerTempId: (tempId, realId) => { this.tempIds.set(tempId, realId) },
        resetTempIds: () => this.tempIds.clear(),
        placeNext: () => {
          const nodes = Object.values(facade.getNodes())
          return { x: nodes.length ? Math.max(...nodes.map((node) => node.x + node.width)) + 80 : 0, y: 0 }
        },
      }
      const result = handler(input, ctx)
      if (!result.ok || facade.lastError) {
        this.restoreTempIds(priorTempIds)
        return { ok: false, text: facade.lastError ?? result.resultText }
      }
      if (!MUTATIONS.has(name)) return { ok: true, text: result.resultText }

      const changed = facade.toDiagramData()
      checkData(changed)
      const metamodel = facade.getMetamodel?.()
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
      if (newError) {
        this.restoreTempIds(priorTempIds)
        return { ok: false, text: newError.message }
      }
      const next = serializeToMdFolderWithPaths(changed).files
      // Preserve the user's manifest prose/name. The format codec only needs
      // to rewrite model-owned sidecars and node Markdown.
      next['radical.md'] = before['radical.md']
      const paths = [...new Set([...Object.keys(before), ...Object.keys(next)])]
        .filter((path) => before[path] !== next[path]
          && (path in next || isOwnedMdFolderFile(path, before[path])))
        .sort()
      if (!paths.length) return { ok: true, text: `${result.resultText} No files changed.` }
      const write = await session.write(next)
      if (!write.ok) {
        this.restoreTempIds(priorTempIds)
        return { ok: false, text: `Folder changed before write; no files written. Conflicts: ${write.conflict.join(', ')}` }
      }
      const revision = createHash('sha256').update(paths.map((path) => `${path}\0${next[path] ?? ''}`).join('\0')).digest('hex').slice(0, 12)
      const createdRelation = name === 'add_relation'
        ? changed.relations.find((relation) => !data.relations.some((old) => old.id === relation.id))?.id
        : undefined
      return { ok: true, text: `${result.resultText}${createdRelation ? ` Relation ID: ${createdRelation}.` : ''} Changed: ${paths.join(', ')}. Revision: ${revision}.` }
    } catch (error) {
      if (priorTempIds) this.restoreTempIds(priorTempIds)
      return { ok: false, text: (error as Error).message }
    }
  }

  private restoreTempIds(previous: Map<string, string>): void {
    this.tempIds.clear()
    for (const [temp, real] of previous) this.tempIds.set(temp, real)
  }
}
