---
id: "d97f0f33-0039-4102-90b7-f61aad4ee395"
type: "scenario"
label: "Stable folder files"
given: "the same model held in a different in-memory order"
tests: |
  packages/common/tests/mdFolderPersistence.test.ts › md-folder persistence › produces deterministic output regardless of store ordering (git-friendly)
  packages/common/tests/mdFolderPersistence.test.ts › md-folder persistence › sorts custom frontmatter keys and ends JSON sidecars with a newline
then: "the files are identical, custom frontmatter keys are sorted and JSON sidecars end with a newline"
when: "it is written as a Markdown folder"
---
