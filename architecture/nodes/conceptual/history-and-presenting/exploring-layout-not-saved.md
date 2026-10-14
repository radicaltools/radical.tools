---
id: "3150bb6d-fee6-408d-9b42-643f08cdc692"
type: "scenario"
label: "Exploring layout not saved"
given: "the Containers view open in Designer"
tests: |
  apps/e2e/tests/studio/views.spec.ts › what is arranged in Viewer and Presenter stays there › Smart Layout in Viewer is not saved
  apps/e2e/tests/studio/views.spec.ts › what is arranged in Viewer and Presenter stays there › Smart Layout in Presenter is not saved
then: "the stored model is unchanged and the canvas shows the Designer positions"
when: "the user runs Smart Layout in Viewer or Presenter, goes back to Designer and reloads"
---
