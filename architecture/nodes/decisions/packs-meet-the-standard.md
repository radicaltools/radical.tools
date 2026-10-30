---
id: "45518545-1bd8-482e-9afd-92a36a6cf25d"
type: "fitness-fn"
label: "Packs meet the standard"
category: "structural"
metrics: |
  test(packages/hub-catalogue/tests/concernPacks.test.ts › concern packs › every pack has a trigger that parses, questions and a connected slice) passed
  test(packages/hub-catalogue/tests/concernPacks.test.ts › concern packs › every pack meets the standard, and every group has packs) passed
  test(packages/hub-catalogue/tests/concernPacks.test.ts › concern packs › specProblems: every requirement is checked by a fitness function imported with it, or says why not) passed
---

packages/hub-catalogue/tests/concernPacks.test.ts validates every pack of the catalogue with concernPackProblems (@radical/common/concerns): the group, the questions and their options (no {{…}} in a label or description), the sources, each fitness function's tool and snippet, every {{KEY}} against the questions and details (none unknown, no detail unused, no hard-coded default beside a # KEY comment), EARS clauses without their own keyword, every option decided by an imported element or a decision text, and every fitness function imported with a decision it implements; and every spec with specProblems: each requirement named in the checks of a fitness function imported whenever it is, or unchecked with a reason. scripts/build-packs.ts runs the same before writing a pack's file.

Threshold: 0 packs with a problem of the standard or the spec standard; every group of the nine holds at least one pack
