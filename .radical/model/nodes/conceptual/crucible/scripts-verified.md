---
id: "3955cbd0-4201-4fe2-a3cd-5b0032d3762e"
type: "scenario"
label: "Scripts verified"
given: "a prepared round whose run 5 has a script that fails and one that passes"
metrics: |
  test(apps/cli/src/explore.test.ts › radical explore verify › serves the run's build, runs its scripts and stops the server) passed
  test(apps/cli/src/explore.test.ts › serves each server on its port of the run, and stops them all) passed
then: "the server answered on the run's port while they ran and is stopped after, each script's output and exit status is shown, and the journal keeps them"
when: "radical explore verify 5 runs both"
---
