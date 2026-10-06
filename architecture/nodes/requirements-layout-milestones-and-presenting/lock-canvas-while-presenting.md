---
id: "bcc216d1-7896-405b-871b-298f8290883c"
type: "requirement"
label: "Lock canvas while presenting"
action: "Studio shall stop the live layout and prevent dragging, connecting and collapsing elements."
ears_type: "state-driven"
precondition: "a presentation is running"
rationale: "Slides are static and must not drift through an accidental drag. Evidence: packages/ui/src/store/diagramStore.ts:3814-3828, packages/ui/src/store/diagramStore.ts:1642-1645, packages/ui/src/store/diagramStore.ts:1405-1407; packages/ui/src/components/Canvas.tsx:945-946; packages/ui/tests/presentation.test.ts:89-115"
---
