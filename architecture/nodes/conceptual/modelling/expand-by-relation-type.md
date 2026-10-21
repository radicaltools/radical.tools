---
id: "f6b1f703-b70f-4d12-b6fc-0e5838db6c1b"
type: "scenario"
label: "Expand by relation type"
given: "an exploration of API in the bookstore model"
tests: |
  packages/ui/tests/exploreView.test.ts › choosing the relations of a +
  apps/e2e/tests/studio/explore.spec.ts › the + of an element adds the relations of the types and direction chosen
then: "the menu counts each type in the direction chosen; Show adds only the neighbours joined by the checked type in that direction, a level below API, with only those relations drawn; All then adds the rest; nothing is saved"
when: "the user clicks API's +, sees All and the relation types with their counts, switches the direction to outgoing, checks one type and clicks Show; then opens the + again and chooses All"
---
