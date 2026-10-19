---
id: "f6007fa4-d85b-4b59-a95c-b5e96a83ca50"
type: "scenario"
label: "Agent Forge run shown"
given: "an agent runs Radical Forge over MCP on the folder Studio has open"
tests: |
  apps/e2e/tests/studio/folders.spec.ts › an agent's Forge run on the folder makes the Forge button pulse and opens read only
  packages/common/tests/forgeRunStatus.test.ts › agent Forge run status file
  apps/mcp/src/forge.test.ts › Radical Forge over MCP › tells Studio where the run stands through .radical/forge-run.json
  apps/mcp/src/forge.test.ts › Radical Forge over MCP › marks an unfinished run closed when the client goes away
then: "the MCP server keeps .radical/forge-run.json up to date; Studio's Forge button pulses as working while a stage generates and waiting otherwise, with the stage number, opens a read-only view of the steps, marks a stage that refined earlier stages with how many, says the agent waits for the user's answer while a proposed refinement is open, and shows paused when the client closed or the run went quiet"
when: "the run moves through its stages and the client closes"
---
