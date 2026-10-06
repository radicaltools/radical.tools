---
id: "3c344c4a-3f1b-463d-a1eb-dfc0ab8e8030"
type: "requirement"
label: "Place agent-added elements"
action: "The MCP server shall place the element inside its parent, grow the parents to fit and keep the All elements positions in step."
ears_type: "event-driven"
rationale: "Agent edits arrive on the canvas readable, not stacked at the origin. Evidence: apps/mcp/src/folderModel.ts:89-112,212,221-222; apps/mcp/src/folderModel.test.ts ('places children inside their parent'); manual#mcp"
trigger: "an agent adds an element or moves it to another parent"
---
