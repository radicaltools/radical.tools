---
id: "1f08ef4d-699a-4e3e-af5f-0c1378273340"
type: "scenario"
label: "Viewer cannot edit"
given: "the bookstore Containers view"
tests: "apps/e2e/tests/studio/views.spec.ts › Viewer is read-only"
then: "no palette items are shown and the Label field reads 'API' but is not editable"
when: "the user opens it in the Viewer perspective and selects the API element"
---
