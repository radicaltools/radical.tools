---
id: "d2e8af58-c018-4b03-9381-8fd0251e7cbc"
type: "scenario"
label: "Undo reachable at 1440px"
gherkin: |
  And this is a known bug: the Quick Search bar covers Undo/Redo at this width (marked test.fail)
  # Covered by: apps/e2e/tests/studio/known-issues.spec.ts › Undo and Redo in the toolbar can be clicked at 1440px
given: "the bookstore fixture is open on the Context view at 1440 px width and the user has added a Software System"
then: "the added system is removed and three elements remain"
when: "the user clicks Undo in the toolbar"
---
