---
id: "853a5b25-ea1c-4f3d-a96a-61c6979f3023"
type: "scenario"
label: "Gate on an e2e fix"
given: "a fix whose test runs against a build (an e2e test of the web build), with a runner in crucible.json that names the build and a repeat command"
metrics: |
  test(apps/cli/src/harden.test.ts › radical harden --gate › builds before the runs without and with the fix, so a test of the build judges the fix) passed
  test(apps/cli/src/harden.test.ts › radical harden --gate › makes the runs at once one run of the runner's repeat command) passed
  test(apps/cli/src/harden.test.ts › radical harden --gate › finds a test named with its describe block) passed
then: "the gate builds before the run without the fix and before the run with it, so the test fails without the fix and passes with it; the runs at once are one run of the repeat command; the test is found by its describe block and name"
when: "the user runs radical harden --gate --test \"<file> › <describe> › <test>\""
---
