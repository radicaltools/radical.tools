---
id: "3528e5fe-533c-4ba6-88fc-bd435a571317"
type: "fitness-fn"
label: "Model separation tests"
cadence: "triggered"
characteristic: "maintainability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

The tests of the scenarios that keep the repository out of the model folder: adapters run as repository sensors, the repository's settings in radical.json, reviews in .radical/, stale code paths in descriptions.
