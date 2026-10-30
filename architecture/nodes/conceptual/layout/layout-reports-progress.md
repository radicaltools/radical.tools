---
id: "5d1db7bf-cae3-4b3d-9b19-f266ed76eaaf"
type: "scenario"
label: "Layout reports progress"
given: "a diagram to lay out"
metrics: |
  test(packages/layout/tests/layoutPipeline.test.ts › runSmartLayoutELKPhase › only runs the engines, one at a time, reporting each) passed
  test(apps/mcp/src/folderModel.test.ts › long Smart Layout runs › reports each step to a client that asked for progress) passed
then: "progress is reported after each of the ten engines, one at a time, and the MCP client gets each step"
when: "Smart Layout runs its engines, or an MCP client that asked for progress runs smart_layout"
---
