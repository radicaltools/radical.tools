---
id: "55cd24b4-b12b-4508-994b-de05fd43ce69"
type: "component"
label: "Folder model"
technology: "TypeScript"
---

apps/mcp/src/folderModel.ts. Seeds an empty folder from a preset, runs one call at a time: re-reads the folder, runs the shared tool on a headless facade, refits parents, rejects changes that add validation errors, and writes only the changed files with a conflict check. Adds get_model_summary and smart_layout; leaves out set_active_view and focus_node (they drive a canvas) and reset_diagram (too destructive). The delete_* tools stay.
