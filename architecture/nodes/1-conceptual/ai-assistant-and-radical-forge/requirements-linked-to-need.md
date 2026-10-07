---
id: "bf6789a1-98c1-44b0-8cc8-01958b12b10d"
type: "scenario"
label: "Requirements linked to need"
gherkin: "# Covered by: packages/common/tests/forgePrompts.test.ts › buildForgeStagePrompt — need › has the requirements stage link top-level requirements to the need with derives"
given: "a Forge run bound to a stored need"
then: "the stage prompt tells the model to link each top-level requirement to that need with derives and not to edit the need"
when: "the Requirements stage is generated"
---
