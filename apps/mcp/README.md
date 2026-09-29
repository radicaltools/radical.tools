# @radical/mcp

MCP server that lets AI agents read and edit `.radical` models. Empty for now.

Planned shape:

- Serve the AI tool catalogue from `@radical/common/ai/tools` as MCP tools, so
  Studio's AI chat and MCP clients share one set of tools.
- Back those tools with a headless `DiagramFacade` implementation that works on
  a plain `DiagramData` loaded from a `.radical` file, instead of Studio's
  zustand store.
- Use `@radical/layout` to place new elements, so models written through MCP
  open in Studio already laid out.
