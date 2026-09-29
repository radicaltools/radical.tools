# @radical/mcp

MCP server that lets AI agents read and edit `.radical` models. Empty for now.

Planned shape:

- Serve the AI tool catalogue from `@radical/common/ai/tools` as MCP tools, so
  Studio's AI chat and MCP clients share one set of tools.
- Back those tools with `createModelFacade` from `@radical/common/ai/modelFacade`,
  a headless `DiagramFacade` over a plain `DiagramData` loaded from a `.radical`
  file. It applies the same rules as Studio's store; apps/studio's
  `modelFacadeParity` test keeps the two in step.
- Use `@radical/layout` to place new elements, so models written through MCP
  open in Studio already laid out.
