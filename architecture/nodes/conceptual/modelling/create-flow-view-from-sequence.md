---
id: "7d867529-1506-4cb2-bde8-dc7d44b71724"
type: "requirement"
label: "Create Flow view from sequence"
action: "Studio shall create and activate a Flow view linked to the sequence that lists every element taking part in its steps."
ears_type: "event-driven"
rationale: "Going from a recorded scenario to a sequence diagram should take one click. Evidence: packages/ui/src/components/RightPanel.tsx:1410-1432; packages/ui/src/store/diagramStore.ts:2442-2466; packages/ui/tests/views.test.ts:247-290; manual#view-flow"
trigger: "the user clicks Create Flow view from sequence on a sequence that no view shows yet"
---
