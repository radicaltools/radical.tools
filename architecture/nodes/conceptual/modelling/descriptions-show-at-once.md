---
id: "1a558428-a009-4190-ae04-127b413a9ad7"
type: "scenario"
label: "Descriptions show at once"
given: "a folder model whose elements have descriptions in their files"
tests: |
  apps/studio/tests/mdFolderDocument.test.ts › loads every element's description with a folder model
  apps/e2e/tests/studio/folders.spec.ts › the table sums up elements by their descriptions at once, and after an outside edit
then: "the table sums up each element by its description without the element being selected, and Quick Search finds an element by a word of its description"
when: "Studio opens it, or a tool rewrites its files while it is open"
---
