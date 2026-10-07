#!/usr/bin/env node
import { McpServer, fromJsonSchema, type RegisteredTool } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { FolderModel, PRESETS, READ_ONLY_TOOLS, type OpenOptions } from './folderModel'
import { FORGE_PROCEDURE } from './forge'

const USAGE = `Usage: radical-mcp --folder <model-folder> [--metamodel ${Object.keys(PRESETS).join('|')}]
  --folder     the Markdown model folder, absolute or relative to the working directory;
               a missing or empty folder becomes a new model
  --metamodel  the metamodel of a new model (default: governance)`

function parseArgs(args: string[]): { folder: string } & OpenOptions {
  const values = new Map<string, string>()
  for (let i = 0; i < args.length; i += 2) {
    const [flag, value] = [args[i], args[i + 1]]
    if ((flag !== '--folder' && flag !== '--metamodel') || !value || values.has(flag)) throw new Error(USAGE)
    values.set(flag, value)
  }
  const folder = values.get('--folder')
  const metamodel = values.get('--metamodel')
  if (!folder || (metamodel !== undefined && !(metamodel in PRESETS))) throw new Error(USAGE)
  return { folder, metamodel: metamodel as OpenOptions['metamodel'] }
}

const INSTRUCTIONS = [
  'Reads and edits one Radical Markdown model folder (C4 architecture plus governance records such as ADRs and requirements).',
  'Call get_model_summary first: besides counts it returns the metamodel context message the other tools refer to,',
  'with each type\'s valid `properties` keys and enum options, allowedParents/allowedAtRoot/cardinality,',
  'and the node-type pairs each relation type allows. Use search_model for exact model data before changing it.',
  'New nodes appear only in Studio\'s All elements view until you list them in a view (create_view, set_view_nodes).',
  'move_node changes a node\'s parent. New and moved nodes get a simple placement; call smart_layout afterwards to arrange the model or one view.',
  'A `need` node keeps raw free-text input (brief, notes, raw requirements) in its description; derive EARS `requirement` nodes from it rather than rewriting it, linking each requirement → need with `derives`.',
  'Sequences (create_sequence) are ordered relation flows that dynamic views play; presentations are slides over views.',
  'Metamodel tools (upsert_node_type, upsert_relation_type, …) change the types; the tool schemas refresh after them.',
  'To turn a free-text description into requirements, fitness functions, scenarios, mockups and a C4 model the way Studio\'s Radical Forge does, start with forge_start and follow the steps it returns.',
].join(' ')

const FORGE_ARGS = fromJsonSchema({
  type: 'object',
  properties: { description: { type: 'string', description: 'The system to forge, in plain language. Leave empty to be asked, or to start from an existing need.' } },
})

/** The `forge` prompt: Radical Forge as one command (a slash command in Claude Code). */
function forgePrompt(description: string): string {
  return [
    'Run Radical Forge on the model of the radical MCP server.',
    description
      ? `The system:\n"""\n${description}\n"""`
      : 'Ask me to describe the system first, or offer the needs already in the model (search_model: LIST NODES WHERE type = "need").',
    '',
    FORGE_PROCEDURE,
  ].join('\n')
}

async function main(): Promise<void> {
  const { folder, metamodel } = parseArgs(process.argv.slice(2))
  const model = await FolderModel.open(folder, { metamodel })
  const server = new McpServer({ name: 'radical-folder', version: '0.1.0' }, { instructions: INSTRUCTIONS })
  const registered = new Map<string, RegisteredTool>()
  const gone = new AbortController()
  const advertise = (): void => {
    for (const tool of model.tools) {
      const existing = registered.get(tool.name)
      if (existing) {
        existing.update({ description: tool.description, paramsSchema: fromJsonSchema(tool.inputSchema) })
        continue
      }
      registered.set(tool.name, server.registerTool(tool.name, {
        description: tool.description,
        inputSchema: fromJsonSchema(tool.inputSchema),
        annotations: { readOnlyHint: READ_ONLY_TOOLS.has(tool.name) },
      }, async (input, ctx) => {
        // Progress goes out only to a client that asked for it with a token.
        const token = ctx.mcpReq._meta?.progressToken
        const onProgress = token === undefined ? undefined : ({ progress, message }: { progress: number; message: string }) => {
          void ctx.mcpReq.notify({ method: 'notifications/progress', params: { progressToken: token, progress, message } })
        }
        const outcome = await model.call(tool.name, input, { onProgress, signal: AbortSignal.any([ctx.mcpReq.signal, gone.signal]) })
        if (outcome.toolsChanged) advertise()
        return { content: [{ type: 'text', text: outcome.text }], isError: !outcome.ok }
      }))
    }
  }
  advertise()
  server.registerPrompt('forge', {
    title: 'Radical Forge',
    description: 'Turn a system description into requirements, fitness functions, Gherkin scenarios, mockups and a C4 model, one reviewed stage at a time.',
    argsSchema: FORGE_ARGS,
  }, (args) => {
    const { description } = (args ?? {}) as { description?: unknown }
    return { messages: [{ role: 'user', content: { type: 'text', text: forgePrompt(typeof description === 'string' ? description.trim() : '') } }] }
  })
  await server.connect(new StdioServerTransport())
  // The client is gone: stop instead of computing (and writing) a result nobody
  // will read. A running Smart Layout notices at its next step.
  process.stdin.once('end', () => {
    gone.abort()
    void model.idle().then(() => process.exit(0))
  })
}

main().catch((error: unknown) => {
  process.stderr.write(`radical-mcp: ${(error as Error).message}\n`)
  process.exitCode = 1
})
