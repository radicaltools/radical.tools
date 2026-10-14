---
id: "6b85bd4d-1e28-43d3-8eb0-2e2cc69143b4"
type: "requirement"
label: "Every relation drawn"
action: "draw the new relation as an edge of its own that can be selected"
ears_type: "event-driven"
rationale: "A relation that is not drawn cannot be seen, selected or deleted. Evidence: apps/e2e/tests/studio/editing.spec.ts"
trigger: "the user creates a relation between two visible elements that another relation already joins"
---
