---
id: "c5669f83-f0cd-4b6a-8362-1a5dafc3736d"
type: "fitness-fn"
label: "Warnier tests"
category: "structural"
tests: |
  packages/common/tests/warnier.test.ts
  apps/mcp/src/folderModel.test.ts › warnier
  apps/e2e/tests/studio/warnier.spec.ts
threshold: "All suites pass in CI"
---

packages/common/tests/warnier.test.ts (the process and step types and their relations, warnierTree for a process, a state machine and a view's chain), apps/mcp/src/folderModel.test.ts › warnier (an agent writes a process and a Warnier view) and apps/e2e/tests/studio/warnier.spec.ts (the diagram in Studio).
