---
id: "92429c46-65ef-4259-8cdc-315a88165a5e"
type: "scenario"
label: "Stage views made first"
given: "a model with a need, and Forge runs with Layer canvases or with the Radical structure"
tests: |
  packages/common/tests/forgeViews.test.ts › stage views before the stage
  apps/mcp/src/forge.test.ts › Radical Forge over MCP › files each stage into its view beside what is there, and arranges it as the user chooses
  apps/mcp/src/forge.test.ts › Radical Forge over MCP › files a run into the Radical structure the user chose
then: "the Domain canvas exists before the stage's first element and shows nothing until the domain is filed into it; the State machine group exists before the first machine, which gets its view in the group as it is added; over MCP forge_generate names the views it made; the views and groups the stage left empty are gone after it completes, the others stay"
when: "the Domain model, State machines and C4 stages begin, add their elements and complete, one of them adding nothing to a view it opened"
---
