---
id: "c4740eee-402d-41a9-82d9-07b3f608efdf"
type: "scenario"
label: "Folder keeps its name"
given: "a model folder whose radical.md names it, and a model kept in the browser"
metrics: |
  test(apps/e2e/tests/studio/folders.spec.ts › a folder opened is named as its radical.md says, and opening a view leaves radical.md alone) passed
  test(apps/e2e/tests/studio/folders.spec.ts › Move to a folder keeps the model's name, and a rename reaches radical.md at once) passed
then: "the opened folder is listed under the name its radical.md gives and opening the view leaves radical.md as it was; the moved model keeps its name, and the rename is in radical.md at once"
when: "the user opens the folder and a view in it; moves the browser model to a folder and renames it"
---
