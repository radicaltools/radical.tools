---
id: "e0f20562-f82a-4084-bb98-b0ffacdea6fb"
type: "scenario"
label: "Catalogue meets the standard"
given: "every concern pack of the catalogue, and a pack with two questions, an option without a description, one source and a fitness function without a tool"
metrics: |
  test(packages/hub-catalogue/tests/concernPacks.test.ts › concern packs › every pack meets the standard, and every group has packs) passed
  test(packages/common/tests/concernPacks.test.ts › concernPackProblems › names each way a pack falls below the standard) passed
then: "every pack of the catalogue passes and every group holds at least one; the poor pack is refused with each of its four problems named"
when: "the catalogue is validated"
---
