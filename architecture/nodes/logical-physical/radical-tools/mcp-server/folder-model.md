---
id: "55cd24b4-b12b-4508-994b-de05fd43ce69"
type: "component"
label: "Folder model"
technology: "TypeScript"
---

apps/mcp/src/folderModel.ts. Starts a new model in a missing or empty folder (and again when the folder is emptied while the server runs), then runs one call at a time: re-reads the folder, runs the shared tool on a headless facade, refits parents, rejects changes that add validation errors, reports the warnings they add, and writes only the changed files with a conflict check. Adds get_model_summary, get_issues and get_selection, hands forge_* calls to Forge over MCP, and runs the catalogue's smart_layout headlessly (tree layout for a view set to a nested tree, progress and cancellation); leaves out set_active_view and focus_node (they drive a canvas) and reset_diagram (too destructive). The delete_* tools stay.
