---
id: "a5b48c42-6f22-4c30-bad6-b396985279f4"
type: "scenario"
label: "Finish after requirements"
gherkin: |
  And ← Back returns to the Requirements stage
  # Not covered by an automated test
given: "a Forge run whose Requirements stage has been generated"
then: "the Finish step lists Requirements with its added counts and every later stage as skipped, and the requirements stay in the model"
when: "the user presses Finish here"
---
