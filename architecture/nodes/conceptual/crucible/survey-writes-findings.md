---
id: "e40052a3-2bde-4650-b046-4c86941bc7cc"
type: "scenario"
label: "Survey writes findings"
given: "a fuzz file with two rules broken in three ways, one of them already an open finding"
metrics: |
  test(apps/cli/src/fuzz.test.ts › radical fuzz › records each new signature of a survey as an open finding, once) passed
  test(packages/crucible/tests/engine.test.ts › survey › reports each new signature once and goes on) passed
  test(packages/crucible/tests/findings.test.ts › findings › writes a finding as a Markdown file and reads it back) passed
  test(packages/crucible/tests/findings.test.ts › findings › numbers new findings after the highest id) passed
then: "the first run writes one open finding per new signature, with its rule, world, seed, path, steps and what differs, and the second writes none"
when: "radical fuzz --survey runs, and runs again"
---
