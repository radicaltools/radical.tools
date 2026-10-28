---
id: "34fc08d2-554b-47d3-847e-d35e5a32cf01"
type: "scenario"
label: "AI provider set up in the wizard"
given: "the Setup wizard on the first start, no AI provider set up"
tests: "apps/e2e/tests/studio/setup.spec.ts › first start › an AI provider set up in it offers Radical Forge"
then: "New model offers Create with Radical Forge"
when: "the user picks Claude at the AI step, pastes an API key and finishes"
---
