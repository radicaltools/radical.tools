---
id: "54adc6bf-af7f-4f98-bac9-9547d4f82afc"
type: "scenario"
label: "Delete key offers hide"
gherkin: |
  And choosing Cancel instead leaves everything unchanged
  # Not covered by an automated test
given: "a named view with an element selected"
then: "the element disappears from that view and stays in the model and the model tree"
when: "the user presses Delete and chooses Hide from current view"
---
