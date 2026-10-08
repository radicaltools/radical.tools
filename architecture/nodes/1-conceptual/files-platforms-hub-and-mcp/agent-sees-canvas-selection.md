---
id: "cd49e9b4-a1b6-4a53-973b-12544de84e77"
type: "requirement"
label: "Agent sees canvas selection"
action: "The MCP server shall return the elements selected on Studio's canvas and the view they are selected in, resolved against the current model."
ears_type: "event-driven"
rationale: "\"Fix the selected mockup\" works without copying ids. Evidence: apps/studio/src/renderer/src/persistence/selection.ts; packages/node-files/src/selectionFile.ts; apps/mcp/src/folderModel.ts (get_selection); apps/mcp/src/folderModel.test.ts ('canvas selection')"
trigger: "the user refers to the selected element without naming it while Studio has the same model folder open"
---
