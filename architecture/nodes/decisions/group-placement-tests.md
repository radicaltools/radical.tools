---
id: "98c7db28-f73e-4f02-b67c-88c63ecea461"
type: "fitness-fn"
label: "Group placement tests"
cadence: "triggered"
characteristic: "interaction-capability"
invocation: "automated"
metrics: "test(packages/common/tests/c4Containment.test.ts › what a group may hold) passed"
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/c4Containment.test.ts › what a group may hold: a group at the top of the model refuses containers, components, databases, web apps and queues and takes what may be at the top; a group inside a system takes the parts of a system at any depth and refuses a person or a domain; adding or moving a component into a group at the top is refused with the reason; moving a group is refused where what it holds would have no place; validateModel warns (bad-place) about such an element in an existing model.

Threshold: All suites pass in CI
