---
id: "7fdef570-2228-45fe-a21f-ae984a56ab12"
type: "scenario"
label: "Delete hides from view"
given: "two elements selected for deletion on a named view"
metrics: "test(packages/ui/tests/undoSteps.test.ts › deleting with the Delete key › removing from the view only is one step too) passed"
then: "they leave the view's element list, stay in the model, and one Undo brings them back"
when: "the user chooses to remove them from the view only"
---
