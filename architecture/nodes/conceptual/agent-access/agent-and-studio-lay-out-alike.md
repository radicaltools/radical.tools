---
id: "ab769c1c-e999-4a9e-adfd-447a0f9892ab"
type: "scenario"
label: "Agent and Studio lay out alike"
given: "a large view of the sample model, laid out by Studio's Smart Layout"
tests: |
  apps/mcp/src/folderModel.test.ts › long Smart Layout runs › gives a large view the layout Studio gives it, within Studio's budget (F-0080)
  apps/mcp/src/folderModel.test.ts › long Smart Layout runs › tells the agent the numbers Studio shows for the same layout (F-0082)
then: "the agent's run gives the layout Studio gave, within Studio's budget, and tells the agent the moves and cost parts Studio's notice shows"
when: "an agent calls smart_layout on the same view"
---
