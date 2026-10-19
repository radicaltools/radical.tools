---
id: "e65765b1-2997-4c3c-8cc4-8479faa96589"
type: "scenario"
label: "Gaps by the stages done"
given: "a model with a requirement no scenario verifies and nothing satisfies, a process step nobody performs and an event no transition uses"
tests: |
  packages/common/tests/forgeRefinements.test.ts › forgeGaps lists only the gaps of the stages done
  apps/mcp/src/forge.test.ts › asks the user before each refinement, applies what they accept, and regenerate undoes it
then: "after Requirements only origin gaps are listed; after the scenarios and states the missing scenario and the unused event are too; after C4 also the unsatisfied requirement and the step nobody performs; the next stage's task and forge_complete_stage carry the list"
when: "the gaps are listed after the Requirements stage, after the Gherkin scenarios and State machines stages, and after the C4 stage"
---
