---
id: "747b3a2e-dabe-4ea2-be62-754eb36c9ac2"
type: "scenario"
label: "Exploring keeps Designer undo"
given: "an element has just been added in the Designer perspective"
metrics: |
  test(apps/e2e/tests/studio/editing.spec.ts › the undo keys take none of Designer's steps in Viewer) passed
  test(apps/e2e/tests/studio/editing.spec.ts › the undo keys take none of Designer's steps in Presenter) passed
  test(apps/e2e/tests/studio/editing.spec.ts › Undo and Redo are Designer's: Viewer, Presenter and the metamodel editor show none) passed
then: "the element and the saved model stay unchanged in Viewer or Presenter, which, like the metamodel editor, show no Undo or Redo; the element is still there back in Designer, and the undo there removes it"
when: "the user switches to Viewer or Presenter and presses ⌘/Ctrl+Z, then returns to Designer and presses ⌘/Ctrl+Z again"
---
