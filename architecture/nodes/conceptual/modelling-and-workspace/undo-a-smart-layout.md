---
id: "65e808ff-ce03-47e6-85a2-fced65ddc2b2"
type: "scenario"
label: "Undo a Smart Layout"
given: "the bookstore Containers view open on the canvas"
tests: "apps/e2e/tests/studio/layout.spec.ts › Undo puts every node back where it was before Smart Layout"
then: "every element goes back close to where it stood before Smart Layout"
when: "the user runs Smart Layout, which moves the elements, then presses Ctrl/Cmd+Z"
---
