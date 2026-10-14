---
id: "86fde16e-eb28-466b-af52-b8a3a67278eb"
type: "scenario"
label: "Shift-click adds selection"
given: "one element selected on the canvas"
tests: |
  apps/e2e/tests/studio/alignment.spec.ts › a row on All elements holds through a drag, Smart Layout and a reload
  apps/e2e/tests/studio/alignment.spec.ts › dragging a child of an aligned container keeps the alignment
then: "they join the selection and the selection bar counts them all"
when: "the user Shift-clicks other elements"
---
