---
id: "cf11d912-7d63-4d41-828a-608a41b462f1"
type: "scenario"
label: "Agent records milestones"
given: "a model edited through the AI tool catalogue or the MCP server"
tests: |
  packages/common/tests/aiDocumentTools.test.ts › milestone tools
  apps/mcp/src/folderModel.test.ts › milestones › saves a milestone into the folder, lists it in the summary and compares without writing
then: "each milestone is saved with the model and listed in the summary, compare_milestones names what was added without writing anything, a slide can show a milestone, and the tools refuse to read the current model while Studio has a milestone loaded over it"
when: "the agent saves, lists, renames, compares and deletes milestones and points a slide at one"
---
