---
id: "18215d54-09dd-4c1f-8573-071cb7c2a3e4"
type: "scenario"
label: "Satisfier names the subject"
gherkin: |
  And without a Satisfies relation the subject is "the system"
  # Covered by: packages/common/tests/earsSentence.test.ts › returns source label from satisfies relation
given: "the Payment Service satisfies an event-driven requirement with trigger and action filled"
then: "its sentence reads \"When <trigger>, Payment Service shall <action>.\""
when: "the requirement is shown on the canvas"
---
