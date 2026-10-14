---
id: "4d3c1f5d-06aa-4bec-8acb-27b4b04f352a"
type: "scenario"
label: "Enum starts unset"
given: "an enum property with no value: a container's new Tier property, or a relation's Kind on the table view's Relations tab"
tests: |
  apps/e2e/tests/studio/metamodel-editor.spec.ts › custom properties of a type › an enum without a value shows as not set, and its first option can be chosen
  apps/e2e/tests/studio/runs-13-24.spec.ts › the table view › an enum cell without a value shows as not set, and its first option can be chosen
then: "the field shows no value before the pick, and the picked option is saved to the model"
when: "the user picks the enum's first option, in the properties panel or in the table cell"
---
