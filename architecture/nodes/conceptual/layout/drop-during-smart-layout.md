---
id: "70c8f46f-b8e8-4fed-a108-2147edb728e1"
type: "scenario"
label: "Drop during Smart Layout"
given: "a canvas on which Smart Layout is running"
tests: "packages/ui/tests/addDuringSmartLayout.test.ts › places what was added during the layout by what it relates to, in the layout's undo step"
then: "the layout is applied and the element is placed by what it relates to, clear of the others; one Undo takes back the layout and the placement together"
when: "an element related to another is added before the layout lands, and the user then presses Undo"
---
