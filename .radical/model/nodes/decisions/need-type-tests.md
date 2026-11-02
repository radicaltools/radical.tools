---
id: "61d5fa8d-bdce-4f71-b8aa-f9c5a60bb9bc"
type: "fitness-fn"
label: "Need type tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/needType.test.ts checks the governance need type: its text in the description, requirements derive from it, it nests under a broader need and nothing satisfies or verifies it; mdFolderPersistence.test.ts checks the text is the Markdown body of its file; apps/e2e/tests/studio/need.spec.ts checks creating needs in Studio and Forge storing its brief as a need.

Threshold: All tests pass
