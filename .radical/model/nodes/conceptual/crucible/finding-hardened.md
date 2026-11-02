---
id: "4218d1ff-9e76-4867-9eee-e2170a8b1b46"
type: "scenario"
label: "Finding hardened"
given: "an open fuzz finding with its steps, and one from an exploration without steps to replay"
metrics: |
  test(apps/cli/src/harden.test.ts › radical harden › marks a fuzz finding hardened with its test and scenario) passed
  test(apps/cli/src/harden.test.ts › radical harden › exits 2 for an unknown finding or one with no steps to replay) passed
then: "the first is hardened with its test id and the scenario, its test() line is printed for the scenario's Metrics; the others exit 2 saying why, and no model file changes"
when: "radical harden runs on the first with --scenario \"Undo is exact\", then on the second and on an id no finding has"
---
