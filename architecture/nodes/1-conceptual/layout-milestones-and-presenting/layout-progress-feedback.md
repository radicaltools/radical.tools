---
id: "9c38b50f-0829-4fa8-a34c-4d6c1c0350d1"
type: "requirement"
label: "Layout progress feedback"
action: "Studio shall disable the Smart Layout button and show which phase is running (algorithms tried out of ten, scoring, refining, polishing) while the ranking and annealing run in a background worker."
ears_type: "state-driven"
precondition: "Smart Layout is running"
rationale: "A run can take seconds on large views; visible progress and a responsive UI show the tool is working, not frozen. Evidence: packages/ui/src/components/SmartLayoutButton.tsx:46-53, packages/ui/src/components/SmartLayoutButton.tsx:150-160; packages/ui/src/layout/smartLayoutRunner.ts:26-90; packages/ui/src/layout/smartLayout.worker.ts:1-36; packages/layout/src/smartLayout.ts:1175-1188"
---
