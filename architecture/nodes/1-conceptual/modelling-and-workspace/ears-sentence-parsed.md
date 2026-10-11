---
id: "f5ae8ce7-d730-4062-8d3a-ad763082569c"
type: "scenario"
label: "EARS sentence parsed"
gherkin: |
  And the hint reads "Detected: event-driven"
  # Covered by: packages/common/tests/earsSentence.test.ts › parseEarsSentence (parser only; the input box is not covered)
given: "a requirement selected in the properties panel"
then: "the requirement becomes event-driven with trigger \"the user clicks save\" and action \"persist the document\""
when: "the user types \"When the user clicks save, the system shall persist the document\" in the quick-entry box and presses Enter"
---
