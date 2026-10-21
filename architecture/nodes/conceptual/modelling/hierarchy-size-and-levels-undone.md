---
id: "c3d26d03-7977-4425-931b-b6930964c9da"
type: "scenario"
label: "Hierarchy Size and Levels undone"
given: "a hierarchy view in Designer with an element's properties card open"
tests: |
  packages/ui/tests/undoSteps.test.ts › Size and Levels of a hierarchy
  apps/e2e/tests/studio/selection-focus.spec.ts › the hierarchy's Size, Levels and Up stay clear of the properties card
then: "Size, Levels and Up stay clear of the card; each change is one undo step that Undo takes back, and setting what is already set makes none"
when: "the user changes Size and Levels, sets one of them to what it already is, and presses Undo"
---
