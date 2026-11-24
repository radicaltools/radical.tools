---
id: "902d4565-5101-4f8f-b584-ed440133392e"
type: "fitness-fn"
label: "Scaled limits tests"
cadence: "triggered"
characteristic: "functional-suitability"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

packages/common/tests/checkMetrics.test.ts checks scaled conditions: an upper limit multiplied and a lower one divided by the machine.speed nearest in time, never below ×1, the arithmetic in the detail, and no machine.speed read as not measured. apps/cli/src/sensors/machine.test.ts runs radical sense machine in a repository: --reference keeps the reference in .radical/radical.json, --again keeps the slower run, no reference measures nothing, and other work than the reference's is refused.
