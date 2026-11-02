---
id: "e41c4ac6-8b6e-44d3-93e1-dc97f18b4272"
type: "fitness-fn"
label: "Invariant fuzz tests"
cadence: "triggered"
characteristic: "reliability"
invocation: "automated"
metrics: "test(packages/ui/tests/invariants.test.ts) passed"
scope: "atomic"
trigger: "pull-request"
---

packages/ui/tests/invariants.test.ts, a fuzz file on Radical Crucible's engine (@radical/crucible): random sequences of store actions on the bookstore, the sample and a nested model, with the product's rules checked after every step (undo/redo exact, save round trip, reload changes nothing, containment and no sibling overlap, no dangling references, milestone edits leave the live model alone). It reports a case per model and one per model and rule; radical fuzz runs it by plan.

Threshold: Every invariant holds for the fixed seeds in CI
