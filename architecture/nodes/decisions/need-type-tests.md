---
id: "61d5fa8d-bdce-4f71-b8aa-f9c5a60bb9bc"
type: "fitness-fn"
label: "Need type tests"
category: "structural"
tests: |
  packages/common/tests/needType.test.ts › need node type (governance preset)
  packages/common/tests/mdFolderPersistence.test.ts › md-folder persistence › stores a need's free text as the Markdown body of its file
  apps/e2e/tests/studio/need.spec.ts › on the governance bookstore
  apps/e2e/tests/studio/need.spec.ts › needs nest under a broader need: a tree in the table, and Add child on its wiki page
threshold: "All tests pass"
---

packages/common/tests/needType.test.ts checks the governance need type: its text in the description, requirements derive from it, it nests under a broader need and nothing satisfies or verifies it; mdFolderPersistence.test.ts checks the text is the Markdown body of its file; apps/e2e/tests/studio/need.spec.ts checks creating needs in Studio and Forge storing its brief as a need.
