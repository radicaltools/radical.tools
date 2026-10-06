---
id: "14616238-2a99-4f39-a051-b1b4c088859a"
type: "requirement"
label: "Sidecars for the rest"
action: "The Markdown folder format shall keep relations, views, sequences, milestones, presentations, the metamodel and Hub template records in JSON sidecar files and keep positions and camera only in _layout.json."
ears_type: "ubiquitous"
rationale: "Layout noise stays in one file so element diffs stay clean, and the folder round-trips losslessly. Evidence: packages/common/src/formats/mdFolder.ts:36-58,290-315; packages/common/tests/mdFolderPersistence.test.ts ('keeps positions out of the markdown', 'round-trips losslessly'); manual#formats"
---
