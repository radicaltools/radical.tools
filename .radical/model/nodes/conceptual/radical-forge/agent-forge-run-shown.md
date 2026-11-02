---
id: "f6007fa4-d85b-4b59-a95c-b5e96a83ca50"
type: "scenario"
label: "Agent Forge run shown"
given: "an agent runs Radical Forge over MCP on the folder Studio has open"
then: "the MCP server keeps .state/forge-run.json up to date; Studio's Forge button pulses as working while a stage generates and waiting otherwise, with the stage number, opens a read-only view of the steps, marks a stage that refined earlier stages with how many, says the agent waits for the user's answer while a proposed refinement is open, and shows paused when the client closed or the run went quiet"
when: "the run moves through its stages and the client closes"
---
