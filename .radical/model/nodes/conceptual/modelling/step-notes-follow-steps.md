---
id: "3b2debb1-bba6-493c-b7a2-a390f2009d7d"
type: "requirement"
label: "Step notes follow steps"
action: "The system shall move or remove that step's note together with the step."
ears_type: "event-driven"
rationale: "A note describes one step and must not drift to another when the order changes. Evidence: packages/ui/src/store/diagramStore.ts:2518-2568; packages/ui/src/components/RightPanel.tsx:1360-1395; packages/ui/tests/sequences.test.ts:135-235; manual#view-flow"
trigger: "the user reorders or removes a sequence step"
---
