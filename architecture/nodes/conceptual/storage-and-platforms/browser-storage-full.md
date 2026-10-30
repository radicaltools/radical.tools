---
id: "78a3dcd3-5652-4666-953c-09fa91170054"
type: "scenario"
label: "Browser storage full"
given: "browser storage that refuses to store anything more"
metrics: |
  test(apps/studio/tests/storageFull.test.ts › new model with browser storage full) passed
  test(apps/studio/tests/documentsPerTab.test.ts › a rename that storage refuses › says so instead of doing nothing) passed
then: "no model is added and the open model stays active, and the save and the rename fail with a storage-full error instead of doing nothing"
when: "the user creates a new model in the browser, a model is saved, or a model is renamed"
---
