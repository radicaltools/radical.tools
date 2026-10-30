---
id: "54adc6bf-af7f-4f98-bac9-9547d4f82afc"
type: "scenario"
label: "Delete key offers hide"
gherkin: |
  And choosing Cancel instead leaves everything unchanged
  # Not covered by an automated test
given: "a named view with an element selected"
metrics: |
  test(packages/ui/tests/undoSteps.test.ts › deleting with the Delete key › removing from the view only is one step too) passed
  test(packages/ui/tests/views.test.ts › addView / addNodeToView / removeNodeFromView › addNodeToView appends a node id; removeNodeFromView removes it) passed
  test(packages/ui/tests/views.test.ts › hiding from a view whose filter decides what it shows) passed
  test(apps/e2e/tests/studio/state-machines.spec.ts › the Delete prompt says what Remove from model takes) passed
then: "the prompt says what Remove from model takes with it; the element disappears from that view and stays in the model and the model tree; on a view that lists nothing and shows what its filter gives, Hide is not offered and the view keeps showing what its filter gives"
when: "the user presses Delete and chooses Hide from current view"
---
