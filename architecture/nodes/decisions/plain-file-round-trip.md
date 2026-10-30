---
id: "66ed6c1d-486e-4b67-a2db-cc8c3b2e7293"
type: "fitness-fn"
label: "Plain-file round-trip"
category: "structural"
metrics: |
  test(packages/common/tests/mdFolderPersistence.test.ts › md-folder persistence) passed
  test(apps/studio/tests/mdFolderDocument.test.ts › documents — md-folder backend) passed
  test(apps/studio/tests/diskFolderStorage.test.ts › diskFolderStorage › round-trips a model and ignores everything that is not one) passed
  test(apps/e2e/tests/studio/files.spec.ts › Open → File… keeps the model in the file and saves changes to it) passed
  test(apps/e2e/tests/studio/files.spec.ts › New model can keep the model in a file) passed
  test(apps/e2e/tests/studio/folders.spec.ts › save as folder writes one Markdown file per element) passed
  test(apps/e2e/tests/studio/folders.spec.ts › a folder-backed model survives a reload) passed
---

packages/common/tests/mdFolderPersistence.test.ts checks the Markdown folder format (one file per element, JSON sidecars, lossless and deterministic); apps/studio/tests/mdFolderDocument.test.ts and diskFolderStorage.test.ts check documents kept as folders; apps/e2e/tests/studio/files.spec.ts and folders.spec.ts check a model kept in a .radical file or a folder from the welcome screen and across reloads.

Threshold: All tests pass: a model round-trips losslessly and deterministically through a .radical file and a Markdown folder, in browser storage and on disk, with no server call
