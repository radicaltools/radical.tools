---
id: "6a9e1c2b-cb04-4d65-93d7-758ba97867ea"
type: "component"
label: "@radical/hub-catalogue"
technology: "TypeScript, Vite plugin"
---

packages/hub-catalogue: the Hub's catalogue of concern packs. Each pack is written as a spec (packs/<group>/<id>.ts, src/packSpec.ts) and built into catalogue/concern/<id>.radical by scripts/build-packs.ts (npm run build:packs), which refuses a pack below the standard (concernPackProblems) or one that, imported with some answers and bound into a shop model, leaves radical check something to report (src/packCheck.ts). readCatalogue, validateCatalogue (hub block, path, unique ids, declared {{KEY}} params, resolvable hubRefs, the concern pack rules), concernPacksOf and buildIndex, and the Vite plugin that serves it under /hub/ in dev and emits hub/index.json, every pack file and the legacy hub-data.json at build time. Used by the Hub's and Studio's builds; the MCP server's and the CLI's builds ship a copy for get_issues, Forge and radical check.
