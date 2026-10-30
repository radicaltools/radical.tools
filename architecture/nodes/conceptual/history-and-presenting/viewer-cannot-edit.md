---
id: "1f08ef4d-699a-4e3e-af5f-0c1378273340"
type: "scenario"
label: "Viewer cannot edit"
given: "the bookstore Containers view"
metrics: |
  test(apps/e2e/tests/studio/views.spec.ts › Viewer is read-only) passed
  test(apps/e2e/tests/studio/nesting.spec.ts › the special key › in Viewer it only selects: no pills, no line, no relation, no nesting) passed
  test(apps/e2e/tests/studio/nesting.spec.ts › the special key › in Presenter it only selects: no pills, no line, no relation, no nesting) passed
  test(packages/ui/tests/perspectivesDoNotEdit.test.ts › outside Designer the model is not edited › in viewer: no relation added, moved or removed, no element nested, no line started) passed
  test(packages/ui/tests/perspectivesDoNotEdit.test.ts › outside Designer the model is not edited › in presenter: no relation added, moved or removed, no element nested, no line started) passed
  test(packages/ui/tests/perspectivesDoNotEdit.test.ts › outside Designer the model is not edited › in Designer they edit) passed
then: "no palette items are shown and the Label field reads 'API' but is not editable; the special key only selects: no pills, no line, no relation and no nesting, and the store adds, moves and removes no relation and nests nothing there, as it does in Designer"
when: "the user opens it in the Viewer perspective and selects the API element; and, in Viewer and in Presenter, holds the special key and drags from an element onto another, while the store is asked to relate and nest elements"
---
