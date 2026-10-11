---
id: "5fb718b4-f631-436b-abf0-d4c91abb7d1a"
type: "scenario"
label: "Restart updates same need"
gherkin: |
  And picking the need under Start from loads its text into the description box
  # Covered by: apps/e2e/tests/studio/need.spec.ts › on the governance bookstore › Radical Forge stores its description as a Need and offers existing Needs as input
given: "a Forge run started from a brief that was stored as a need"
then: "the existing need gets the edited text and no second need is added"
when: "the user goes ← Back, edits the brief and presses Start again, or a later run picks that need under Start from"
---
