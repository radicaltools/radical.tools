---
id: "0c21598f-7ac3-4761-ba98-e64b8bea9e16"
type: "scenario"
label: "Deleting view keeps model"
gherkin: "# Not covered by an automated test"
given: "a named view showing three elements"
metrics: |
  test(packages/ui/tests/views.test.ts › removeView) passed
  test(packages/ui/tests/undoSteps.test.ts › adding, renaming and deleting a view is an undo step › a deleted view comes back, as the one shown when it was) passed
then: "the view disappears from the list, All elements becomes active and all three elements are still in the model"
when: "the user deletes the view from its properties"
---
