---
id: "9c1f410b-4859-4baf-a8cc-ffeacb392cc7"
type: "scenario"
label: "Quick entry fills EARS fields"
gherkin: |
  And the box shows "Detected: event-driven"
  # Covered by: packages/common/tests/earsSentence.test.ts › when-clause → event-driven
given: "a requirement is selected in the properties panel"
then: "the pattern becomes event-driven, the trigger \"the user clicks save\" and the action \"persist the document\""
when: "the user types \"When the user clicks save, the system shall persist the document\" into the quick-entry box and presses Enter"
---
