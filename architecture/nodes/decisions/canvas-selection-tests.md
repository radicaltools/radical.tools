---
id: "d8fafdce-845b-4f47-b15a-f44bed0d5f9e"
type: "fitness-fn"
label: "Canvas selection tests"
category: "structural"
threshold: "All three suites pass in CI"
---

apps/studio/tests/canvasSelection.test.ts (selecting nodes writes them and the view into the active folder; leaving the model clears it), apps/studio/tests/webFolder.test.ts (the browser writes .radical/selection.json with its .gitignore and the folder poll reports no model change) and apps/mcp/src/folderModel.test.ts › canvas selection (get_selection resolves the ids against the model, reports missing ones and an empty selection, and leaves the model files untouched).
