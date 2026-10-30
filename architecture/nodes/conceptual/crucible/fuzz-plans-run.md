---
id: "fb604326-efc5-47b7-ba19-f076bede9b68"
type: "scenario"
label: "Fuzz plans run"
given: "a project whose crucible.json lists a fuzz file run by a command of its own"
metrics: |
  test(apps/cli/src/fuzz.test.ts › radical fuzz › runs each fuzz file in crucible.json with the plan's settings) passed
  test(apps/cli/src/fuzz.test.ts › radical fuzz › exits 1 when a rule breaks outside the known failures) passed
  test(apps/cli/src/fuzz.test.ts › radical fuzz › exits 2 without a crucible.json or with an unknown plan) passed
  test(packages/crucible/tests/engine.test.ts › runWorld › runs a world's plan and counts runs, steps and steps that found nothing to act on) passed
  test(packages/crucible/tests/engine.test.ts › runWorld › shrinks a broken rule to its shortest sequence and names the rule, the steps and what differs) passed
then: "the file runs with FUZZ_PLAN, FUZZ_RUNS, FUZZ_SEED and FUZZ_WORLD set from the plan and the options; the exit status is 0, then 1 for the failing file, then 2 naming what is missing"
when: "radical fuzz runs with the ci plan, with the night plan and --runs 50 --world bookstore, with a file that fails, and without crucible.json or with an unknown plan"
---
