---
id: "4ae9de15-ef14-4092-bcac-a3a6dd9b5b74"
type: "scenario"
label: "Forge stages land in their views"
gherkin: "# Covered by: apps/e2e/tests/studio/forge.spec.ts › Forge files each stage into its view and offers to arrange it; apps/mcp/src/forge.test.ts › files each stage into its view beside what is there, and arranges it as the user chooses"
given: "a governance model and AI configured"
then: "the need and the requirements are on a Conceptual view, beside each other in a block wider than tall, held in a grid of 3 columns; the fitness functions are alone on a new Governance view, which is on screen, and the wizard asks how to arrange them"
when: "the user starts Radical Forge, generates five requirements, keeps them in a grid, runs Smart Layout, then generates two fitness functions"
---
