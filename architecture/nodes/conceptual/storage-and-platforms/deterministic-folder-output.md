---
id: "0531d21e-022d-45e1-9f26-e7c52f85ed63"
type: "requirement"
label: "Deterministic folder output"
action: "The Markdown folder format shall produce identical files for the same model regardless of in-memory order, using sorted keys, id-ordered relations, the metamodel's own order of custom types, and stable de-duplicated file names cut at 60 characters, never in the middle of one; an element keeps its file name until it is renamed or moved itself (a sibling renamed to its name, or a new element of its name, takes the -2), and a directory and a file of one name do not clash."
ears_type: "ubiquitous"
rationale: "Git diffs then show what changed and nothing else. Renaming an element to its sibling's label moved the untouched sibling's file to -2 (round 170–175, 2026-10-22, F-0006). Evidence: packages/common/src/formats/mdFolder.ts (keepMdFolderPaths, allocateSlugs), packages/common/src/formats/mdFolderSync.ts, apps/mcp/src/folderModel.ts; packages/common/tests/mdFolderPersistence.test.ts ('deterministic output'), packages/common/tests/mdFolderSync.test.ts; manual#formats"
---
