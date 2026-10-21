---
id: "b5b042bf-52f5-4661-ba60-56bf78f88b79"
type: "scenario"
label: "Values the metamodel dropped"
given: "elements holding an enum option since removed from the metamodel, a reference switched from many to one that holds several, a required property emptied to an empty list, and a required property with a default left empty"
tests: |
  packages/common/tests/propertyValues.test.ts › a value the metamodel no longer takes
  packages/common/tests/propertyValues.test.ts › a required property
  apps/e2e/tests/studio/metamodel-editor.spec.ts › a value that is no option any more shows as it is in the card
then: "the removed option and the several references are flagged, the empty list is reported missing, the property with a default is not; the card shows the old value as it is"
when: "the model is validated and the element with the removed option is selected"
---
