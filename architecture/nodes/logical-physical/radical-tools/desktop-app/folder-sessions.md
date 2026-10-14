---
id: "f53d7ad3-d926-404d-9341-9cb61722979d"
type: "component"
label: "Folder sessions"
technology: "Electron IPC, MdFolderSession"
---

apps/studio/src/main/index.ts. IPC folder:open/pick/read/write/watch: one MdFolderSession per folder over @radical/node-files; writes return a conflict when the folder changed on disk, and the active folder is polled every second for outside edits (folder:external-change). Also folder:write-selection (.radical/selection.json for MCP get_selection), folder:read-forge-run (.radical/forge-run.json written by the MCP server) and folder:read-check-files (.radical/test-results.json and check.json for the Inspector).
