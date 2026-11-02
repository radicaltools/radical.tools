---
id: "75e68b27-cb44-450c-ae48-116069a00893"
type: "scenario"
label: "Known failure passes"
given: "a fuzz file whose rule is broken by one kind of step, listed as a known entry, and a second entry no run matches"
metrics: |
  test(packages/crucible/tests/engine.test.ts › known failures › ends a run that breaks a known rule quietly and counts the hit) passed
  test(packages/crucible/tests/engine.test.ts › known failures › matches by last action, earlier actions, difference paths and facts) passed
  test(packages/crucible/tests/engine.test.ts › known failures › lists the known entries no run hit) passed
  test(packages/crucible/tests/engine.test.ts › signatures › is the rule, the last action and the shape of what differs, without ids) passed
then: "the property passes, the first entry's hits are counted, the summary lists the second with no hit, and an entry by last action, earlier actions, difference paths or facts matches only where all it names hold"
when: "the world runs"
---
