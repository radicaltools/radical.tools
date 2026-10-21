---
id: "6b529b59-0a84-4c2d-be41-c0af48318da1"
type: "scenario"
label: "Model opens on its first view"
given: "several models kept in the browser, each with views"
tests: "apps/e2e/tests/studio/boot.spec.ts › Models dialog › a model picked in the list opens on its first view, and the dialog closes"
then: "the model opens on its first view in model order and the dialog closes"
when: "the user picks one in the list of the Models dialog"
---
