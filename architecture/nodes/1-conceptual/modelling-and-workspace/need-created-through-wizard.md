---
id: "f6c3330a-4e72-4d54-8426-1fa98c067639"
type: "scenario"
label: "Need created through wizard"
gherkin: |
  And the stored need has the brief as description, kind brief and no status
  # Covered by: apps/e2e/tests/studio/need.spec.ts › on the governance bookstore › a Need is created through its wizard and shows the start of its text on the canvas
given: "the governance bookstore model"
then: "the need card shows the start of the brief on the canvas"
when: "the user drops a Need, names it \"Click & collect brief\", pastes the brief as its Text and clicks Create"
---
