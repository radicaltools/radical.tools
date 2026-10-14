---
id: "eff2f9a4-1743-4db0-937d-2d94e6d7f68a"
type: "component"
label: "@radical/node-files"
technology: "Node.js"
---

Node-only file access shared by the Electron app, the MCP server and the CLI: diskFolderStorage (a Markdown model folder on disk, refusing paths outside the folder, non-model files and symbolic links) and selectionFile (the editor-state files under .radical/ with their .gitignore: Studio's canvas selection, the agent's Forge run status, and check.json plus .radical/test-results.json for the Inspector).
