#!/usr/bin/env node
import { McpServer, fromJsonSchema, type RegisteredTool } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { FolderModel, READ_ONLY_TOOLS } from './folderModel'

function folderArg(args: string[]): string {
  if (args.length !== 2 || args[0] !== '--folder' || !args[1]) {
    throw new Error('Usage: radical-mcp --folder /absolute/path/to/model-folder')
  }
  return args[1]
}

const INSTRUCTIONS = [
  'Reads and edits one Radical Markdown model folder (C4 architecture plus governance records such as ADRs and requirements).',
  'Call get_model_summary first: besides counts it returns the metamodel context message the other tools refer to,',
  'with each type\'s valid `properties` keys and enum options, allowedParents/allowedAtRoot/cardinality,',
  'and the node-type pairs each relation type allows. Use search_model for exact model data before changing it.',
  'New nodes appear only in Studio\'s All elements view until you list them in a view (create_view, set_view_nodes).',
  'move_node changes a node\'s parent. New and moved nodes get a simple placement; call smart_layout afterwards to arrange the model or one view.',
  'Sequences (create_sequence) are ordered relation flows that dynamic views play; presentations are slides over views.',
  'Metamodel tools (upsert_node_type, upsert_relation_type, …) change the types; the tool schemas refresh after them.',
].join(' ')

async function main(): Promise<void> {
  const model = await FolderModel.open(folderArg(process.argv.slice(2)))
  const server = new McpServer({ name: 'radical-folder', version: '0.1.0' }, { instructions: INSTRUCTIONS })
  const registered = new Map<string, RegisteredTool>()
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
      }, async (input) => {
        const outcome = await model.call(tool.name, input)
        if (outcome.toolsChanged) advertise()
        return { content: [{ type: 'text', text: outcome.text }], isError: !outcome.ok }
      }))
    }
  }
  advertise()
  await server.connect(new StdioServerTransport())
}

main().catch((error: unknown) => {
  process.stderr.write(`radical-mcp: ${(error as Error).message}\n`)
  process.exitCode = 1
})
