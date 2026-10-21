---
id: "3150bb6d-fee6-408d-9b42-643f08cdc692"
type: "scenario"
label: "Exploring layout not saved"
given: "the Containers view open in Designer"
tests: |
  apps/e2e/tests/studio/views.spec.ts › what is arranged in Viewer and Presenter stays there › Smart Layout in Viewer is not saved
  apps/e2e/tests/studio/views.spec.ts › what is arranged in Viewer and Presenter stays there › Smart Layout in Presenter is not saved
  apps/studio/tests/viewerSandbox.test.ts › the metamodel editor opened while exploring
then: "the stored model is unchanged and the canvas shows the Designer positions; a metamodel edit made from Viewer or Presenter saves Designer's layout, not what was dragged there, and what it changed in the views stays back in Designer"
when: "the user runs Smart Layout or drags in Viewer or Presenter, goes back to Designer and reloads; or opens the metamodel editor from there and edits it"
---
