---
id: "2b57eecd-f114-4aee-b385-e5aae10b6075"
type: "scenario"
label: "Folder read several files at a time"
given: "a folder of 300 model files whose every read takes a moment"
metrics: |
  test(packages/common/tests/largeModels.test.ts › reading a large model folder › reads several files at a time, each result in its place) passed
  test(packages/common/tests/largeModels.test.ts › reading a large model folder › reads the folder several files at a time when the session opens it) passed
then: "more than one file is read at once, never more than 32, each content lands under its own path, and the session holds the folder as it is"
when: "the folder is read, and a session opens it"
---
