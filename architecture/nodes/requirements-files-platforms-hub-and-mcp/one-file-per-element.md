---
id: "bb5fe800-2f6a-4c09-89c9-9922ebeef052"
type: "requirement"
label: "One file per element"
action: "The Markdown folder format shall store each element as one .md file under nodes/ with YAML front-matter (id, type, label, then the remaining properties sorted) and the description as the body, and give systems, containers, domains, groups, blueprints and any element with children a directory holding an _index.md."
ears_type: "ubiquitous"
rationale: "Readable without the app and editable by hand; the directory tree is the containment hierarchy. Evidence: packages/common/src/formats/mdFolder.ts:239-288; packages/common/src/c4.ts:8-15; packages/common/tests/mdFolderPersistence.test.ts; manual#formats"
---
