---
id: "f53d7ad3-d926-404d-9341-9cb61722979d"
type: "component"
label: "Folder sessions"
technology: "Electron IPC, MdFolderSession"
---

apps/studio/src/main/index.ts. IPC folder:open/pick/read/write/watch: one MdFolderSession per folder over @radical/node-files; writes return a conflict when the folder changed on disk, and the active folder is polled every second for outside edits (folder:external-change). Also folder:write-selection (.radical/selection.json for MCP get_selection), folder:read-forge-run (.radical/forge-run.json written by the MCP server), folder:read-model-base (.radical/base.json, the model at the git base written by the CLI or the MCP server, for Changes on branch), folder:read-check-files (.radical/test-results.json and check.json for the Inspector) and folder:write-check-config (check.json, saved from the Inspector's Settings).
