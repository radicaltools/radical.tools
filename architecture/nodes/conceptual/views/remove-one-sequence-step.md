---
id: "2c72f411-c7ac-4398-8dad-8651e0a14f18"
type: "requirement"
label: "Remove one sequence step"
action: "remove that step only and keep the other steps, including other steps of the same relation, in their order"
ears_type: "event-driven"
rationale: "A relation may be a step more than once; removing one step must not take another. Evidence: apps/e2e/tests/studio/editing.spec.ts"
trigger: "the user removes a step of a sequence"
---
