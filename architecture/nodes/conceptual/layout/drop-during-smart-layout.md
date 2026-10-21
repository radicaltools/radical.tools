---
id: "70c8f46f-b8e8-4fed-a108-2147edb728e1"
type: "scenario"
label: "Drop during Smart Layout"
given: "a canvas on which Smart Layout is running"
tests: |
  packages/ui/tests/addDuringSmartLayout.test.ts › places what was added during the layout by what it relates to, in the layout's undo step
  packages/ui/tests/addDuringSmartLayout.test.ts › places what was moved into another parent during Smart Layout by the rule for moves (item 240)
  packages/ui/tests/addDuringSmartLayout.test.ts › places what was moved into another parent during Tree Layout by the rule for moves (item 240)
then: "the layout is applied and the element is placed by what it relates to, clear of the others; one Undo takes back the layout and the placement together; the moved element lies inside its new parent, clear of its siblings, with nothing overlapping"
when: "an element related to another is added before the layout lands, and the user then presses Undo; and an element is moved into another parent before Smart Layout or the tree layout lands"
---
