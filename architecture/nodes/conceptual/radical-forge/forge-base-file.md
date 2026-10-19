---
id: "ab9ee6c8-bb88-45f9-8d7a-0d82e25f80d3"
type: "scenario"
label: "Forge base file"
given: "no base, an unreadable one, a base an earlier Forge run saved and a base from git"
tests: "packages/common/tests/branchChanges.test.ts › base file › a Forge run saves its own base where git has none"
then: "it may replace the first three but not the base from git; the Forge base reads back with its source and no commit, is never old, and is named as the start of the Forge run"
when: "Forge asks whether it may save its own base, and a Forge base is read back"
---
