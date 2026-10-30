---
id: "f229d3bf-b611-42b5-aea8-acd1e05b7bd6"
type: "scenario"
label: "Agent reads selection"
given: "Studio has a model folder open with elements selected on a view"
metrics: |
  test(apps/mcp/src/folderModel.test.ts › canvas selection › returns what Studio selected, resolved against the model, and is not a model change) passed
  test(apps/mcp/src/folderModel.test.ts › get_selection with an odd selection file) passed
  test(apps/studio/tests/canvasSelection.test.ts › canvas selection in the model folder › writes the selected nodes and view into the active folder, and clears it on leaving) passed
  test(apps/studio/tests/webFolder.test.ts › webFolder read/write › writes the canvas selection under .radical, gitignored, without it counting as a model change) passed
then: "Studio has written the selected nodes and view under .radical without it counting as a model change, and the MCP server returns them resolved against the current model; a view that is gone is named as such, not as All elements, and a broken selection file or one of a newer Studio is told apart from a folder Studio never opened"
when: "an agent calls get_selection on the same folder"
---
