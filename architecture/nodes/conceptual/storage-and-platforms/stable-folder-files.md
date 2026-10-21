---
id: "d97f0f33-0039-4102-90b7-f61aad4ee395"
type: "scenario"
label: "Stable folder files"
given: "the same model held in a different in-memory order"
tests: |
  packages/common/tests/mdFolderPersistence.test.ts › md-folder persistence › produces deterministic output regardless of store ordering (git-friendly)
  packages/common/tests/mdFolderPersistence.test.ts › md-folder persistence › sorts custom frontmatter keys and ends JSON sidecars with a newline
  packages/common/tests/mdFolderPersistence.test.ts › a custom metamodel in a folder › keeps the order of its node and relation types
  packages/common/tests/mdFolderPersistence.test.ts › a node file in a folder model › whose label has a character outside the BMP at the 60th place keeps a file name the disk keeps
then: "the files are identical, custom frontmatter keys are sorted and JSON sidecars end with a newline; a custom metamodel keeps the order of its types; a file name is cut at 60 characters, never inside one, so the element's file survives the next write"
when: "it is written as a Markdown folder"
---
