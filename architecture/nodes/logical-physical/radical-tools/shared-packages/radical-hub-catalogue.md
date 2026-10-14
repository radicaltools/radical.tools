---
id: "6a9e1c2b-cb04-4d65-93d7-758ba97867ea"
type: "component"
label: "@radical/hub-catalogue"
technology: "TypeScript, Vite plugin"
---

packages/hub-catalogue: the Hub's concept catalogue (catalogue/<category>/<id>.radical, 128 concepts), readCatalogue, validateCatalogue (hub block, path, unique ids, declared {{KEY}} params, resolvable hubRefs) and buildIndex, and the Vite plugin that serves it under /hub/ in dev and emits hub/index.json, every concept file and the legacy hub-data.json at build time. Used by the Hub's and Studio's builds; the MCP server's build ships a copy for Radical Forge's Hub matches and imports. Its tests hold the Hub matching benchmark for the ranking in @radical/common/ai/forge/hubMatches.ts.
