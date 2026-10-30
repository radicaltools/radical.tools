---
id: "e6f4a533-1239-42f4-a015-ed07980ff0f8"
type: "scenario"
label: "A typed name undone at once"
given: "Payment Provider selected, its properties card open"
metrics: |
  test(packages/ui/tests/undoSteps.test.ts › typing into a text field is one undo step (item 158)) passed
  test(apps/e2e/tests/studio/properties-card.spec.ts › a name or a description typed letter by letter is one undo step) passed
  test(packages/ui/tests/milestoneViewEdits.test.ts › Undo in a milestone › what is typed into one field before and after the question is one step) passed
  test(packages/ui/tests/milestoneViewEdits.test.ts › Undo in a milestone › another field typed into after the question is a step of its own) passed
  test(apps/e2e/tests/studio/milestones.spec.ts › a name typed in a milestone before and after the question is one undo step) passed
then: "one Undo gives back \"Payment Provider\"; a field typed into again after it lost focus, or after Undo, is a new step; in the milestone what was typed before and after the question is one step, and another field typed into after it is a step of its own"
when: "the user types a new name letter by letter, leaves the field and presses Undo; and types a name in a milestone, answering the question about its edits between the letters"
---
