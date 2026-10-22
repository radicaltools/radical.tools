---
id: "45518545-1bd8-482e-9afd-92a36a6cf25d"
type: "fitness-fn"
label: "Packs meet the standard"
category: "structural"
tests: |
  packages/hub-catalogue/tests/concernPacks.test.ts › concern packs › every pack has a trigger that parses, questions and a connected slice
  packages/hub-catalogue/tests/concernPacks.test.ts › concern packs › every pack meets the standard, and every group has packs
threshold: "0 packs with a problem; every group of the eight holds at least one pack"
---

packages/hub-catalogue/tests/concernPacks.test.ts validates every pack of the catalogue with concernPackProblems (@radical/common/concerns), which checks the group, the questions and their options, the sources and each fitness function's tool and snippet.
