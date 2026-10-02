#!/usr/bin/env node
import { McpServer, fromJsonSchema } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { FolderModel } from './folderModel'

function folderArg(args: string[]): string {
  if (args.length !== 2 || args[0] !== '--folder' || !args[1]) {
    throw new Error('Usage: radical-mcp --folder /absolute/path/to/model-folder')
  }
  return args[1]
}

async function main(): Promise<void> {
  const model = await FolderModel.open(folderArg(process.argv.slice(2)))
  const server = new McpServer({ name: 'radical-folder', version: '0.1.0' })
  server.registerTool('get_model_summary', {
    description: 'Show counts and available element types in the currently bound Radical model folder.',
    inputSchema: fromJsonSchema({ type: 'object', properties: {}, additionalProperties: false }),
    annotations: { readOnlyHint: true },
  }, async () => {
    const outcome = await model.call('get_model_summary', {})
    return { content: [{ type: 'text', text: outcome.text }], isError: !outcome.ok }
  })
  for (const tool of model.tools) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: fromJsonSchema(tool.inputSchema),
      annotations: { readOnlyHint: tool.name === 'search_model' },
    }, async (input) => {
      const outcome = await model.call(tool.name, input)
      return { content: [{ type: 'text', text: outcome.text }], isError: !outcome.ok }
    })
  }
  await server.connect(new StdioServerTransport())
}

main().catch((error: unknown) => {
  process.stderr.write(`radical-mcp: ${(error as Error).message}\n`)
  process.exitCode = 1
})
