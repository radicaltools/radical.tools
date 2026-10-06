---
id: "5433e04f-087e-405c-a73b-1f40a0fa008a"
type: "scenario"
label: "Inspect and edit a type"
gherkin: |
  And clicking Blueprint zooms in and clicking the empty pane zooms back to the overview
  And selecting Constrains in the legend shows only its 11 types and 24 edges until Esc
  And the side panel lists "Relations out" with Derives from for the selected Requirement
  And Esc clears the selection and shows Validation while the editor stays open
  # Covered by: apps/e2e/tests/studio/metamodel-diagram.spec.ts › selecting a type shows its rules; Edit opens it in the list
given: "the Diagram tab of the metamodel editor shows the governance preset"
then: "the List tab opens with the Requirement card focused"
when: "the user clicks the Requirement box and then presses Edit type"
---
