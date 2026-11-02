---
id: "f229d3bf-b611-42b5-aea8-acd1e05b7bd6"
type: "scenario"
label: "Agent reads selection"
given: "Studio has a model folder open with elements selected on a view"
then: "Studio has written the selected nodes and view under .radical without it counting as a model change, and the MCP server returns them resolved against the current model; a view that is gone is named as such, not as All elements, and a broken selection file or one of a newer Studio is told apart from a folder Studio never opened"
when: "an agent calls get_selection on the same folder"
---
