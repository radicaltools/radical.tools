---
id: "3b226be4-1b70-4a9b-bfcb-355d0bee0dc4"
type: "scenario"
label: "Wizard offers only allowed nodes"
gherkin: "# Covered by: packages/common/tests/nodeWizard.test.ts › offers only nodes the relation type allows, never the node itself"
given: "a scenario wizard on a model with requirements, ADRs and systems"
then: "only requirements are offered, and never the scenario itself"
when: "the user reaches the Verified requirements step"
---
