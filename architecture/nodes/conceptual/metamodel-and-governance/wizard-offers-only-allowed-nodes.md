---
id: "3b226be4-1b70-4a9b-bfcb-355d0bee0dc4"
type: "scenario"
label: "Wizard offers only allowed nodes"
gherkin: ""
given: "a scenario wizard on a model with requirements, ADRs and systems"
tests: "packages/common/tests/nodeWizard.test.ts › offers only nodes the relation type allows, never the node itself"
then: "only requirements are offered, and never the scenario itself"
when: "the user reaches the Verified requirements step"
---
