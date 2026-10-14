---
id: "d3f3085c-2dc8-47b4-99fa-64051af06135"
type: "scenario"
label: "Model's Hub pick offered"
gherkin: ""
given: "a governance model, AI configured and the Hub catalogue loaded"
tests: |
  apps/e2e/tests/studio/forge.spec.ts › Forge files each stage into its view and offers to arrange it
  apps/studio/tests/forgeClarify.test.ts › returns the Hub candidates the model picked, or null when its reply is unreadable
  apps/mcp/src/forge.test.ts › runs the stages in order with the wizard's prompts, and regenerate replaces what a stage added
then: "the stage card lists only that concept under \"Picked from the Hub\", checked; after Confirm answers and Generate, the stage prompt carries it as prior art"
when: "Radical Forge reaches the Requirements stage and the model picks \"Idempotent Write Operations\" from the stage's candidates"
---
