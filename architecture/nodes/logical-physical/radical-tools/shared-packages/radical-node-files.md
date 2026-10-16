---
id: "eff2f9a4-1743-4db0-937d-2d94e6d7f68a"
type: "component"
label: "@radical/node-files"
technology: "Node.js"
---

Node-only file access shared by the Electron app, the MCP server and the CLI: diskFolderStorage (a Markdown model folder on disk, refusing paths outside the folder, non-model files and symbolic links), selectionFile (the editor-state files under .radical/ with their .gitignore: Studio's canvas selection, the agent's Forge run status, and check.json plus .radical/test-results.json for the Inspector; writeCheckConfig saves check.json, refusing a symlinked one) and gitModel (the model folder at a git commit: resolveGitBase picks the ref given or the merge base with the default branch, readModelAtCommit reads the same model files from git with one ls-tree and one cat-file --batch, modelChangesSince compares them with the folder on disk for get_changes and radical diff).
