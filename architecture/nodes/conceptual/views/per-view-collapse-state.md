---
id: "8bbfc0aa-8116-47b6-944e-9f8aaf5c02e1"
type: "requirement"
label: "Per-view collapse state"
action: "Studio shall record the change for that view only and leave the model-level state and other views unchanged."
ears_type: "event-driven"
rationale: "Detail level is a property of a reading, not of the architecture. Evidence: packages/ui/src/store/diagramStore.ts:1642-1665; packages/common/src/c4.ts:150-160; packages/ui/tests/viewCollapse.test.ts:112-233; manual#views"
trigger: "the user collapses or expands a container while a named view is active"
---
