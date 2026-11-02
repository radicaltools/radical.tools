---
id: "86dda253-3f72-474b-8b1a-4dd50b913aaa"
type: "scenario"
label: "No fitness function apart from not run"
given: "accepted ADRs: one with no fitness function, one whose fitness function names no check, one whose fitness function is triggered nightly on a metric, one whose fitness function is triggered on pull-request on a metric, and one whose test failed; test results and no measurements"
metrics: "test(apps/e2e/tests/studio/inspector.spec.ts › the Overview tells an ADR without a fitness function from one whose fitness function has not run) passed"
then: "Decisions verified says 1 no fitness function, 1 no check, 2 not run of which 1 measured nightly, 1 failing; Needs attention has a Not run group listing both metric fitness functions with their trigger, the nightly one marked as measured nightly; the Measurements chip lists them with the command for the pull-request one"
when: "the Inspector opens on Overview"
---
