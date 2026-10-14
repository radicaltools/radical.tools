---
id: "6c67c346-7097-406a-911a-467db8409328"
type: "requirement"
label: "Keep files it doesn't own"
action: "The folder writer shall never delete or overwrite a file the format does not own, such as a package.json or a hand-written nodes/README.md without id and type front-matter."
ears_type: "ubiquitous"
rationale: "Model folders live inside real repositories next to other files. Evidence: packages/common/src/formats/mdFolder.ts:439-468; packages/node-files/src/diskFolderStorage.ts:12-30; apps/studio/tests/mdFolderSafety.test.ts ('never deletes files the format does not own'); manual#mcp"
---
