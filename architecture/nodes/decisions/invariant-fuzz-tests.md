---
id: "e41c4ac6-8b6e-44d3-93e1-dc97f18b4272"
type: "fitness-fn"
label: "Invariant fuzz tests"
category: "structural"
tests: "packages/ui/tests/invariants.test.ts"
threshold: "Every invariant holds for the fixed seeds in CI"
---

packages/ui/tests/invariants.test.ts: random sequences of store actions on the bookstore, the sample and a nested model, with the product's rules checked after every step (undo/redo exact, save round trip, reload changes nothing, containment and no sibling overlap, no dangling references, milestone edits leave the live model alone).
