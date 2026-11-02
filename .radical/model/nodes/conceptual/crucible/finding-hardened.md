---
id: "4218d1ff-9e76-4867-9eee-e2170a8b1b46"
type: "scenario"
label: "Finding hardened"
given: "an open fuzz finding with its steps, and one from an exploration without steps to replay"
then: "the first is hardened with its test id and the scenario, its test() line is printed for the scenario's Metrics; the others exit 2 saying why, and no model file changes"
when: "radical harden runs on the first with --scenario \"Undo is exact\", then on the second and on an id no finding has"
---
