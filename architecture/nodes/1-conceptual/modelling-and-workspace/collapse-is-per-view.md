---
id: "3d4b4291-63ea-42be-9d64-5ef5ea787c21"
type: "requirement"
label: "Collapse is per view"
action: "Studio shall store a collapse or expand in that view only, leaving the model-level state and other views unchanged."
ears_type: "state-driven"
precondition: "a named view is active"
rationale: "The same system can be open in one view and folded in another. Evidence: packages/ui/src/store/diagramStore.ts:1642-1700; packages/ui/tests/viewCollapse.test.ts:112,146,210; manual#elements"
---
