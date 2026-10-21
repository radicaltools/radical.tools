---
id: "e6f4a533-1239-42f4-a015-ed07980ff0f8"
type: "scenario"
label: "A typed name undone at once"
given: "Payment Provider selected, its properties card open"
tests: |
  packages/ui/tests/undoSteps.test.ts › typing into a text field is one undo step (item 158)
  apps/e2e/tests/studio/properties-card.spec.ts › a name or a description typed letter by letter is one undo step
then: "one Undo gives back \"Payment Provider\"; a field typed into again after it lost focus, or after Undo, is a new step"
when: "the user types a new name letter by letter, leaves the field and presses Undo"
---
