---
id: "fae99b57-0571-4d6e-b596-7e6efb8f2cc1"
type: "scenario"
label: "Step notes stay true"
given: "the Place Order sequence picked on Bookstore's flow view"
tests: |
  apps/e2e/tests/studio/editing.spec.ts › a step note shows the note after Undo, and leaving it unchanged writes nothing
  apps/e2e/tests/studio/editing.spec.ts › in viewer, a sequence picked is shown, and a click on a relation adds no step
  apps/e2e/tests/studio/editing.spec.ts › in presenter, a sequence picked is shown, and a click on a relation adds no step
  packages/ui/tests/sequences.test.ts › updateStepDescription › is no edit when the note stays as it was
then: "the note shows the model's text after Undo and leaving it unchanged writes nothing; in Viewer and Presenter the sequence is shown read-only and the click adds no step"
when: "the user changes a step note, presses Undo and clicks into the note and out; and in Viewer and Presenter picks the sequence and clicks a relation"
---
