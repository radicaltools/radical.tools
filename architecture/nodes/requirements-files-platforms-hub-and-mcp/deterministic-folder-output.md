---
id: "0531d21e-022d-45e1-9f26-e7c52f85ed63"
type: "requirement"
label: "Deterministic folder output"
action: "The Markdown folder format shall produce identical files for the same model regardless of in-memory order, using sorted keys, id-ordered relations and stable de-duplicated file names."
ears_type: "ubiquitous"
rationale: "Git diffs then show what changed and nothing else. Evidence: packages/common/src/formats/mdFolder.ts:85-100,180-199,280-288,299-302; packages/common/tests/mdFolderPersistence.test.ts ('deterministic output'); manual#formats"
---
