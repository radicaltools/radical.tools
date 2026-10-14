---
id: "038cf13c-4b3d-45bb-8051-1eabf598a70a"
type: "scenario"
label: "Left panel resized"
given: "the bookstore sample open, with the left panel at its default width of 260 pixels"
tests: "apps/e2e/tests/studio/views.spec.ts › left panel › its edge drags it wider, it stays so after a reload, and a double-click sets it back"
then: "the panel is 320 pixels wide, still so after the reload, and back at 260 after the double-click"
when: "the user drags the panel edge 60 pixels to the right, reloads, then double-clicks the edge"
---
