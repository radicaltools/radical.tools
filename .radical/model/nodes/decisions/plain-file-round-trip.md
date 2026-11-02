---
id: "66ed6c1d-486e-4b67-a2db-cc8c3b2e7293"
type: "fitness-fn"
label: "Plain-file round-trip"
cadence: "triggered"
characteristic: "compatibility"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/mdFolderPersistence.test.ts checks the Markdown folder format (one file per element, JSON sidecars, lossless and deterministic); apps/studio/tests/mdFolderDocument.test.ts and diskFolderStorage.test.ts check documents kept as folders; apps/e2e/tests/studio/files.spec.ts and folders.spec.ts check a model kept in a .radical file or a folder from the welcome screen and across reloads.

Threshold: All tests pass: a model round-trips losslessly and deterministically through a .radical file and a Markdown folder, in browser storage and on disk, with no server call
