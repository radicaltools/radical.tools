---
id: "681b9604-2215-4597-9f21-7a6081aa017b"
type: "requirement"
label: "Persist live while time-travelling"
action: "Studio shall save the live model and its layout, not the content of the shown milestone."
ears_type: "state-driven"
precondition: "a milestone is shown"
rationale: "Looking at the past must never overwrite current work, even if the app reloads. Evidence: packages/ui/src/store/diagramStore.ts:4179-4206; packages/ui/tests/milestones.test.ts:109-133"
---
