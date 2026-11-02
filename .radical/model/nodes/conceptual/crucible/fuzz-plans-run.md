---
id: "fb604326-efc5-47b7-ba19-f076bede9b68"
type: "scenario"
label: "Fuzz plans run"
given: "a project whose .radical/crucible/crucible.json lists a fuzz file run by a command of its own"
then: "the file runs with FUZZ_PLAN, FUZZ_RUNS, FUZZ_SEED and FUZZ_WORLD set from the plan and the options; the exit status is 0, then 1 for the failing file, then 2 naming what is missing"
when: "radical fuzz runs with the ci plan, with the night plan and --runs 50 --world bookstore, with a file that fails, and without .radical/crucible/crucible.json or with an unknown plan"
---
