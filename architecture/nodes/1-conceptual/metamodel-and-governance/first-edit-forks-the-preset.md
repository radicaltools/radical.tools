---
id: "0b651343-99a2-4dd6-99af-82dcf7d85543"
type: "scenario"
label: "First edit forks the preset"
gherkin: |
  And reloading the model keeps the Risk type
  # Covered by: packages/common/tests/aiDocumentTools.test.ts › copy a preset on the first edit, and the copy survives reloading
given: "a model running under the built-in C4 + DDD + Governance preset"
then: "the metamodel becomes \"c4-ddd-governance-custom\" with Risk as a custom type, and a second edit changes that copy without copying again"
when: "a node type \"Risk\" is added to the metamodel"
---
